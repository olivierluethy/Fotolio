import { useEffect, useState } from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Field, Input, Textarea, Toggle, Segmented, Select } from '../../components/ui/Controls';
import { Icon } from '../../components/ui/Icon';
import { Sortable } from '../../components/Sortable';
import { ImagePicker } from '../../components/ImagePicker';
import {
  findGallery, findPage, readHeader, readFooter, newPageBlock,
  FOOTER_FONTS, SOCIAL_NETWORKS, FOOTER_BLOCKS, newFooterBlock,
} from './draftUtils';

/* Small building blocks --------------------------------------------------- */
function PanelHead({ eyebrow, title, hint }) {
  return (
    <div className="mb-4">
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <h2 className="font-display font-bold text-lg text-ink leading-tight">{title}</h2>
      {hint && <p className="text-[13px] text-ink-muted mt-1 leading-snug">{hint}</p>}
    </div>
  );
}
function Group({ title, children, action }) {
  return (
    <section className="py-4 border-t first:border-t-0 first:pt-0">
      {title && (
        <div className="flex items-center justify-between mb-2.5">
          <div className="eyebrow">{title}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Hint({ children }) {
  return <p className="text-[12px] text-ink-faint mt-2 leading-snug flex gap-1.5"><Icon name="info" size={13} className="flex-none mt-px" /><span>{children}</span></p>;
}
function ThumbTile({ img, onRemove }) {
  return (
    <div className="relative group aspect-square rounded-md overflow-hidden border bg-surface-2">
      {img ? <img src={img.variants?.thumb?.webp} alt="" className="w-full h-full object-cover" draggable="false" />
        : <div className="w-full h-full grid place-items-center text-ink-faint"><Icon name="image" size={16} /></div>}
      {onRemove && (
        <button onClick={onRemove} className="absolute top-1 right-1 w-5 h-5 rounded grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }} aria-label="Remove"><Icon name="x" size={12} /></button>
      )}
    </div>
  );
}

/* Router ------------------------------------------------------------------ */
export function Inspector({ e }) {
  const { selection } = e;
  const key = `${selection.kind}:${selection.id ?? selection.target ?? ''}`;
  let panel;
  if (selection.kind === 'nav') panel = <NavPanel e={e} />;
  else if (selection.kind === 'pages') panel = <PagesPanel e={e} />;
  else if (selection.kind === 'gallery') panel = <GalleryPanel e={e} id={selection.id} />;
  else if (selection.kind === 'hero') panel = <HeroPanel e={e} target={selection.target} />;
  else if (selection.kind === 'page') panel = <PagePanel e={e} id={selection.id} />;
  else if (selection.kind === 'footer') panel = <FooterPanel e={e} />;
  else panel = <SitePanel e={e} />;
  return <div key={key} className="p-4">{panel}</div>;
}

/* Site -------------------------------------------------------------------- */
function SitePanel({ e }) {
  const s = e.draft.site;
  const [title, setTitle] = useState(s.title || '');
  const [tagline, setTagline] = useState(s.tagline || '');
  const [accent, setAccentVal] = useState(s.settings?.accent || '');
  const [css, setCss] = useState(s.settings?.custom_css || '');

  return (
    <div>
      <PanelHead eyebrow="Site" title="Your site" hint="The basics visitors see everywhere — the name in the top bar and footer, and your links." />
      <Group title="Identity">
        <Field label="Site name">
          <Input value={title} onChange={(ev) => setTitle(ev.target.value)} onBlur={() => title.trim() && title !== s.title && e.ops.setSite({ title: title.trim() }, { reload: true })} />
        </Field>
        <Field label="Tagline" className="mt-3" hint="A short line under your name.">
          <Input value={tagline} onChange={(ev) => setTagline(ev.target.value)} onBlur={() => tagline !== (s.tagline || '') && e.ops.setSite({ tagline }, { reload: true })} placeholder="e.g. Alpine & aerial photography" />
        </Field>
      </Group>
      <Group title="Footer & links">
        <p className="text-[13px] text-ink-muted mb-2.5 leading-snug">Your footer holds columns of text, links and social icons. Build it visually — columns, blocks, colours and spacing.</p>
        <Button variant="secondary" icon="layout" className="w-full" onClick={() => selectFooterFrom(e)}>Edit footer & links</Button>
      </Group>
      <Group title="Design">
        <Field label="Accent colour" hint="Buttons, links and highlights across your site.">
          <div className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#22B8C4'} aria-label="Accent colour"
              onChange={(ev) => { setAccentVal(ev.target.value); e.ops.setAccent(ev.target.value); }}
              className="w-9 h-9 flex-none rounded-md border bg-surface cursor-pointer p-0.5" />
            <Input value={accent} onChange={(ev) => setAccentVal(ev.target.value)} onBlur={() => e.ops.setAccent(accent.trim())} placeholder="#22B8C4" className="font-mono" />
            {accent && (
              <button onClick={() => { setAccentVal(''); e.ops.setAccent(''); }} title="Reset to default"
                className="flex-none w-9 h-9 grid place-items-center rounded-md border text-ink-muted hover:text-ink hover:bg-surface-2"><Icon name="x" size={15} /></button>
            )}
          </div>
        </Field>
      </Group>
      <Group title="Custom CSS">
        <p className="text-[12px] text-ink-faint mb-2 leading-snug">Advanced — target your site's classes. Applies to the live site, preview and this canvas; it can't affect the dashboard.</p>
        <Textarea value={css} rows={8} spellCheck={false} className="font-mono !text-[12px] leading-relaxed"
          onChange={(ev) => { setCss(ev.target.value); e.ops.setCustomCss(ev.target.value); }}
          placeholder={'.hero-title { letter-spacing: -.02em; }\n.tile img { border-radius: 12px; }'} />
      </Group>
      <Group title="Jump to">
        <JumpList e={e} />
      </Group>
    </div>
  );
}

function JumpList({ e }) {
  const home = e.galleries.find((g) => g.is_home);
  return (
    <div className="space-y-1.5">
      <JumpRow icon="home" label="Home" onClick={() => e.navigateCanvas('', { select: { kind: 'gallery', id: home?.id } })} />
      {e.galleries.filter((g) => !g.is_home).map((g) => (
        <JumpRow key={g.id} icon="grid" label={g.name} onClick={() => e.navigateCanvas(g.slug, { select: { kind: 'gallery', id: g.id } })} />
      ))}
      {e.pages.map((p) => (
        <JumpRow key={p.id} icon="file" label={p.title} onClick={() => e.navigateCanvas(p.slug, { select: { kind: 'page', id: p.id } })} />
      ))}
    </div>
  );
}
function JumpRow({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors">
      <Icon name={icon} size={16} /> <span className="truncate">{label}</span>
      <Icon name="chevronRight" size={15} className="ml-auto text-ink-faint" />
    </button>
  );
}

/* Navigation (galleries menu) — Stage 4 ----------------------------------- */
function NavPanel({ e }) {
  const [creating, setCreating] = useState(false);
  const rows = e.draft.galleries.filter((g) => !e.galleriesById[g.id]?.is_home).map((g) => ({ id: g.id, ...g }));

  const create = async () => {
    setCreating(true);
    try { await e.createGallery('New gallery'); } finally { setCreating(false); }
  };

  return (
    <div>
      <PanelHead eyebrow="Navigation" title="Gallery menu"
        hint="This is the menu visitors use to jump between your galleries. Turn a gallery on to add it; drag to set the order." />
      <Group title={`Galleries · ${rows.length}`} action={<Button size="sm" variant="secondary" icon="plus" loading={creating} onClick={create}>New</Button>}>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-faint">No galleries yet. Create one to build your menu.</p>
        ) : (
          <Sortable items={rows} onReorder={(next) => e.ops.reorderGalleries(next.map((r) => r.id))} className="space-y-2">
            {(g) => (
              <div className="card p-2.5 flex items-center gap-2.5">
                <span className="text-ink-faint cursor-grab flex-none"><Icon name="drag" size={16} /></span>
                <button className="min-w-0 flex-1 text-left" onClick={() => e.navigateCanvas(e.galleriesById[g.id]?.slug || '', { select: { kind: 'gallery', id: g.id } })}>
                  <div className="font-medium text-ink truncate text-sm">{g.name || 'Untitled'}</div>
                  <div className="text-[11px] text-ink-faint">{e.galleriesById[g.id]?.image_count ?? 0} photos · {g.show_in_nav ? 'in menu' : 'hidden'}</div>
                </button>
                <Toggle checked={g.show_in_nav} onChange={(v) => e.ops.setNavVisibility(g.id, v)} />
              </div>
            )}
          </Sortable>
        )}
        <Hint>When a gallery is <strong>on</strong>, its name appears in the menu and visitors can open it. <strong>Off</strong> keeps the gallery on your site but out of the menu — watch it slide in and out on the canvas as you flip it.</Hint>
      </Group>
    </div>
  );
}

/* Pages list -------------------------------------------------------------- */
function PagesPanel({ e }) {
  const [busy, setBusy] = useState('');
  const hasAbout = e.pages.some((p) => p.type === 'about');
  const create = async (type) => { setBusy(type); try { await e.createPage(type); } finally { setBusy(''); } };
  return (
    <div>
      <PanelHead eyebrow="Pages" title="Your pages" hint="Add an About page to introduce yourself, or custom pages for anything else. Empty pages stay hidden from visitors." />
      <Group title={`Pages · ${e.pages.length}`} action={<Button size="sm" variant="secondary" icon="plus" loading={busy === 'custom'} onClick={() => create('custom')}>New</Button>}>
        {!hasAbout && (
          <Button size="sm" variant="secondary" icon="plus" className="mb-2" loading={busy === 'about'} onClick={() => create('about')}>Add About page</Button>
        )}
        {e.pages.length === 0 ? (
          <p className="text-sm text-ink-faint">No pages yet.</p>
        ) : (
          <div className="space-y-1.5">
            {e.pages.map((p) => (
              <button key={p.id} onClick={() => e.navigateCanvas(p.slug, { select: { kind: 'page', id: p.id } })}
                className="w-full flex items-center gap-2.5 px-2.5 h-11 rounded-md text-left hover:bg-surface-2 transition-colors">
                <span className="w-8 h-8 rounded-md grid place-items-center flex-none" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                  <Icon name={p.type === 'about' ? 'info' : 'file'} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{p.title}</div>
                  <div className="text-[11px] text-ink-faint font-mono">/{p.slug}</div>
                </div>
                <Icon name="chevronRight" size={15} className="text-ink-faint" />
              </button>
            ))}
          </div>
        )}
      </Group>
    </div>
  );
}

/* Gallery ----------------------------------------------------------------- */
function GalleryPanel({ e, id }) {
  const g = findGallery(e.draft, id);
  const meta = e.galleriesById[id] || {};
  const [name, setName] = useState(g?.name || '');
  const [desc, setDesc] = useState(g?.description || '');
  const [picking, setPicking] = useState(false);
  useEffect(() => { setName(g?.name || ''); setDesc(g?.description || ''); }, [id]); // eslint-disable-line

  if (!g) return <PanelHead title="Gallery" hint="This gallery is no longer available." />;
  const photos = (g.image_ids || []).map((iid) => ({ id: iid, img: e.imagesById[iid] }));

  return (
    <div>
      <PanelHead eyebrow={meta.is_home ? 'Home gallery' : 'Gallery'} title={name || 'Untitled gallery'}
        hint="This is what visitors see when they open this gallery. Edit the title and photos here, or type directly on the page." />

      <Group title="Details">
        <Field label="Name">
          <Input value={name} onChange={(ev) => { setName(ev.target.value); }} onBlur={() => name.trim() && name !== g.name && e.ops.renameGallery(id, name.trim())} />
        </Field>
        <Field label="Description" className="mt-3" hint="Shown under the gallery title.">
          <Textarea rows={2} value={desc} onChange={(ev) => setDesc(ev.target.value)} onBlur={() => desc !== (g.description || '') && e.ops.setGalleryDescription(id, desc)} />
        </Field>
        {!meta.is_home && (
          <div className="mt-3 flex items-center justify-between">
            <Toggle checked={g.show_in_nav} onChange={(v) => e.ops.setNavVisibility(id, v)} label="Show in gallery menu" />
          </div>
        )}
      </Group>

      <Group title={`Photos · ${photos.length}`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setPicking(true)}>Add</Button>}>
        {photos.length === 0 ? (
          <p className="text-sm text-ink-faint">No photos yet. Add some from your library.</p>
        ) : (
          <Sortable items={photos} onReorder={(next) => e.ops.reorderPhotos(id, next.map((p) => p.id))} className="grid grid-cols-3 gap-2">
            {(p) => <ThumbTile img={p.img} onRemove={() => e.ops.removePhoto(id, p.id)} />}
          </Sortable>
        )}
        <Hint>Drag to set the order visitors see. Changes show on the canvas as you make them.</Hint>
      </Group>

      <Group title="Hero">
        <Button variant="secondary" icon="layout" className="w-full" onClick={() => e.setSelection({ kind: 'hero', target: `gallery:${id}` })}>Edit this gallery’s hero</Button>
      </Group>

      {!meta.is_home && (
        <Group>
          <Button variant="ghost" icon="trash" className="!text-danger" onClick={async () => {
            if (confirm(`Delete the “${g.name}” gallery? Photos stay in your library.`)) await e.deleteGallery(id);
          }}>Delete gallery</Button>
        </Group>
      )}

      {picking && (
        <ImagePicker open title="Add photos" excludeIds={g.image_ids || []} onClose={() => setPicking(false)}
          onConfirm={(ids) => { e.ops.addPhotos(id, ids); setPicking(false); }} />
      )}
    </div>
  );
}

/* Hero — Stage 5 ---------------------------------------------------------- */
const HERO_LABEL = { home: 'Home hero', gallery: 'Gallery hero', page: 'Page hero' };
function HeroPanel({ e, target }) {
  const [kind] = target.split(':');
  const h = readHeader(e.draft, target, e.galleriesById);
  const [picking, setPicking] = useState(false);
  const images = (h.image_ids || []).map((iid) => ({ id: iid, img: e.imagesById[iid] }));
  const [title, setTitle] = useState(h.overlay?.title || '');
  const [subtitle, setSubtitle] = useState(h.overlay?.subtitle || '');
  useEffect(() => { setTitle(h.overlay?.title || ''); setSubtitle(h.overlay?.subtitle || ''); }, [target]); // eslint-disable-line

  const isSlideshow = h.mode === 'slideshow';
  return (
    <div>
      <PanelHead eyebrow={HERO_LABEL[kind]} title="Hero"
        hint="The big banner at the top. Change it here and watch the real hero update. Click the title on the canvas to type over it." />

      <Group title="Image">
        <Segmented value={h.mode} onChange={(v) => e.ops.setHeroField(target, { mode: v })}
          options={[{ value: 'single', label: 'One image' }, { value: 'slideshow', label: 'Slideshow' }]} />
        <div className="mt-3">
          {images.length === 0 ? (
            <Button size="sm" variant="secondary" icon="image" onClick={() => setPicking(true)}>Choose image</Button>
          ) : (
            <>
              <Sortable items={images} onReorder={(next) => e.ops.setHeroImages(target, next.map((p) => p.id))} className="grid grid-cols-4 gap-2">
                {(p) => <ThumbTile img={p.img} onRemove={() => e.ops.setHeroImages(target, images.filter((x) => x.id !== p.id).map((x) => x.id))} />}
              </Sortable>
              <button className="link text-[13px] mt-2" onClick={() => setPicking(true)}>Choose images…</button>
            </>
          )}
        </div>
        {isSlideshow && images.length > 1 && (
          <div className="mt-3 pt-3 border-t space-y-3">
            <Toggle checked={!!h.slideshow?.autoplay} onChange={(v) => e.ops.setHeroField(target, { slideshow: { autoplay: v } })} label="Play automatically" />
            {h.slideshow?.autoplay && (
              <Field label={`Change every ${(((h.slideshow?.interval) || 5000) / 1000).toFixed(1)}s`}>
                <input type="range" min="2000" max="10000" step="500" value={h.slideshow?.interval || 5000}
                  onChange={(ev) => e.ops.setHeroField(target, { slideshow: { interval: +ev.target.value } })} className="w-full accent-[var(--accent)]" />
              </Field>
            )}
            <Toggle checked={h.slideshow?.controls !== false} onChange={(v) => e.ops.setHeroField(target, { slideshow: { controls: v } })} label="Show arrows & dots" />
          </div>
        )}
      </Group>

      <Group title="Overlay text">
        <Field label="Title">
          <Input value={title} onChange={(ev) => { setTitle(ev.target.value); e.ops.setHeroText(target, 'title', ev.target.value); }} placeholder={e.draft.site.title} />
        </Field>
        <Field label="Subtitle" className="mt-3">
          <Input value={subtitle} onChange={(ev) => { setSubtitle(ev.target.value); e.ops.setHeroText(target, 'subtitle', ev.target.value); }} />
        </Field>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Position">
            <Segmented value={h.overlay?.position || 'center'} onChange={(v) => e.ops.setHeroStyle(target, { overlay: { position: v } })}
              options={[{ value: 'top', label: 'Top' }, { value: 'center', label: 'Mid' }, { value: 'bottom', label: 'Low' }]} />
          </Field>
          <Field label="Align">
            <Segmented value={h.overlay?.align || 'center'} onChange={(v) => e.ops.setHeroStyle(target, { overlay: { align: v } })}
              options={[{ value: 'left', label: 'L' }, { value: 'center', label: 'C' }, { value: 'right', label: 'R' }]} />
          </Field>
        </div>
        <div className="mt-3">
          <Toggle checked={!!h.overlay?.panel} onChange={(v) => e.ops.setHeroStyle(target, { overlay: { panel: v } })} label="Add a backdrop behind text" />
          <Hint>Turn on if the text is hard to read over a bright photo.</Hint>
        </div>
      </Group>

      <Group title="Motion & size">
        <div className="space-y-3">
          <Toggle checked={!!h.animate_text} onChange={(v) => e.ops.setHeroField(target, { animate_text: v })} label="Animated words reveal" />
          {h.animate_text && <RotatingWords e={e} target={target} words={h.rotating_words || []} />}
          <Toggle checked={!!h.parallax} onChange={(v) => e.ops.setHeroStyle(target, { parallax: v })} label="Parallax scrolling" />
          <Field label="Height">
            <Segmented value={h.height || 'tall'} onChange={(v) => e.ops.setHeroStyle(target, { height: v })}
              options={[{ value: 'medium', label: 'Medium' }, { value: 'tall', label: 'Tall' }, { value: 'full', label: 'Full' }]} />
          </Field>
        </div>
      </Group>

      {picking && (
        <ImagePicker open multiple title="Choose hero images" onClose={() => setPicking(false)}
          onConfirm={(ids) => { e.ops.setHeroImages(target, ids); setPicking(false); }} />
      )}
    </div>
  );
}

function RotatingWords({ e, target, words }) {
  const [list, setList] = useState(() => words.map((t, i) => ({ id: `w${i}`, text: t })));
  useEffect(() => { setList(words.map((t, i) => ({ id: `w${i}`, text: t }))); }, [target]); // eslint-disable-line
  const commit = (next) => e.ops.setHeroField(target, { rotating_words: next.map((x) => x.text.trim()).filter(Boolean) });
  const add = () => setList((l) => [...l, { id: `n${l.length}-${Date.now()}`, text: '' }]);
  const remove = (id) => { const next = list.filter((x) => x.id !== id); setList(next); commit(next); };
  const setText = (id, text) => setList((l) => l.map((x) => (x.id === id ? { ...x, text } : x)));

  return (
    <Field label="Rotating words" hint="Each phrase rises and fades in turn. Click a word on the canvas to edit it in place.">
      <div className="space-y-1.5">
        {list.map((row) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <Input value={row.text} onChange={(ev) => setText(row.id, ev.target.value)} onBlur={() => commit(list)} placeholder="Add a phrase…" />
            <button onClick={() => remove(row.id)} className="flex-none w-8 h-8 grid place-items-center rounded-md text-ink-faint hover:text-danger" aria-label="Remove phrase"><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      <button className="link text-[13px] mt-2" onClick={add}>+ Add word</button>
    </Field>
  );
}

/* Page — Stage 6 ---------------------------------------------------------- */
const BLOCK_ADDERS = [
  { type: 'heading', label: 'Heading', icon: 'layout' },
  { type: 'subheading', label: 'Subheading', icon: 'layout' },
  { type: 'paragraph', label: 'Paragraph', icon: 'file' },
  { type: 'quote', label: 'Quote', icon: 'edit' },
  { type: 'table', label: 'Table', icon: 'grid' },
  { type: 'image', label: 'Image', icon: 'image' },
];
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `H${n}` }));
const TEXT_ALIGN = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }];
const IMAGE_ALIGN = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }, { value: 'full', label: 'Full' }];

