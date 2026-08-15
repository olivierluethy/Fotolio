// Helpers for reading and mutating the site draft document (see docs/EDITOR.md).
// The draft mirrors the server document: { site, galleries[], pages[] }.

export function defaultHeader() {
  return {
    mode: 'single',
    image_ids: [],
    slideshow: { autoplay: true, interval: 5000, controls: true },
    overlay: { title: '', subtitle: '', position: 'center', align: 'center', panel: false },
    animate_text: true,
    rotating_words: [],
    parallax: true,
    height: 'tall',
  };
}

export const findGallery = (draft, id) => draft.galleries.find((g) => g.id === Number(id));
export const findPage = (draft, id) => draft.pages.find((p) => p.id === Number(id));

// The header shown for a target, materialised so it can be edited. For a gallery
// with no override, seed from its auto-hero (first photo, gallery name).
export function ensureHeader(draft, target, galleriesById = {}) {
  if (target === 'home') {
    if (!draft.site.home_header) draft.site.home_header = defaultHeader();
    return draft.site.home_header;
  }
  const [kind, idStr] = target.split(':');
  const id = Number(idStr);
  if (kind === 'gallery') {
    const g = findGallery(draft, id);
    if (!g) return defaultHeader();
    if (!g.header_config) {
      const meta = galleriesById[id] || {};
      g.header_config = {
        ...defaultHeader(),
        mode: 'single',
        height: 'medium',
        image_ids: (g.image_ids || []).slice(0, 1),
        overlay: { ...defaultHeader().overlay, title: g.name || meta.name || '', subtitle: g.description || '' },
        animate_text: false,
      };
    }
    return g.header_config;
  }
  if (kind === 'page') {
    const p = findPage(draft, id);
    if (!p) return defaultHeader();
    if (!p.header_config) p.header_config = defaultHeader();
    return p.header_config;
  }
  return defaultHeader();
}

// The header to display for a target without mutating (for panel initial values).
export function readHeader(draft, target, galleriesById = {}) {
  if (target === 'home') return draft.site.home_header || defaultHeader();
  const [kind, idStr] = target.split(':');
  const id = Number(idStr);
  if (kind === 'gallery') {
    const g = findGallery(draft, id);
    if (!g) return defaultHeader();
    if (g.header_config) return g.header_config;
    const meta = galleriesById[id] || {};
    return {
      ...defaultHeader(), mode: 'single', height: 'medium',
      image_ids: (g.image_ids || []).slice(0, 1),
      overlay: { ...defaultHeader().overlay, title: g.name || meta.name || '', subtitle: g.description || '' },
      animate_text: false,
    };
  }
  if (kind === 'page') return (findPage(draft, id)?.header_config) || defaultHeader();
  return defaultHeader();
}

// Ordered secondary-nav items for the canvas (non-home galleries flagged visible).
export function navItems(draft, galleriesById, buildHref, activeSlug = '') {
  return draft.galleries
    .filter((g) => g.show_in_nav && !(galleriesById[g.id]?.is_home))
    .map((g) => {
      const meta = galleriesById[g.id] || {};
      return {
        galleryId: g.id,
        label: g.name || meta.name || 'Untitled',
        href: buildHref(meta.slug || ''),
        active: !!activeSlug && meta.slug === activeSlug,
      };
    });
}

// The path that renders a given target/entity in the canvas.
export const targetPath = (kind, slug) => (kind === 'home' ? '' : slug || '');

export function clone(doc) {
  return typeof structuredClone === 'function' ? structuredClone(doc) : JSON.parse(JSON.stringify(doc));
}
