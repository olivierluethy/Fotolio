import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { clone, ensureHeader, findGallery, findPage, navItems } from './draftUtils';

/**
 * The brain of the live Site Editor: loads the draft + entity identity, keeps a
 * local working document that autosaves (debounced, serialized), and mediates
 * the postMessage bridge with the theme iframe. Panels call the returned
 * operations; every operation both mutates the draft and drives the canvas so
 * the effect is visible immediately.
 */
export function useSiteEditor() {
  const { refreshMe } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [draft, setDraftState] = useState(null);
  const [galleries, setGalleries] = useState([]); // identity: id, slug, is_home, name, cover, image_count
  const [pages, setPages] = useState([]);         // identity: id, slug, type, title
  const [images, setImages] = useState([]);
  const [token, setToken] = useState(null);
  const [ctx, setCtx] = useState({});
  const [selection, setSelection] = useState({ kind: 'site' });
  const [saving, setSaving] = useState('saved'); // saving | saved | error
  const [dirty, setDirty] = useState(false);
  const [publishedLive, setPublishedLive] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [canvasPath, setCanvasPath] = useState('');
  const [nonce, setNonce] = useState(0);

  const canvasRef = useRef(null);
  const draftRef = useRef(null);
  const ctxRef = useRef({});
  const navPending = useRef(false);
  const saveTimer = useRef(null);
  const pending = useRef(false);
  const savePromise = useRef(Promise.resolve());

  // Undo/redo: snapshots of the whole draft. Rapid edits (typing) coalesce so
  // one burst is a single undo step. Structural ops each get their own step.
  const histRef = useRef([]);
  const futureRef = useRef([]);
  const lastPushRef = useRef(0);
  const [histLen, setHistLen] = useState(0);
  const [futLen, setFutLen] = useState(0);
  const syncHist = useCallback(() => {
    setHistLen(histRef.current.length);
    setFutLen(futureRef.current.length);
  }, []);

  const galleriesById = useMemo(() => Object.fromEntries(galleries.map((g) => [g.id, g])), [galleries]);
  const pagesById = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, p])), [pages]);
  const imagesById = useMemo(() => Object.fromEntries(images.map((i) => [i.id, i])), [images]);

  // ---- Load -------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [editor, g, p, i] = await Promise.all([
          api.get('/site/editor'),
          api.get('/galleries'),
          api.get('/pages'),
          api.get('/images'),
        ]);
        setDraftState(editor.draft);
        draftRef.current = editor.draft;
        setGalleries(g.galleries);
        setPages(p.pages);
        setImages(i.images);
        setToken(editor.edit_token);
        setDirty(editor.dirty);
        setPublishedLive(editor.published_live);
        setLastPublishedAt(editor.last_published_at);
        setPublicUrl(editor.public_url);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasSrc = token ? `/api/site/editor/render?token=${encodeURIComponent(token)}&path=${encodeURIComponent(canvasPath)}&n=${nonce}` : null;

  // ---- Canvas messaging -------------------------------------------------
  const postToCanvas = useCallback((type, payload = {}) => {
    const win = canvasRef.current?.contentWindow;
    if (win) win.postMessage({ source: 'fotolio-editor', type, ...payload }, '*');
  }, []);

  const buildHref = useCallback((slug) => `/api/site/editor/render?token=${encodeURIComponent(token || '')}&path=${encodeURIComponent(slug)}`, [token]);

  const postNav = useCallback(() => {
    if (!draftRef.current) return;
    const items = navItems(draftRef.current, galleriesById, buildHref, ctxRef.current.slug || '');
    postToCanvas('nav-render', { items });
  }, [galleriesById, buildHref, postToCanvas]);

  // ---- Autosave (debounced, serialized) ---------------------------------
  const runSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (!pending.current) return savePromise.current;
    pending.current = false;
    setSaving('saving');
    const p = savePromise.current
      .catch(() => {})
      .then(() => api.patch('/site/editor/draft', { state: draftRef.current }))
      .then((r) => { setDirty(r.dirty); if (!pending.current) setSaving('saved'); })
      .catch(() => { setSaving('error'); });
    savePromise.current = p;
    return p;
  }, []);
  const scheduleSave = useCallback(() => {
    pending.current = true;
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(runSave, 650);
  }, [runSave]);
  const flushSave = useCallback(() => runSave(), [runSave]);

  const recordHistory = useCallback((prev, group) => {
    const now = Date.now();
    // Coalesce a burst of grouped edits (typing) into the pre-burst snapshot.
    if (group && now - lastPushRef.current < 600 && histRef.current.length) {
      lastPushRef.current = now;
      return;
    }
    histRef.current.push(prev);
    if (histRef.current.length > 80) histRef.current.shift();
    futureRef.current = [];
    lastPushRef.current = now;
    syncHist();
  }, [syncHist]);

  const mutate = useCallback((fn, { group = false } = {}) => {
    recordHistory(draftRef.current, group);
    const next = clone(draftRef.current);
    fn(next);
    draftRef.current = next;
    setDraftState(next);
    scheduleSave();
  }, [scheduleSave, recordHistory]);

  // ---- Canvas navigation ------------------------------------------------
  const navigateCanvas = useCallback(async (path, { select } = {}) => {
    await flushSave();
    navPending.current = true;
    if (select) setSelection(select);
    if (path === canvasPath) setNonce((n) => n + 1); // force reload if same path
    else setCanvasPath(path);
  }, [flushSave, canvasPath]);

  const reloadFull = useCallback(async () => {
    await flushSave();
    setNonce((n) => n + 1);
  }, [flushSave]);

  const reloadFragment = useCallback(async (fragment) => {
    await flushSave();
    postToCanvas('reload', { fragment });
  }, [flushSave, postToCanvas]);

  const applyHistory = useCallback((doc) => {
    draftRef.current = doc;
    setDraftState(doc);
    lastPushRef.current = 0; // don't coalesce across an undo boundary
    scheduleSave();
    syncHist();
    reloadFull();
  }, [scheduleSave, syncHist, reloadFull]);

  const undo = useCallback(() => {
    if (!histRef.current.length) return;
    futureRef.current.push(draftRef.current);
    applyHistory(histRef.current.pop());
  }, [applyHistory]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    histRef.current.push(draftRef.current);
    applyHistory(futureRef.current.pop());
  }, [applyHistory]);

  // ---- Inbound bridge messages -----------------------------------------
  const applyCanvasEdit = useCallback((path, value) => {
    const c = ctxRef.current;
    mutate((d) => {
      /* grouped: a burst of keystrokes collapses to one undo step */
      if (path === 'hero.title' || path === 'hero.subtitle') {
        const h = ensureHeader(d, c.heroTarget, galleriesById);
        h.overlay = h.overlay || {};
        h.overlay[path.split('.')[1]] = value;
      } else if (path === 'gallery.name') {
        const g = findGallery(d, c.galleryId); if (g) g.name = value;
      } else if (path === 'gallery.description') {
        const g = findGallery(d, c.galleryId); if (g) g.description = value;
      } else if (path === 'page.title') {
        const p = findPage(d, c.pageId); if (p) p.title = value;
      } else if (path.startsWith('block:')) {
        const [idxS, field] = path.slice(6).split(':');
        const p = findPage(d, c.pageId);
        if (p && p.content[+idxS]) p.content[+idxS][field === 'caption' ? 'caption' : 'text'] = value;
      }
    }, { group: true });
    if (path === 'gallery.name') postNav();
  }, [mutate, galleriesById, postNav]);

  const onCanvasSelect = useCallback((d) => {
    const c = ctxRef.current;
    if (d.region === 'hero') setSelection({ kind: 'hero', target: c.heroTarget });
    else if (d.region === 'gallery') setSelection({ kind: 'gallery', id: Number(d.id) });
    else if (d.region === 'home-grid') setSelection({ kind: 'gallery', id: Number(c.galleryId) });
    else if (d.region === 'page') setSelection({ kind: 'page', id: Number(d.id) });
    else if (d.region === 'subnav') setSelection({ kind: 'nav' });
  }, []);

  const removeBlockFromCanvas = useCallback((index) => {
    const c = ctxRef.current;
    mutate((d) => { const p = findPage(d, c.pageId); if (p) p.content.splice(index, 1); });
    reloadFragment('main');
  }, [mutate, reloadFragment]);

  const onReady = useCallback((c) => {
    if (navPending.current) {
      navPending.current = false;
      if (c.view === 'gallery' && c.galleryId) setSelection({ kind: 'gallery', id: Number(c.galleryId) });
      else if (c.view === 'page' && c.pageId) setSelection({ kind: 'page', id: Number(c.pageId) });
    }
    // Reflect current draft nav ordering/labels the moment the canvas mounts.
    setTimeout(postNav, 30);
  }, [postNav]);

  useEffect(() => {
    const onMessage = (e) => {
      const d = e.data;
      if (!d || d.source !== 'fotolio-canvas') return;
      switch (d.type) {
        case 'ready': ctxRef.current = d.ctx || {}; setCtx(d.ctx || {}); onReady(d.ctx || {}); break;
        case 'edit': applyCanvasEdit(d.path, d.value); break;
        case 'select': onCanvasSelect(d); break;
        case 'navigate': navigateCanvas(d.path); break;
        case 'block-remove': removeBlockFromCanvas(d.index); break;
        case 'shortcut': d.action === 'redo' ? redo() : undo(); break;
        default: break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [applyCanvasEdit, onCanvasSelect, navigateCanvas, removeBlockFromCanvas, onReady, undo, redo]);

  // Undo/redo keyboard shortcuts while focus is in the dashboard chrome. When
  // focus is inside the canvas iframe, editor-bridge.js forwards the same keys.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---- Operations exposed to panels ------------------------------------
  const ops = useMemo(() => ({
    // Galleries navigation
    setNavVisibility(galleryId, visible) {
      mutate((d) => { const g = findGallery(d, galleryId); if (g) g.show_in_nav = visible; });
      postNav();
      postToCanvas('pulse', { region: 'subnav' });
    },
    reorderGalleries(orderedIds) {
      mutate((d) => {
        const map = Object.fromEntries(d.galleries.map((g) => [g.id, g]));
        const home = d.galleries.filter((g) => galleriesById[g.id]?.is_home);
        const rest = orderedIds.map((id) => map[id]).filter(Boolean);
        const seen = new Set([...home, ...rest].map((g) => g.id));
        d.galleries = [...home, ...rest, ...d.galleries.filter((g) => !seen.has(g.id))];
      });
      postNav();
    },
    renameGallery(galleryId, name) {
      mutate((d) => { const g = findGallery(d, galleryId); if (g) g.name = name; }, { group: true });
      postToCanvas('set-text', { path: 'gallery.name', value: name });
      postNav();
    },
    setGalleryDescription(galleryId, description) {
      mutate((d) => { const g = findGallery(d, galleryId); if (g) g.description = description; }, { group: true });
      postToCanvas('set-text', { path: 'gallery.description', value: description });
    },

    // Gallery photos
    addPhotos(galleryId, ids) {
      mutate((d) => { const g = findGallery(d, galleryId); if (g) g.image_ids = [...new Set([...(g.image_ids || []), ...ids.map(Number)])]; });
      reloadFragment('main');
    },
    removePhoto(galleryId, imageId) {
      mutate((d) => { const g = findGallery(d, galleryId); if (g) g.image_ids = (g.image_ids || []).filter((x) => x !== Number(imageId)); });
      reloadFragment('main');
    },
    reorderPhotos(galleryId, orderedIds) {
      mutate((d) => { const g = findGallery(d, galleryId); if (g) g.image_ids = orderedIds.map(Number); });
      reloadFragment('main');
    },

    // Hero
    setHeroStyle(target, patch) {
      mutate((d) => { const h = ensureHeader(d, target, galleriesById); Object.assign(h.overlay, patch.overlay || {}); if ('parallax' in patch) h.parallax = patch.parallax; if ('height' in patch) h.height = patch.height; });
      postToCanvas('hero-style', {
        position: patch.overlay?.position, align: patch.overlay?.align,
        panel: patch.overlay?.panel, height: patch.height, parallax: patch.parallax,
      });
    },
    setHeroField(target, patch) {
      mutate((d) => { const h = ensureHeader(d, target, galleriesById); deepAssign(h, patch); });
      reloadFragment('hero');
    },
    setHeroImages(target, ids) {
      mutate((d) => {
        const h = ensureHeader(d, target, galleriesById);
        h.image_ids = ids.map(Number);
        if (h.image_ids.length < 2 && h.mode === 'slideshow') h.mode = 'single';
      });
      // A full reload so the top nav's over-hero treatment tracks a hero
      // appearing or disappearing, and the slideshow re-inits cleanly.
      reloadFull();
    },
    setHeroText(target, field, value) {
      mutate((d) => { const h = ensureHeader(d, target, galleriesById); h.overlay = h.overlay || {}; h.overlay[field] = value; }, { group: true });
      postToCanvas('set-text', { path: `hero.${field}`, value });
    },

    // Pages
    addBlock(pageId, block) {
      mutate((d) => { const p = findPage(d, pageId); if (p) p.content.push(block); });
      reloadFragment('main');
    },
    updateBlock(pageId, index, patch) {
      mutate((d) => { const p = findPage(d, pageId); if (p && p.content[index]) Object.assign(p.content[index], patch); });
      reloadFragment('main');
    },
    removeBlock(pageId, index) {
      mutate((d) => { const p = findPage(d, pageId); if (p) p.content.splice(index, 1); });
      reloadFragment('main');
    },
    reorderBlocks(pageId, orderedContent) {
      mutate((d) => { const p = findPage(d, pageId); if (p) p.content = orderedContent; });
      reloadFragment('main');
    },
    renamePage(pageId, title) {
      mutate((d) => { const p = findPage(d, pageId); if (p) p.title = title; }, { group: true });
      postToCanvas('set-text', { path: 'page.title', value: title });
    },
    setPageFlag(pageId, patch) {
      mutate((d) => { const p = findPage(d, pageId); if (p) Object.assign(p, patch); });
      reloadFull();
    },

    // Site settings
    setSite(patch, { reload = false } = {}) {
      mutate((d) => { Object.assign(d.site, patch); });
      if (reload) reloadFull();
    },
    setSocial(social) {
      mutate((d) => { d.site.settings = { ...(d.site.settings || {}), social }; });
      reloadFull();
    },

    // Global design: accent colour + per-site custom CSS. Both live in the
    // draft (so they publish with everything else) and preview live via the
    // bridge — no full reload while dragging a colour or typing CSS.
    setAccent(value) {
      mutate((d) => { d.site.settings = { ...(d.site.settings || {}), accent: value }; }, { group: true });
      postToCanvas('accent', { value });
    },
    setCustomCss(css) {
      mutate((d) => { d.site.settings = { ...(d.site.settings || {}), custom_css: css }; }, { group: true });
      postToCanvas('custom-css', { css });
    },
  }), [mutate, postNav, postToCanvas, reloadFragment, reloadFull, galleriesById]);

  // ---- Entity CRUD (galleries / pages are table-backed) -----------------
  const createGallery = useCallback(async (name) => {
    const { gallery } = await api.post('/galleries', { name });
    setGalleries((gs) => [...gs, gallery]);
    mutate((d) => { d.galleries.push({ id: gallery.id, name: gallery.name, description: gallery.description || null, show_in_nav: true, header_config: null, image_ids: [] }); });
    await navigateCanvas(gallery.slug, { select: { kind: 'gallery', id: gallery.id } });
    return gallery;
  }, [mutate, navigateCanvas]);

  const deleteGallery = useCallback(async (galleryId) => {
    await api.del(`/galleries/${galleryId}`);
    setGalleries((gs) => gs.filter((g) => g.id !== galleryId));
    mutate((d) => { d.galleries = d.galleries.filter((g) => g.id !== galleryId); });
    await navigateCanvas('', { select: { kind: 'nav' } });
  }, [mutate, navigateCanvas]);

  const createPage = useCallback(async (type) => {
    const { page } = await api.post('/pages', {
      type,
      title: type === 'about' ? 'About' : 'New page',
      content: type === 'about' ? [{ type: 'paragraph', text: 'Tell visitors about yourself and your work.' }] : [],
    });
    setPages((ps) => [...ps, page]);
    mutate((d) => { d.pages.push({ id: page.id, title: page.title, show_in_nav: true, published: true, header_config: null, content: page.content || [] }); });
    await navigateCanvas(page.slug, { select: { kind: 'page', id: page.id } });
    return page;
  }, [mutate, navigateCanvas]);

  const deletePage = useCallback(async (pageId) => {
    await api.del(`/pages/${pageId}`);
    setPages((ps) => ps.filter((p) => p.id !== pageId));
    mutate((d) => { d.pages = d.pages.filter((p) => p.id !== pageId); });
    await navigateCanvas('', { select: { kind: 'site' } });
  }, [mutate, navigateCanvas]);

  // ---- Publish / discard / preview -------------------------------------
  const publish = useCallback(async () => {
    await flushSave();
    const r = await api.post('/site/editor/publish', {});
    setDirty(false); setPublishedLive(true);
    setLastPublishedAt(r.last_published_at); setPublicUrl(r.public_url);
    toast.success('Site published.');
    refreshMe();
  }, [flushSave, toast, refreshMe]);

  const discard = useCallback(async () => {
    const r = await api.post('/site/editor/discard', {});
    setDraftState(r.draft); draftRef.current = r.draft; setDirty(false); setSaving('saved');
    await reloadFull();
    toast.info('Unpublished changes discarded.');
  }, [reloadFull, toast]);

  const openPreview = useCallback(async () => {
    await flushSave();
    const r = await api.post('/site/editor/preview-token', {});
    window.open(r.url, '_blank', 'noopener');
  }, [flushSave]);

  return {
    loading, draft, galleries, pages, images, galleriesById, pagesById, imagesById,
    ctx, selection, setSelection, saving, dirty, publishedLive, lastPublishedAt, publicUrl,
    canvasRef, canvasSrc, navigateCanvas, reloadFull, buildHref,
    ops, createGallery, deleteGallery, createPage, deletePage,
    publish, discard, openPreview,
    undo, redo, canUndo: histLen > 0, canRedo: futLen > 0,
  };
}

function deepAssign(target, patch) {
  for (const k of Object.keys(patch)) {
    if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k])) {
      target[k] = target[k] && typeof target[k] === 'object' ? { ...target[k] } : {};
      deepAssign(target[k], patch[k]);
    } else {
      target[k] = patch[k];
    }
  }
}