function PagePanel({ e, id }) {
  const p = findPage(e.draft, id);
  const meta = e.pagesById[id] || {};
  const [title, setTitle] = useState(p?.title || '');
  const [picking, setPicking] = useState(false); // false | 'new' | index
  const [openBlock, setOpenBlock] = useState(null); // index whose settings are open
  useEffect(() => { setTitle(p?.title || ''); setOpenBlock(null); }, [id]); // eslint-disable-line
  if (!p) return <PanelHead title="Page" hint="This page is no longer available." />;

  const blocks = (p.content || []).map((b, i) => ({ id: `b${i}`, i, block: b }));
  const addBlock = (type) => { if (type === 'image') setPicking('new'); else e.ops.addBlock(id, newPageBlock(type)); };

  return (
    <div>
      <PanelHead eyebrow={meta.type === 'about' ? 'About page' : 'Page'} title={title || 'Untitled page'}
        hint="Type directly on the page to edit any text. Use this panel to add, reorder or remove blocks." />

      <Group title="Details">
        <Field label="Title">
          <Input value={title} onChange={(ev) => setTitle(ev.target.value)} onBlur={() => title.trim() && title !== p.title && e.ops.renamePage(id, title.trim())} />
        </Field>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <Toggle checked={p.published} onChange={(v) => e.ops.setPageFlag(id, { published: v })} label="Published" />
          <Toggle checked={p.show_in_nav} onChange={(v) => e.ops.setPageFlag(id, { show_in_nav: v })} label="In top menu" />
        </div>
        {!p.published && <Hint>This page is hidden from visitors until you turn Published on.</Hint>}
      </Group>

      <Group title={`Blocks · ${blocks.length}`}>
        {blocks.length === 0 ? (
          <p className="text-sm text-ink-faint">Empty page. Add a block below — it appears on the canvas right away.</p>
        ) : (
          <Sortable items={blocks} onReorder={(next) => { setOpenBlock(null); e.ops.reorderBlocks(id, next.map((b) => b.block)); }} className="space-y-1.5">
            {(row) => (
              <div className="card p-2.5 flex items-center gap-2.5">
                <span className="text-ink-faint cursor-grab flex-none"><Icon name="drag" size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-ink-faint">{blockLabel(row.block)}</div>
                  <div className="text-[13px] text-ink truncate">{blockPreview(row.block)}</div>
                </div>
                {row.block.type === 'image' && <IconButton name="image" label="Replace image" size="sm" onClick={() => setPicking(row.i)} />}
                <IconButton name="settings" label="Block settings" size="sm" className={openBlock === row.i ? '!text-accent' : ''}
                  onClick={() => setOpenBlock((o) => (o === row.i ? null : row.i))} />
                <IconButton name="x" label="Remove block" size="sm" className="hover:text-danger" onClick={() => { if (openBlock === row.i) setOpenBlock(null); e.ops.removeBlock(id, row.i); }} />
              </div>
            )}
          </Sortable>
        )}
        {openBlock != null && p.content[openBlock] && (
          <div className="mt-2 card p-3 border-accent/40" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border))' }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="eyebrow">{blockLabel(p.content[openBlock])} settings</div>
              <button onClick={() => setOpenBlock(null)} className="text-ink-faint hover:text-ink" aria-label="Close"><Icon name="x" size={14} /></button>
            </div>
            <BlockSettings key={openBlock} e={e} pageId={id} index={openBlock} block={p.content[openBlock]} onReplace={() => setPicking(openBlock)} />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {BLOCK_ADDERS.map((b) => (
            <Button key={b.type} size="sm" variant="secondary" icon="plus" onClick={() => addBlock(b.type)}>{b.label}</Button>
          ))}
        </div>
      </Group>

      <Group>
        <Button variant="ghost" icon="trash" className="!text-danger" onClick={async () => {
          if (confirm(`Delete the “${p.title}” page?`)) await e.deletePage(id);
        }}>Delete page</Button>
      </Group>

      {picking !== false && (
        <ImagePicker open multiple={false} title="Insert image" onClose={() => setPicking(false)}
          onConfirm={(ids, imgs) => {
            const src = imgs[0]?.variants?.large?.jpg || imgs[0]?.variants?.medium?.jpg;
            if (picking === 'new') e.ops.addBlock(id, { ...newPageBlock('image'), src, caption: imgs[0]?.title || '' });
            else e.ops.updateBlock(id, picking, { src, caption: imgs[0]?.title || '' });
            setPicking(false);
          }} />
      )}
    </div>
  );
}

