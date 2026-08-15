import { useEffect, useState } from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Field, Input, Textarea, Toggle, Segmented } from '../../components/ui/Controls';
import { Icon } from '../../components/ui/Icon';
import { Sortable } from '../../components/Sortable';
import { ImagePicker } from '../../components/ImagePicker';
import { findGallery, findPage, readHeader } from './draftUtils';

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
  else panel = <SitePanel e={e} />;
  return <div key={key} className="p-4">{panel}</div>;
}

/* Site -------------------------------------------------------------------- */
function SitePanel({ e }) {
  const s = e.draft.site;
  const [title, setTitle] = useState(s.title || '');
  const [tagline, setTagline] = useState(s.tagline || '');
  const [footer, setFooter] = useState(s.settings?.footer || '');
  const social = s.settings?.social && !Array.isArray(s.settings.social) ? s.settings.social : {};
  const [instagram, setInstagram] = useState(social.instagram || '');
  const [email, setEmail] = useState(social.email || '');
  const [accent, setAccentVal] = useState(s.settings?.accent || '');
  const [css, setCss] = useState(s.settings?.custom_css || '');

  const commitSocial = () => e.ops.setSocial({ ...(social || {}), instagram, email });

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
        <Field label="Footer note">
          <Input value={footer} onChange={(ev) => setFooter(ev.target.value)} onBlur={() => footer !== (s.settings?.footer || '') && e.ops.setSite({ settings: { ...(s.settings || {}), footer } }, { reload: true })} placeholder="© Your name" />
        </Field>
        <Field label="Instagram" className="mt-3"><Input value={instagram} onChange={(ev) => setInstagram(ev.target.value)} onBlur={commitSocial} placeholder="https://instagram.com/you" /></Field>
        <Field label="Email" className="mt-3"><Input value={email} onChange={(ev) => setEmail(ev.target.value)} onBlur={commitSocial} placeholder="you@studio.com" /></Field>
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
  { type: 'image', label: 'Image', icon: 'image' },
];
function PagePanel({ e, id }) {
  const p = findPage(e.draft, id);
  const meta = e.pagesById[id] || {};
  const [title, setTitle] = useState(p?.title || '');
  const [picking, setPicking] = useState(false); // false | 'new' | index
  useEffect(() => { setTitle(p?.title || ''); }, [id]); // eslint-disable-line
  if (!p) return <PanelHead title="Page" hint="This page is no longer available." />;

  const blocks = (p.content || []).map((b, i) => ({ id: `b${i}`, i, block: b }));
  const addBlock = (type) => { if (type === 'image') setPicking('new'); else e.ops.addBlock(id, { type, text: '' }); };

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
          <Sortable items={blocks} onReorder={(next) => e.ops.reorderBlocks(id, next.map((b) => b.block))} className="space-y-1.5">
            {(row) => (
              <div className="card p-2.5 flex items-center gap-2.5">
                <span className="text-ink-faint cursor-grab flex-none"><Icon name="drag" size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-ink-faint">{row.block.type}</div>
                  <div className="text-[13px] text-ink truncate">
                    {row.block.type === 'image' ? (row.block.caption || 'Image') : (row.block.text || <span className="text-ink-faint">Empty — type on the page</span>)}
                  </div>
                </div>
                {row.block.type === 'image' && <IconButton name="image" label="Replace image" size="sm" onClick={() => setPicking(row.i)} />}
                <IconButton name="x" label="Remove block" size="sm" className="hover:text-danger" onClick={() => e.ops.removeBlock(id, row.i)} />
              </div>
            )}
          </Sortable>
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
            if (picking === 'new') e.ops.addBlock(id, { type: 'image', src, caption: imgs[0]?.title || '' });
            else e.ops.updateBlock(id, picking, { src, caption: imgs[0]?.title || '' });
            setPicking(false);
          }} />
      )}
    </div>
  );
}
