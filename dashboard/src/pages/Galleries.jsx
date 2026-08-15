import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { PageHead } from './Upload';
import { Button, Spinner, IconButton } from '../components/ui/Button';
import { Field, Input, Textarea, Toggle, EmptyState } from '../components/ui/Controls';
import { Modal } from '../components/ui/Modal';
import { Icon } from '../components/ui/Icon';
import { Sortable } from '../components/Sortable';
import { ImagePicker } from '../components/ImagePicker';
import { classNames } from '../lib/format';

export default function Galleries() {
  const toast = useToast();
  const [galleries, setGalleries] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [creating, setCreating] = useState(false);
  const [picking, setPicking] = useState(false);

  const loadList = () => api.get('/galleries').then((d) => {
    setGalleries(d.galleries);
    setActiveId((cur) => cur ?? d.galleries[0]?.id ?? null);
  });

  useEffect(() => { loadList().catch(() => setGalleries([])); }, []);
  useEffect(() => {
    if (activeId == null) { setDetail(null); return; }
    setDetail(null);
    api.get('/galleries?with_images=1').then((d) => setDetail(d.galleries.find((g) => g.id === activeId) || null));
  }, [activeId, galleries]);

  const reorder = async (next) => {
    setGalleries(next);
    try { await api.post('/galleries/reorder', { order: next.map((g) => g.id) }); }
    catch (e) { toast.error(e.message); loadList(); }
  };

  const create = async (data) => {
    try {
      const { gallery } = await api.post('/galleries', data);
      toast.success('Gallery created.');
      setCreating(false);
      await loadList();
      setActiveId(gallery.id);
    } catch (e) { toast.error(e.message); throw e; }
  };

  if (!galleries) return <div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>;

  return (
    <div>
      <PageHead
        title="Galleries"
        subtitle="Group photos into galleries — these become the navigation on your published site."
        action={<Button icon="plus" onClick={() => setCreating(true)}>New gallery</Button>}
      />

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* List */}
        <div>
          <div className="eyebrow mb-2">Drag to reorder</div>
          <Sortable
            items={galleries}
            onReorder={reorder}
            className="space-y-2"
            render={(g) => (
              <button
                onClick={() => setActiveId(g.id)}
                className={classNames(
                  'w-full text-left card p-3 flex items-center gap-3 transition-colors',
                  activeId === g.id && 'ring-2 ring-accent'
                )}
              >
                <span className="text-ink-faint cursor-grab"><Icon name="drag" size={16} /></span>
                <div className="w-12 h-12 rounded-md overflow-hidden bg-surface-2 flex-none">
                  {g.cover ? <img src={g.cover.variants?.thumb?.webp} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-ink-faint"><Icon name="grid" size={16} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate flex items-center gap-1.5">
                    {g.name}
                    {g.is_home && <span className="badge-accent badge">Home</span>}
                  </div>
                  <div className="text-[12px] text-ink-faint">{g.image_count} photo{g.image_count === 1 ? '' : 's'}</div>
                </div>
              </button>
            )}
          />
        </div>

        {/* Detail */}
        <div>
          {!detail ? (
            <div className="grid place-items-center py-24 text-accent"><Spinner size={22} /></div>
          ) : (
            <GalleryDetail
              gallery={detail}
              onChanged={(g) => { setDetail(g); loadList(); }}
              onDeleted={() => { setActiveId(null); loadList(); }}
              onAdd={() => setPicking(true)}
            />
          )}
        </div>
      </div>

      {creating && <GalleryFormModal onClose={() => setCreating(false)} onSave={create} />}
      {picking && detail && (
        <ImagePicker
          open
          onClose={() => setPicking(false)}
          excludeIds={(detail.images || []).map((i) => i.id)}
          onConfirm={async (ids) => {
            try {
              const { gallery } = await api.post(`/galleries/${detail.id}/images`, { image_ids: ids });
              setDetail(gallery); loadList();
              toast.success(`Added ${ids.length} photo(s).`);
            } catch (e) { toast.error(e.message); }
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function GalleryDetail({ gallery, onChanged, onDeleted, onAdd }) {
  const toast = useToast();
  const [name, setName] = useState(gallery.name);
  const [description, setDescription] = useState(gallery.description || '');
  const [showInNav, setShowInNav] = useState(gallery.show_in_nav);
  useEffect(() => { setName(gallery.name); setDescription(gallery.description || ''); setShowInNav(gallery.show_in_nav); }, [gallery.id]);

  const saveMeta = async (patch) => {
    try {
      const { gallery: g } = await api.patch(`/galleries/${gallery.id}`, patch);
      onChanged(g);
    } catch (e) { toast.error(e.message); }
  };

  const reorderImages = async (next) => {
    onChanged({ ...gallery, images: next });
    try { await api.post(`/galleries/${gallery.id}/images/reorder`, { image_ids: next.map((i) => i.id) }); }
    catch (e) { toast.error(e.message); }
  };

  const removeImage = async (imageId) => {
    try {
      const { gallery: g } = await api.del(`/galleries/${gallery.id}/images/${imageId}`);
      onChanged(g);
    } catch (e) { toast.error(e.message); }
  };

  const del = async () => {
    if (!confirm(`Delete the “${gallery.name}” gallery? Photos stay in your library.`)) return;
    try { await api.del(`/galleries/${gallery.id}`); toast.info('Gallery deleted.'); onDeleted(); }
    catch (e) { toast.error(e.message); }
  };

  const images = gallery.images || [];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-[220px] space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== gallery.name && saveMeta({ name })}
            className="font-display font-bold text-xl bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none w-full pb-1 text-ink"
          />
          <Textarea
            rows={2}
            placeholder="Add a short description (shown on the gallery page)…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (gallery.description || '') && saveMeta({ description })}
          />
        </div>
        {!gallery.is_home && (
          <IconButton name="trash" label="Delete gallery" onClick={del} className="hover:text-danger" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-y">
        <Toggle checked={showInNav} onChange={(v) => { setShowInNav(v); saveMeta({ show_in_nav: v }); }} label="Show in site navigation" />
        <Button size="sm" icon="plus" onClick={onAdd}>Add photos</Button>
      </div>

      {images.length === 0 ? (
        <EmptyState icon={<Icon name="image" size={22} />} title="No photos in this gallery yet"
          action={<Button size="sm" icon="plus" onClick={onAdd}>Add photos</Button>}>
          Add photos from your library. Drag to set their order — that’s the order visitors will see.
        </EmptyState>
      ) : (
        <>
          <div className="eyebrow mt-4 mb-2">Drag to reorder · {images.length} photos</div>
          <Sortable
            items={images}
            onReorder={reorderImages}
            className="grid grid-cols-3 sm:grid-cols-4 gap-2.5"
            render={(img) => (
              <div className="relative group aspect-square rounded-lg overflow-hidden border bg-surface-2">
                <img src={img.variants?.thumb?.webp} alt={img.title} className="w-full h-full object-cover" draggable="false" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}
                  aria-label="Remove from gallery"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}

function GalleryFormModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), description }); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="New gallery"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving} disabled={!name.trim()}>Create gallery</Button></>}>
      <div className="space-y-4">
        <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aerial, Portraits, 2024" /></Field>
        <Field label="Description" hint="Optional — shown on the gallery page"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