function blockLabel(b) {
  if (b.type === 'heading') return `Heading H${b.level || 2}`;
  return b.type;
}
function blockPreview(b) {
  if (b.type === 'image') return b.caption || 'Image';
  if (b.type === 'table') { const rows = b.rows || []; return `${rows.length}×${rows[0]?.length || 0} table`; }
  return b.text || <span className="text-ink-faint">Empty — type on the page</span>;
}

// A range slider that only commits (fires a canvas re-render) when you release,
// so dragging feels smooth instead of firing a fragment reload per tick.
function RangeCommit({ min, max, step = 1, value, onCommit, label }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div>
      {label && <div className="label">{label(v)}</div>}
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(ev) => setV(+ev.target.value)}
        onMouseUp={(ev) => onCommit(+ev.target.value)}
        onTouchEnd={(ev) => onCommit(+ev.target.value)}
        onKeyUp={(ev) => onCommit(+ev.target.value)}
        className="w-full accent-[var(--accent)]" />
    </div>
  );
}

function BlockSettings({ e, pageId, index, block, onReplace }) {
  const update = (patch) => e.ops.updateBlock(pageId, index, patch);
  const type = block.type;
  if (type === 'heading') {
    return (
      <div className="space-y-2.5">
        <Field label="Level"><Segmented value={String(block.level || 2)} onChange={(v) => update({ level: +v })} options={HEADING_LEVELS} /></Field>
        <Field label="Alignment"><Segmented value={block.align || 'left'} onChange={(v) => update({ align: v })} options={TEXT_ALIGN} /></Field>
      </div>
    );
  }
  if (type === 'subheading' || type === 'paragraph' || type === 'quote') {
    return <Field label="Alignment"><Segmented value={block.align || 'left'} onChange={(v) => update({ align: v })} options={TEXT_ALIGN} /></Field>;
  }
  if (type === 'image') return <ImageBlockSettings block={block} update={update} onReplace={onReplace} />;
  if (type === 'table') return <TableEditor block={block} update={update} />;
  return null;
}

