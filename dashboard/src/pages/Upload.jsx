import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button, Spinner, IconButton } from '../components/ui/Button';
import { Field, Input, Select, Segmented } from '../components/ui/Controls';
import { Icon } from '../components/ui/Icon';
import { OptimizationLoupe } from '../components/OptimizationLoupe';
import { humanBytes, pct } from '../lib/format';

const PRESETS = [
  { value: '68', label: 'Lighter' },
  { value: '82', label: 'Balanced' },
  { value: '90', label: 'Higher quality' },
];

export default function Upload() {
  const toast = useToast();
  const [quality, setQuality] = useState('82');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState([]); // accepted images under review
  const [failed, setFailed] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [url, setUrl] = useState('');
  const fileRef = useRef();
  const folderRef = useRef();
  const zipRef = useRef();

  useEffect(() => {
    api.get('/galleries').then((d) => setGalleries(d.galleries)).catch(() => {});
  }, []);

  const ingest = async (endpoint, formData) => {
    setBusy(true);
    try {
      formData.append('quality', quality);
      const data = await api.upload(endpoint, formData);
      setResults((r) => [...data.accepted, ...r]);
      if (data.failed?.length) setFailed((f) => [...data.failed, ...f]);
      const n = data.accepted.length;
      if (n) toast.success(`Optimised ${n} photo${n > 1 ? 's' : ''} · saved ${pct(data.summary.reduction_pct)}`);
      if (data.failed?.length && !n) toast.error(data.failed[0].message);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('files[]', f));
    ingest('/uploads', fd);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    onFiles(e.dataTransfer.files);
  };

  const onZip = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('zip', file);
    ingest('/uploads/zip', fd);
    e.target.value = '';
  };

  const onUrl = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    const fd = new FormData();
    fd.append('url', url.trim());
    ingest('/uploads/url', fd);
    setUrl('');
  };

  const reject = async (id) => {
    try {
      await api.del(`/images/${id}`);
      setResults((r) => r.filter((x) => x.id !== id));
      toast.info('Photo removed.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const retune = async (id, q) => {
    try {
      const { image } = await api.post(`/images/${id}/reoptimize`, { quality: q });
      setResults((r) => r.map((x) => (x.id === id ? image : x)));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const assign = async (id, galleryId) => {
    if (!galleryId) return;
    try {
      await api.post(`/galleries/${galleryId}/images`, { image_ids: [id] });
      toast.success('Added to gallery.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const totalSaved = results.reduce((a, r) => a + (r.metrics.original_bytes - r.metrics.optimised_bytes), 0);

  return (
    <div>
      <PageHead title="Upload" subtitle="Add photos any way you like — every one is optimised automatically." />

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="label mb-1">Optimisation quality</div>
            <Segmented value={quality} onChange={setQuality} options={PRESETS} />
          </div>
          <p className="text-[13px] text-ink-faint max-w-xs">
            Applied to this batch. You can re-tune any photo below before it goes into your library.
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="card border-2 border-dashed p-10 text-center transition-colors"
        style={{ borderColor: dragOver ? 'var(--accent)' : 'var(--border-strong)', background: dragOver ? 'var(--accent-weak)' : 'var(--surface)' }}
      >
        <div className="mx-auto w-14 h-14 rounded-xl grid place-items-center mb-4" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
          {busy ? <Spinner size={26} /> : <Icon name="upload" size={26} />}
        </div>
        <h3 className="font-display font-semibold text-lg text-ink">
          {busy ? 'Optimising your photos…' : 'Drag photos here'}
        </h3>
        <p className="text-ink-muted text-sm mt-1">JPEG, PNG, WebP, GIF or BMP · up to 40 MB each</p>

        <div className="flex flex-wrap justify-center gap-2.5 mt-5">
          <Button variant="secondary" icon="image" onClick={() => fileRef.current.click()} disabled={busy}>Choose files</Button>
          <Button variant="secondary" icon="folder" onClick={() => folderRef.current.click()} disabled={busy}>Choose folder</Button>
          <Button variant="secondary" icon="zip" onClick={() => zipRef.current.click()} disabled={busy}>Upload ZIP</Button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={folderRef} type="file" hidden webkitdirectory="" directory="" multiple onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={zipRef} type="file" accept=".zip" hidden onChange={onZip} />

        <form onSubmit={onUrl} className="flex gap-2 max-w-md mx-auto mt-5">
          <Input placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={busy || !url.trim()}>Import</Button>
        </form>
      </div>

      {failed.length > 0 && (
        <div className="card p-4 mt-5" style={{ borderColor: 'var(--danger)' }}>
          <div className="flex items-center gap-2 text-danger font-medium text-sm mb-2">
            <Icon name="alert" size={16} /> {failed.length} file{failed.length > 1 ? 's' : ''} couldn’t be processed
          </div>
          <ul className="text-[13px] text-ink-muted space-y-1">
            {failed.map((f, i) => (<li key={i}><span className="font-mono">{f.filename}</span> — {f.message}</li>))}
          </ul>
          <button className="text-[12px] link mt-2" onClick={() => setFailed([])}>Dismiss</button>
        </div>
      )}

      {/* Review */}
      {results.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display font-semibold text-xl text-ink">Review — {results.length} photo{results.length > 1 ? 's' : ''}</h2>
              <p className="text-ink-muted text-sm">Drag the divider to compare. Keep them all, or remove any you don’t want.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge-success badge">Saved {humanBytes(totalSaved)} total</span>
              <Button as={Link} to="/library" iconRight="chevronRight">Done — go to library</Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {results.map((img) => (
              <ReviewCard key={img.id} image={img} galleries={galleries} onReject={reject} onRetune={retune} onAssign={assign} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ image, galleries, onReject, onRetune, onAssign }) {
  const [q, setQ] = useState(image.quality);
  const [tuning, setTuning] = useState(false);

  const apply = async (val) => {
    setQ(val);
    setTuning(true);
    await onRetune(image.id, val);
    setTuning(false);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <div className="font-medium text-ink truncate">{image.title}</div>
          <div className="font-mono text-[12px] text-ink-faint truncate">
            {image.width}×{image.height}
            {image.capture_method && <> · {image.capture_method}</>}
            {image.exif?.camera_model && <> · {image.exif.camera_model}</>}
          </div>
        </div>
        <IconButton name="trash" label="Remove photo" size="sm" onClick={() => onReject(image.id)} className="hover:text-danger" />
      </div>

      <OptimizationLoupe image={image} height={260} />

      <div className="mt-4 flex items-center gap-3">
        <span className="label mb-0 flex items-center gap-1.5">
          <Icon name="gauge" size={14} /> Quality {tuning && <Spinner size={12} />}
        </span>
        <input
          type="range" min="40" max="95" step="1" value={q}
          onChange={(e) => setQ(+e.target.value)}
          onMouseUp={(e) => apply(+e.target.value)}
          onTouchEnd={(e) => apply(+e.target.value)}
          className="flex-1 accent-[var(--accent)]"
        />
        <span className="font-mono text-sm w-8 text-right text-ink">{q}</span>
      </div>

      {galleries.length > 0 && (
        <div className="mt-3">
          <Select defaultValue="" onChange={(e) => onAssign(image.id, e.target.value)}>
            <option value="" disabled>Add to a gallery…</option>
            {galleries.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
          </Select>
        </div>
      )}
    </div>
  );
}

export function PageHead({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">{title}</h1>
        {subtitle && <p className="text-ink-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
