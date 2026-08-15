import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { PageHead } from './Upload';
import { Button, Spinner, IconButton } from '../components/ui/Button';
import { Field, Input, Textarea, Select, Segmented, EmptyState } from '../components/ui/Controls';
import { Modal } from '../components/ui/Modal';
import { Icon } from '../components/ui/Icon';
import { OptimizationLoupe } from '../components/OptimizationLoupe';
import { classNames, pct } from '../lib/format';

export default function Library() {
  const toast = useToast();
  const [images, setImages] = useState(null);
  const [galleries, setGalleries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);

  const load = () =>
    Promise.all([api.get('/images'), api.get('/galleries')]).then(([i, g]) => {
      setImages(i.images);
      setGalleries(g.galleries);
    });

  useEffect(() => { load().catch(() => setImages([])); }, []);

  const visible = useMemo(() => {
    if (!images) return [];
    return images.filter((i) => {
      if (filter !== 'all' && i.capture_method !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return [i.title, i.location, i.description].some((v) => (v || '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [images, filter, search]);

  const toggle = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const clearSel = () => setSelected(new Set());

  const bulkAssign = async (galleryId) => {
    if (!galleryId) return;
    try {
      await api.post(`/galleries/${galleryId}/images`, { image_ids: [...selected] });
      toast.success(`Added ${selected.size} photo(s) to gallery.`);
      clearSel();
      load();
    } catch (e) { toast.error(e.message); }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} photo(s)? This can’t be undone.`)) return;
    try {
      await api.post('/images/bulk', { ids: [...selected], action: 'delete' });
      toast.success('Photos deleted.');
      clearSel();
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (!images) return <div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>;

  return (
    <div>
      <PageHead
        title="Library"
        subtitle={`${images.length} photo${images.length === 1 ? '' : 's'} · click any to edit its details`}
        action={<Button as={Link} to="/app/upload" icon="upload">Upload</Button>}
      />

      {images.length === 0 ? (
        <EmptyState
          icon={<Icon name="image" size={26} />}
          title="Your library is empty"
          action={<Button as={Link} to="/app/upload" icon="upload">Upload photos</Button>}
        >
          Upload photos and they’ll appear here, already optimised and ready to arrange into galleries.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'drone', label: 'Aerial' },
                { value: 'camera', label: 'Camera' },
              ]}
            />
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"><Icon name="search" size={16} /></span>
              <Input className="pl-9" placeholder="Search photos" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map((img) => (
              <ImageCell key={img.id} image={img} selected={selected.has(img.id)} onToggle={() => toggle(img.id)} onEdit={() => setEditing(img)} />
            ))}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] toast-in">
          <div className="card shadow-lg px-4 py-2.5 flex items-center gap-3">
            <span className="text-sm font-medium text-ink">{selected.size} selected</span>
            <div className="h-5 w-px bg-border" />
            <Select className="h-9 w-44" defaultValue="" onChange={(e) => bulkAssign(e.target.value)}>
              <option value="" disabled>Add to gallery…</option>
              {galleries.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </Select>
            <Button variant="ghost" size="sm" className="!text-danger" icon="trash" onClick={bulkDelete}>Delete</Button>
            <IconButton name="x" label="Clear selection" size="sm" onClick={clearSel} />
          </div>
        </div>
      )}

      {editing && (
        <MetadataModal
          image={editing}
          galleries={galleries}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setImages((list) => list.map((x) => (x.id === updated.id ? updated : x)));
            setEditing(null);
          }}
          onDeleted={(id) => {
            setImages((list) => list.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ImageCell({ image, selected, onToggle, onEdit }) {
  return (
    <div className={classNames('relative group rounded-lg overflow-hidden border bg-surface-2', selected && 'ring-2 ring-accent')}>
      <button onClick={onEdit} className="block w-full aspect-square">
        <img
          src={image.variants?.thumb?.webp}
          alt={image.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
          style={{ backgroundImage: `url(${image.variants?.lqip})`, backgroundSize: 'cover' }}
        />
      </button>
      {/* select checkbox */}
      <button
        onClick={onToggle}
        aria-label={selected ? 'Deselect' : 'Select'}
        className="absolute top-2 left-2 w-6 h-6 rounded-md grid place-items-center border transition-all"
        style={selected
          ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
          : { background: 'rgba(0,0,0,.4)', borderColor: 'rgba(255,255,255,.6)', color: 'transparent' }}
      >
        <Icon name="check" size={14} />
      </button>
      <div className="absolute top-2 right-2 flex gap-1">
        {image.capture_method === 'drone' && <span className="badge" style={{ background: 'rgba(0,0,0,.5)', color: '#fff' }}>Aerial</span>}
        <span className="badge-success badge">−{pct(image.metrics.reduction_pct)}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.7))' }}>
        <div className="text-white text-xs truncate">{image.title}</div>
      </div>
    </div>
  );
}

function MetadataModal({ image, galleries, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: image.title || '',
    location: image.location || '',
    description: image.description || '',
    capture_method: image.capture_method || 'other',
    tags: (image.tags || []).join(', '),
    ...image.exif,
  });
  const [current, setCurrent] = useState(image);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title, location: form.location, description: form.description,
        capture_method: form.capture_method,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        camera_make: form.camera_make, camera_model: form.camera_model, lens: form.lens,
        focal_length: form.focal_length, aperture: form.aperture, shutter: form.shutter, iso: form.iso,
      };
      const { image: updated } = await api.patch(`/images/${image.id}`, payload);
      toast.success('Photo details saved.');
      onSaved(updated);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm('Delete this photo? This can’t be undone.')) return;
    try {
      await api.del(`/images/${image.id}`);
      toast.info('Photo deleted.');
      onDeleted(image.id);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Photo details"
      size="lg"
      footer={
        <>
          <Button variant="ghost" className="!text-danger mr-auto" icon="trash" onClick={del}>Delete</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <OptimizationLoupe image={current} height={240} />
          <div className="mt-4">
            <div className="label flex items-center gap-1.5"><Icon name="gauge" size={14} /> Re-optimise quality</div>
            <QualitySlider image={current} onChange={setCurrent} />
          </div>
          {(current.exif?.captured_at || current.exif?.gps_lat) && (
            <div className="mt-4 font-mono text-[12px] text-ink-faint space-y-1">
              {current.exif?.captured_at && <div>Captured {current.exif.captured_at}</div>}
              {current.exif?.gps_lat != null && (
                <div>GPS {current.exif.gps_lat}, {current.exif.gps_lng} — <button
                  className="link" onClick={() => set('location', `${current.exif.gps_lat}, ${current.exif.gps_lng}`)}>use as location</button></div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Field label="Title"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Meggenhorn, Lucerne" /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Captured with">
            <Segmented
              value={form.capture_method}
              onChange={(v) => set('capture_method', v)}
              options={[{ value: 'drone', label: 'Drone' }, { value: 'camera', label: 'Camera' }, { value: 'other', label: 'Other' }]}
            />
          </Field>
          <Field label="Tags" hint="Comma-separated"><Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="sunset, lake, alps" /></Field>
          <details className="border rounded-md p-3 text-sm">
            <summary className="cursor-pointer text-ink-muted font-medium">Camera & EXIF</summary>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              {[['camera_make', 'Make'], ['camera_model', 'Model'], ['lens', 'Lens'], ['focal_length', 'Focal length'], ['aperture', 'Aperture'], ['shutter', 'Shutter'], ['iso', 'ISO']].map(([k, l]) => (
                <Field key={k} label={l}><Input value={form[k] || ''} onChange={(e) => set(k, e.target.value)} /></Field>
              ))}
            </div>
          </details>
        </div>
      </div>
    </Modal>
  );
}

function QualitySlider({ image, onChange }) {
  const [q, setQ] = useState(image.quality);
  const [busy, setBusy] = useState(false);
  const apply = async (val) => {
    setBusy(true);
    try {
      const { image: updated } = await api.post(`/images/${image.id}/reoptimize`, { quality: val });
      onChange(updated);
    } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3">
      <input type="range" min="40" max="95" value={q} onChange={(e) => setQ(+e.target.value)}
        onMouseUp={(e) => apply(+e.target.value)} onTouchEnd={(e) => apply(+e.target.value)}
        className="flex-1 accent-[var(--accent)]" />
      <span className="font-mono text-sm w-8 text-right text-ink flex items-center gap-1">{busy && <Spinner size={12} />}{q}</span>
    </div>
  );
}