function ImageBlockSettings({ block, update, onReplace }) {
  const border = block.border || { width: 0, color: '', radius: 0 };
  const setBorder = (patch) => update({ border: { ...border, ...patch } });
  return (
    <div className="space-y-2.5">
      <Field label="Position & size"><Segmented value={block.align || 'center'} onChange={(v) => update({ align: v })} options={IMAGE_ALIGN} /></Field>
      {block.align !== 'full' && (
        <RangeCommit min={20} max={100} step={5} value={block.width ?? 100} onCommit={(v) => update({ width: v })} label={(v) => `Width · ${v}%`} />
      )}
      <div className="grid grid-cols-2 gap-3 items-end">
        <RangeCommit min={0} max={12} value={border.width || 0} onCommit={(v) => setBorder({ width: v })} label={(v) => `Border · ${v}px`} />
        <ColorField label="Border colour" value={border.color || ''} onChange={(v) => setBorder({ color: v })} />
      </div>
      <RangeCommit min={0} max={40} value={border.radius || 0} onCommit={(v) => setBorder({ radius: v })} label={(v) => `Corner radius · ${v}px`} />
      <button className="link text-[13px]" onClick={onReplace}>Replace image…</button>
    </div>
  );
}

function TableEditor({ block, update }) {
  const [rows, setRows] = useState(() => (block.rows || []).map((r) => r.slice()));
  useEffect(() => { setRows((block.rows || []).map((r) => r.slice())); }, [block]); // eslint-disable-line
  const cols = rows[0]?.length || 0;
  const commit = (next) => update({ rows: next });
  const setCell = (ri, ci, val) => setRows((rs) => rs.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r)));
  const addRow = () => { const next = [...rows, Array(cols || 1).fill('')]; setRows(next); commit(next); };
  const addCol = () => { const next = rows.map((r) => [...r, '']); setRows(next); commit(next); };
  const removeRow = (ri) => { const next = rows.filter((_, i) => i !== ri); setRows(next); commit(next); };
  const removeCol = () => { const next = rows.map((r) => r.slice(0, -1)); setRows(next); commit(next); };
  return (
    <div className="space-y-2.5">
      <Toggle checked={!!block.header} onChange={(v) => update({ header: v })} label="First row is a header" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-0.5">
                    <input value={cell} onChange={(ev) => setCell(ri, ci, ev.target.value)} onBlur={() => commit(rows)}
                      className="input !h-8 !px-1.5 !text-[12px] w-full min-w-[64px]" placeholder={block.header && ri === 0 ? 'Header' : ''} />
                  </td>
                ))}
                <td className="p-0.5 align-middle">
                  <button onClick={() => removeRow(ri)} disabled={rows.length <= 1} aria-label="Remove row"
                    className="w-6 h-6 grid place-items-center text-ink-faint hover:text-danger disabled:opacity-30"><Icon name="x" size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" icon="plus" onClick={addRow}>Row</Button>
        <Button size="sm" variant="secondary" icon="plus" onClick={addCol}>Column</Button>
        {cols > 1 && <Button size="sm" variant="ghost" onClick={removeCol}>Remove last column</Button>}
      </div>
    </div>
  );
}

