import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { PageHead } from './Upload';
import { Button, Spinner, IconButton } from '../components/ui/Button';
import { Field, Input, Textarea, Toggle, Select, EmptyState } from '../components/ui/Controls';
import { Icon } from '../components/ui/Icon';
import { Sortable } from '../components/Sortable';
import { ImagePicker } from '../components/ImagePicker';
import { classNames } from '../lib/format';

const BLOCK_TYPES = [
  { value: 'heading', label: 'Heading' },
  { value: 'subheading', label: 'Subheading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'quote', label: 'Quote' },
  { value: 'image', label: 'Image' },
];

export default function Pages() {
  const toast = useToast();
  const [pages, setPages] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const load = () => api.get('/pages').then((d) => {
    setPages(d.pages);
    setActiveId((cur) => cur ?? d.pages[0]?.id ?? null);
  });
  useEffect(() => { load().catch(() => setPages([])); }, []);

  const hasAbout = (pages || []).some((p) => p.type === 'about');

  const create = async (type) => {
    try {
      const { page } = await api.post('/pages', {
        type,
        title: type === 'about' ? 'About' : 'New page',
        content: type === 'about'
          ? [{ type: 'paragraph', text: 'Tell visitors about yourself and your work.' }]
          : [],
      });
      toast.success(`${type === 'about' ? 'About' : 'Page'} created.`);
      await load();
      setActiveId(page.id);
    } catch (e) { toast.error(e.message); }
  };

  if (!pages) return <div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>;

  const active = pages.find((p) => p.id === activeId);

  return (
    <div>
      <PageHead
        title="Pages"
        subtitle="Add an About page and any custom content pages. Empty pages are never published for you."
        action={
          <div className="flex gap-2">
            {!hasAbout && <Button variant="secondary" icon="plus" onClick={() => create('about')}>Add About</Button>}
            <Button icon="plus" onClick={() => create('custom')}>New page</Button>
          </div>
        }
      />

      {pages.length === 0 ? (
        <EmptyState icon={<Icon name="file" size={26} />} title="No pages yet"
          action={<div className="flex gap-2"><Button variant="secondary" onClick={() => create('about')}>Add About page</Button><Button onClick={() => create('custom')}>New page</Button></div>}>
          Pages are optional. Add an About page to introduce yourself, or custom pages for anything else.
        </EmptyState>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-2">
            {pages.map((p) => (
              <button key={p.id} onClick={() => setActiveId(p.id)}
                className={classNames('w-full text-left card p-3 flex items-center gap-3', activeId === p.id && 'ring-2 ring-accent')}>
                <span className="w-9 h-9 rounded-md grid place-items-center flex-none" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                  <Icon name={p.type === 'about' ? 'info' : 'file'} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{p.title}</div>
                  <div className="text-[12px] text-ink-faint font-mono">/{p.slug}{!p.published && ' · draft'}</div>
                </div>
              </button>
            ))}
          </div>

          <div>
            {active
              ? <PageEditor key={active.id} page={active} onChanged={(pg) => { setPages((ps) => ps.map((x) => (x.id === pg.id ? pg : x))); }} onDeleted={() => { setActiveId(null); load(); }} />
              : <div className="text-ink-muted">Select a page.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function PageEditor({ page, onChanged, onDeleted }) {
  const toast = useToast();
  const [title, setTitle] = useState(page.title);
  const [blocks, setBlocks] = useState(page.content || []);
  const [published, setPublished] = useState(page.published);
  const [showInNav, setShowInNav] = useState(page.show_in_nav);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = (fn) => (...a) => { fn(...a); setDirty(true); };

  const addBlock = mark((type) => setBlocks((b) => [...b, { id: Date.now() + Math.random(), type, text: '' }]));
  const updateBlock = mark((idx, patch) => setBlocks((b) => b.map((x, i) => (i === idx ? { ...x, ...patch } : x))));
  const removeBlock = mark((idx) => setBlocks((b) => b.filter((_, i) => i !== idx)));

  const save = async () => {
    setSaving(true);
    try {
      const clean = blocks.map(({ id, ...rest }) => rest);
      const { page: pg } = await api.patch(`/pages/${page.id}`, { title, content: clean, published, show_in_nav: showInNav });
      onChanged(pg);
      setDirty(false);
      toast.success('Page saved.');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete the “${page.title}” page?`)) return;
    try { await api.del(`/pages/${page.id}`); toast.info('Page deleted.'); onDeleted(); }
    catch (e) { toast.error(e.message); }
  };

  // ensure blocks have ids for sortable
  const withIds = blocks.map((b, i) => (b.id ? b : { ...b, id: `b${i}` }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="font-display font-bold text-2xl bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none w-full pb-1 text-ink" />
        <div className="flex items-center gap-1">
          <IconButton name="trash" label="Delete page" onClick={del} className="hover:text-danger" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 py-3 border-y mb-4">
        <Toggle checked={published} onChange={(v) => { setPublished(v); setDirty(true); }} label="Published" />
        <Toggle checked={showInNav} onChange={(v) => { setShowInNav(v); setDirty(true); }} label="Show in navigation" />
      </div>

      <Sortable
        items={withIds}
        onReorder={mark((next) => setBlocks(next))}
        className="space-y-2.5"
        render={(block) => {
          const idx = withIds.findIndex((b) => b.id === block.id);
          return <BlockRow block={block} onChange={(patch) => updateBlock(idx, patch)} onRemove={() => removeBlock(idx)} onPickImage={() => setPicking(idx)} />;
        }}
      />

      <div className="flex flex-wrap gap-2 mt-4">
        {BLOCK_TYPES.map((t) => (
          <Button key={t.value} size="sm" variant="secondary" icon="plus" onClick={() => t.value === 'image' ? setPicking('new') : addBlock(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
        {dirty && <span className="text-[12px] text-ink-faint mr-auto">Unsaved changes</span>}
        <Button onClick={save} loading={saving} disabled={!dirty} icon="check">Save page</Button>
      </div>

      {picking !== false && picking != null && (
        <ImagePicker
          open multiple={false} title="Insert image"
          onClose={() => setPicking(false)}
          onConfirm={(ids, imgs) => {
            const src = imgs[0]?.variants?.large?.jpg || imgs[0]?.variants?.medium?.jpg;
            if (picking === 'new') {
              setBlocks((b) => [...b, { id: Date.now(), type: 'image', src, caption: imgs[0]?.title || '' }]);
            } else {
              updateBlock(picking, { src, caption: imgs[0]?.title || '' });
            }
            setDirty(true);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function BlockRow({ block, onChange, onRemove, onPickImage }) {
  return (
    <div className="flex gap-2 items-start bg-surface-2 rounded-lg p-2.5 border">
      <span className="text-ink-faint cursor-grab mt-2 flex-none"><Icon name="drag" size={16} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono uppercase tracking-wide text-ink-faint mb-1">{block.type}</div>
        {block.type === 'image' ? (
          block.src ? (
            <div className="flex gap-3 items-center">
              <img src={block.src} alt="" className="w-24 h-16 object-cover rounded-md border" />
              <div className="flex-1">
                <Input value={block.caption || ''} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Caption (optional)" />
                <button className="text-[12px] link mt-1" onClick={onPickImage}>Replace image</button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" icon="image" onClick={onPickImage}>Choose image</Button>
          )
        ) : block.type === 'paragraph' || block.type === 'quote' ? (
          <Textarea rows={block.type === 'quote' ? 2 : 3} value={block.text || ''} onChange={(e) => onChange({ text: e.target.value })}
            placeholder={block.type === 'quote' ? 'A short, memorable line…' : 'Write a paragraph…'} />
        ) : (
          <Input value={block.text || ''} onChange={(e) => onChange({ text: e.target.value })}
            className={block.type === 'heading' ? 'font-display font-bold text-lg' : 'font-medium'} placeholder={`${block.type}…`} />
        )}
      </div>
      <IconButton name="x" label="Remove block" size="sm" onClick={onRemove} className="hover:text-danger flex-none" />
    </div>
  );
}
