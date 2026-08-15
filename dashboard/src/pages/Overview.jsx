import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/ui/Icon';
import { Button, Spinner } from '../components/ui/Button';
import { humanBytes, pct } from '../lib/format';

export default function Overview() {
  const { user, site } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/images'), api.get('/galleries'), api.get('/pages')])
      .then(([i, g, p]) => setData({ images: i.images, galleries: g.galleries, pages: p.pages }))
      .catch(() => setData({ images: [], galleries: [], pages: [] }));
  }, []);

  if (!data) return <div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>;

  const totalOriginal = data.images.reduce((a, i) => a + i.metrics.original_bytes, 0);
  const totalOptimised = data.images.reduce((a, i) => a + i.metrics.optimised_bytes, 0);
  const saved = totalOriginal - totalOptimised;
  const avgReduction = data.images.length
    ? data.images.reduce((a, i) => a + i.metrics.reduction_pct, 0) / data.images.length
    : 0;

  const stats = [
    { label: 'Photos', value: data.images.length, icon: 'image' },
    { label: 'Galleries', value: data.galleries.length, icon: 'grid' },
    { label: 'Total saved', value: humanBytes(saved), icon: 'gauge', accent: true },
    { label: 'Avg. reduction', value: `−${pct(avgReduction)}`, icon: 'sparkle', accent: true },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1 className="font-display font-bold text-3xl text-ink mt-1">{user?.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button as={Link} to="/app/upload" icon="upload">Upload photos</Button>
          <Button as={Link} to="/app/settings" variant="secondary" icon="rocket">Publish</Button>
        </div>
      </div>

      {/* Publish status banner */}
      <div className="card p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg grid place-items-center flex-none"
            style={{ background: site?.published ? 'var(--accent-weak)' : 'var(--surface-2)', color: site?.published ? 'var(--accent)' : 'var(--ink-faint)' }}>
            <Icon name={site?.published ? 'globe' : 'eye'} size={20} />
          </span>
          <div>
            <div className="font-medium text-ink">{site?.published ? 'Your site is live' : 'Your site is a draft'}</div>
            <a href={site?.public_url} target="_blank" rel="noopener" className="font-mono text-[13px] link">{site?.public_url}</a>
          </div>
        </div>
        <Button as="a" href={site?.public_url} target="_blank" variant="secondary" icon="eye">View site</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{s.label}</span>
              <span style={{ color: s.accent ? 'var(--accent)' : 'var(--ink-faint)' }}><Icon name={s.icon} size={18} /></span>
            </div>
            <div className="font-display font-bold text-2xl mt-2 text-ink" style={s.accent ? { color: 'var(--accent)' } : undefined}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick links + recent */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-ink">Recent photos</h2>
            <Link to="/app/library" className="text-sm link">View library</Link>
          </div>
          {data.images.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-ink-muted text-sm">No photos yet.</p>
              <Button as={Link} to="/app/upload" className="mt-3" icon="upload">Upload your first photos</Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {data.images.slice(0, 8).map((img) => (
                <div key={img.id} className="aspect-square rounded-md overflow-hidden border bg-surface-2">
                  <img src={img.variants?.thumb?.webp} alt={img.title} loading="lazy"
                    className="w-full h-full object-cover"
                    style={{ backgroundImage: `url(${img.variants?.lqip})`, backgroundSize: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-display font-semibold text-lg text-ink mb-4">Set up your site</h2>
          <ul className="space-y-2.5">
            <Task done={data.images.length > 0} to="/app/upload" label="Upload photos" />
            <Task done={data.galleries.some((g) => g.image_count > 0)} to="/app/galleries" label="Fill a gallery" />
            <Task done={!!site?.home_header?.image_ids?.length} to="/app/header" label="Design your hero" />
            <Task done={data.pages.length > 0} to="/app/pages" label="Add an About page" />
            <Task done={!!site?.published} to="/app/settings" label="Publish your site" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Task({ done, to, label }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 group">
        <span className="w-5 h-5 rounded-full grid place-items-center flex-none border"
          style={done ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' } : { borderColor: 'var(--border-strong)' }}>
          {done && <Icon name="check" size={13} />}
        </span>
        <span className={`text-sm ${done ? 'text-ink-faint line-through' : 'text-ink group-hover:text-accent'}`}>{label}</span>
      </Link>
    </li>
  );
}