/* Footer ------------------------------------------------------------------ */
// Select + reveal the footer on the canvas (used from the Site panel button).
function selectFooterFrom(e) {
  e.setSelection({ kind: 'footer' });
  e.postToCanvas('select', { region: 'footer' });
  e.postToCanvas('scroll-to', { region: 'footer' });
}

function ColorField({ label, value, onChange }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value || '');
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" value={valid ? value : '#111111'} aria-label={label}
          onChange={(ev) => onChange(ev.target.value)}
          className="w-8 h-8 flex-none rounded-md border bg-surface cursor-pointer p-0.5" />
        {value ? (
          <button onClick={() => onChange('')} title="Clear"
            className="flex-none w-8 h-8 grid place-items-center rounded-md border text-ink-muted hover:text-ink hover:bg-surface-2"><Icon name="x" size={14} /></button>
        ) : <span className="text-[11px] text-ink-faint">auto</span>}
      </div>
    </Field>
  );
}

function FooterPanel({ e }) {
  const f = readFooter(e.draft);
  const st = f.style;
  useEffect(() => {
    e.postToCanvas('select', { region: 'footer' });
    e.postToCanvas('scroll-to', { region: 'footer' });
  }, []); // eslint-disable-line
  const setStyle = (patch) => e.ops.setFooterStyle(patch);

  return (
    <div>
      <PanelHead eyebrow="Footer" title="Footer"
        hint="The band at the very bottom. Build it from columns and blocks, then style the whole thing. Click any footer text on the canvas to edit it in place." />

      <Group title="Layout">
        <Field label="Columns">
          <Segmented value={String(f.columns.length)} onChange={(v) => e.ops.setFooterColumns(+v)}
            options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
        </Field>
        <Field label="Alignment" className="mt-3">
          <Segmented value={st.align} onChange={(v) => setStyle({ align: v })}
            options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
        </Field>
      </Group>

      {f.columns.map((col, ci) => (
        <FooterColumn key={ci} e={e} col={col} ci={ci} single={f.columns.length === 1} />
      ))}

      <Group title="Style">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Font"><Segmented value={st.font_family} onChange={(v) => setStyle({ font_family: v })} options={FOOTER_FONTS} /></Field>
          <Field label={`Size · ${st.font_size}px`}>
            <input type="range" min="11" max="20" value={st.font_size} onChange={(ev) => setStyle({ font_size: +ev.target.value })} className="w-full accent-[var(--accent)]" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <ColorField label="Background" value={st.bg} onChange={(v) => setStyle({ bg: v })} />
          <ColorField label="Text" value={st.color} onChange={(v) => setStyle({ color: v })} />
          <ColorField label="Links" value={st.link_color} onChange={(v) => setStyle({ link_color: v })} />
        </div>
        <Field label={`Vertical padding · ${st.padding_y}px`} className="mt-3">
          <input type="range" min="0" max="120" step="4" value={st.padding_y} onChange={(ev) => setStyle({ padding_y: +ev.target.value })} className="w-full accent-[var(--accent)]" />
        </Field>
        <div className="grid grid-cols-2 gap-3 mt-3 items-end">
          <Field label={`Top border · ${st.border_top_width}px`}>
            <input type="range" min="0" max="6" value={st.border_top_width} onChange={(ev) => setStyle({ border_top_width: +ev.target.value })} className="w-full accent-[var(--accent)]" />
          </Field>
          <ColorField label="Border colour" value={st.border_top_color} onChange={(v) => setStyle({ border_top_color: v })} />
        </div>
      </Group>

      <Group title="Credit">
        <Toggle checked={f.show_credit} onChange={(v) => e.ops.setFooterCredit(v)} label="Show “Made with Fotolio”" />
        <Hint>A small credit line under the columns. You’re free to turn it off.</Hint>
      </Group>
    </div>
  );
}

function FooterColumn({ e, col, ci, single }) {
  const [adding, setAdding] = useState(false);
  const blocks = col.blocks || [];
  return (
    <Group title={single ? 'Blocks' : `Column ${ci + 1}`}
      action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setAdding((a) => !a)}>Add</Button>}>
      {adding && (
        <div className="flex flex-wrap gap-1 mb-2.5 p-2 rounded-md bg-surface-2">
          {FOOTER_BLOCKS.map((b) => (
            <Button key={b.type} size="sm" variant="ghost" icon={b.icon}
              onClick={() => { e.ops.addFooterBlock(ci, newFooterBlock(b.type)); setAdding(false); }}>{b.label}</Button>
          ))}
        </div>
      )}
      {blocks.length === 0 ? (
        <p className="text-sm text-ink-faint">Empty column. Add a block above.</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b, bi) => (
            <FooterBlockRow key={`${bi}:${b.type}`} e={e} ci={ci} bi={bi} block={b} count={blocks.length} />
          ))}
        </div>
      )}
    </Group>
  );
}

function FooterBlockRow({ e, ci, bi, block, count }) {
  const type = block.type;
  const move = (dir) => e.ops.moveFooterBlock(ci, bi, dir);
  return (
    <div className="card p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wide text-ink-faint flex-1">{type}</span>
        <button disabled={bi === 0} onClick={() => move(-1)} aria-label="Move up"
          className="w-6 h-6 grid place-items-center rounded text-ink-faint hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"><Icon name="chevronDown" size={14} className="rotate-180" /></button>
        <button disabled={bi === count - 1} onClick={() => move(1)} aria-label="Move down"
          className="w-6 h-6 grid place-items-center rounded text-ink-faint hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"><Icon name="chevronDown" size={14} /></button>
        <button onClick={() => e.ops.removeFooterBlock(ci, bi)} aria-label="Remove block"
          className="w-6 h-6 grid place-items-center rounded text-ink-faint hover:text-danger"><Icon name="x" size={14} /></button>
      </div>
      <FooterBlockBody e={e} ci={ci} bi={bi} block={block} />
    </div>
  );
}

function FooterBlockBody({ e, ci, bi, block }) {
  const type = block.type;
  const update = (patch) => e.ops.updateFooterBlock(ci, bi, patch);

  if (type === 'heading' || type === 'text') {
    return <FooterTextEditor block={block} multiline={type === 'text'} onCommit={(text) => update({ text })} />;
  }
  if (type === 'links') return <FooterLinksEditor block={block} onCommit={update} />;
  if (type === 'social') return <FooterSocialEditor block={block} onCommit={(items) => update({ items })} />;
  if (type === 'image') return <FooterImageEditor e={e} block={block} onCommit={update} />;
  if (type === 'spacer') {
    return (
      <Field label={`Height · ${block.size ?? 16}px`}>
        <input type="range" min="4" max="120" step="4" value={block.size ?? 16} onChange={(ev) => update({ size: +ev.target.value })} className="w-full accent-[var(--accent)]" />
      </Field>
    );
  }
  return <p className="text-[12px] text-ink-faint">A horizontal divider line.</p>;
}

function FooterTextEditor({ block, multiline, onCommit }) {
  const [text, setText] = useState(block.text || '');
  useEffect(() => { setText(block.text || ''); }, [block]);
  const commit = () => { if (text !== (block.text || '')) onCommit(text); };
  const Cmp = multiline ? Textarea : Input;
  return <Cmp value={text} rows={multiline ? 2 : undefined} onChange={(ev) => setText(ev.target.value)} onBlur={commit}
    placeholder={multiline ? 'A line of text…' : 'Heading'} />;
}

function FooterLinksEditor({ block, onCommit }) {
  const [items, setItems] = useState(() => (block.items?.length ? block.items : [{ label: '', href: '' }]));
  useEffect(() => { setItems(block.items?.length ? block.items : [{ label: '', href: '' }]); }, [block]);
  const commit = (next) => onCommit({ items: next.filter((it) => (it.label || '').trim() || (it.href || '').trim()) });
  const setAt = (i, patch) => setItems((l) => l.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = () => setItems((l) => [...l, { label: '', href: '' }]);
  const remove = (i) => { const next = items.filter((_, j) => j !== i); setItems(next); commit(next); };
  return (
    <div className="space-y-2">
      <Toggle checked={!!block.inline} onChange={(v) => onCommit({ inline: v })} label="Lay out in a row" />
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={it.label} onChange={(ev) => setAt(i, { label: ev.target.value })} onBlur={() => commit(items)} placeholder="Label" className="flex-1" />
          <Input value={it.href} onChange={(ev) => setAt(i, { href: ev.target.value })} onBlur={() => commit(items)} placeholder="https://…" className="flex-1" />
          <button onClick={() => remove(i)} aria-label="Remove link" className="flex-none w-8 h-8 grid place-items-center rounded-md text-ink-faint hover:text-danger"><Icon name="x" size={14} /></button>
        </div>
      ))}
      <button className="link text-[13px]" onClick={add}>+ Add link</button>
    </div>
  );
}

function FooterSocialEditor({ block, onCommit }) {
  const items = block.items && !Array.isArray(block.items) ? block.items : {};
  const present = SOCIAL_NETWORKS.filter((n) => n.key in items);
  const missing = SOCIAL_NETWORKS.filter((n) => !(n.key in items));
  const [drafts, setDrafts] = useState(items);
  useEffect(() => { setDrafts(items); }, [block]); // eslint-disable-line
  const commit = (next) => {
    const cleaned = {};
    for (const [k, v] of Object.entries(next)) if ((v || '').trim()) cleaned[k] = v.trim();
    onCommit(cleaned);
  };
  const setAt = (key, val) => setDrafts((d) => ({ ...d, [key]: val }));
  const addNetwork = (key) => { const next = { ...drafts, [key]: '' }; setDrafts(next); };
  const removeNetwork = (key) => { const next = { ...drafts }; delete next[key]; setDrafts(next); commit(next); };

  return (
    <div className="space-y-2">
      {present.length === 0 && <p className="text-[12px] text-ink-faint">No networks yet — add one below.</p>}
      {present.map((n) => (
        <div key={n.key} className="flex items-center gap-1.5">
          <span className="text-[12px] w-20 flex-none text-ink-muted">{n.label}</span>
          <Input value={drafts[n.key] ?? ''} onChange={(ev) => setAt(n.key, ev.target.value)} onBlur={() => commit(drafts)}
            placeholder={n.key === 'email' ? 'you@studio.com' : n.key === 'phone' ? '+41 …' : 'URL or handle'} className="flex-1" />
          <button onClick={() => removeNetwork(n.key)} aria-label="Remove" className="flex-none w-8 h-8 grid place-items-center rounded-md text-ink-faint hover:text-danger"><Icon name="x" size={14} /></button>
        </div>
      ))}
      {missing.length > 0 && (
        <Select value="" onChange={(ev) => ev.target.value && addNetwork(ev.target.value)}>
          <option value="">Add a network…</option>
          {missing.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
        </Select>
      )}
    </div>
  );
}

function FooterImageEditor({ e, block, onCommit }) {
  const [picking, setPicking] = useState(false);
  const [alt, setAlt] = useState(block.alt || '');
  const [href, setHref] = useState(block.href || '');
  useEffect(() => { setAlt(block.alt || ''); setHref(block.href || ''); }, [block]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {block.src ? <img src={block.src} alt="" className="w-12 h-12 object-cover rounded border" /> : <div className="w-12 h-12 rounded border grid place-items-center text-ink-faint bg-surface-2"><Icon name="image" size={16} /></div>}
        <Button size="sm" variant="secondary" icon="image" onClick={() => setPicking(true)}>{block.src ? 'Replace' : 'Choose'}</Button>
        {block.src && <button className="link text-[13px]" onClick={() => onCommit({ src: '' })}>Remove</button>}
      </div>
      <Field label={`Width · ${block.width ?? 120}px`}>
        <input type="range" min="24" max="400" step="4" value={block.width ?? 120} onChange={(ev) => onCommit({ width: +ev.target.value })} className="w-full accent-[var(--accent)]" />
      </Field>
      <Input value={alt} onChange={(ev) => setAlt(ev.target.value)} onBlur={() => alt !== (block.alt || '') && onCommit({ alt })} placeholder="Alt text" />
      <Input value={href} onChange={(ev) => setHref(ev.target.value)} onBlur={() => href !== (block.href || '') && onCommit({ href })} placeholder="Link (optional)" />
      {picking && (
        <ImagePicker open multiple={false} title="Choose footer image" onClose={() => setPicking(false)}
          onConfirm={(ids, imgs) => {
            const src = imgs[0]?.variants?.medium?.jpg || imgs[0]?.variants?.large?.jpg || imgs[0]?.variants?.thumb?.jpg;
            onCommit({ src, alt: imgs[0]?.title || alt });
            setPicking(false);
          }} />
      )}
    </div>
  );
}
