import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHead } from './Upload';
import { Button, Spinner, IconButton } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Field, Input } from '../components/ui/Controls';
import { ShareMenu } from '../components/ShareMenu';

/**
 * Manage several photo sites: see each one's performance side by side, switch
 * the active site, share or copy its live URL, spin up a new site, or delete one
 * you no longer need. The active site is what every other dashboard page edits.
 */
export default function Sites() {
  const { refreshMe } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [sites, setSites] = useState(null);
  const [stats, setStats] = useState({});
  const [busy, setBusy] = useState('');
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(null); // site being shared

  const load = async () => {
    const [{ sites: list }, compare] = await Promise.all([
      api.get('/sites'),
      api.get('/analytics/compare').catch(() => ({ sites: [] })),
    ]);
    setSites(list);
    setStats(Object.fromEntries((compare.sites || []).map((s) => [s.id, s])));
  };

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []); // eslint-disable-line

  const bestId = sites && sites.length > 1
    ? sites.reduce((best, s) => ((stats[s.id]?.visitors ?? 0) > (stats[best]?.visitors ?? -1) ? s.id : best), sites[0].id)
    : null;

  const switchTo = async (id) => {
    setBusy(`switch-${id}`);
    try {
      await api.post(`/sites/${id}/activate`, {});
      await refreshMe();
      await load();
      toast.success('Active site switched.');
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  const openEditor = async (id, isCurrent) => {
    if (!isCurrent) { await switchTo(id); }
    navigate('/app/editor');
  };

  const remove = async (site) => {
    if (!confirm(`Delete “${site.title}” and all its photos, pages and analytics? This can’t be undone.`)) return;
    setBusy(`del-${site.id}`);
    try {
      await api.del(`/sites/${site.id}`);
      await refreshMe();
      await load();
      toast.info('Site deleted.');
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  if (!sites) return <div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>;

  return (
    <div>
      <PageHead
        title="Your sites"
        subtitle="Every photo site you own. Switch the active one, compare how they’re doing, share a link, or start a new one."
        action={<CreateButton onCreated={async () => { await refreshMe(); await load(); }} open={creating} setOpen={setCreating} />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {sites.map((s) => {
          const m = stats[s.id] || {};
          return (
            <div key={s.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-lg text-ink truncate">{s.title}</h3>
                    {s.is_current && <span className="badge" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>Active</span>}
                    {bestId === s.id && <span className="badge badge-success">Top performer</span>}
                  </div>
                  <div className="text-[12px] text-ink-faint font-mono truncate mt-0.5">{s.public_url}</div>
                </div>
                <span className="badge flex-none" style={{ background: s.published ? 'var(--accent-weak)' : 'var(--surface-2)', color: s.published ? 'var(--accent)' : 'var(--ink-muted)' }}>
                  {s.published ? 'Published' : 'Draft'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <Metric label="Visitors" value={m.visitors} />
                <Metric label="Pageviews" value={m.pageviews} />
                <Metric label="Views/visitor" value={m.views_per_visitor} />
              </div>
              <p className="text-[11px] text-ink-faint mt-2">Last 30 days{m.top_page ? ` · top page ${m.top_page}` : ''}</p>

              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                <Button size="sm" icon="layout" loading={busy === `switch-${s.id}`} onClick={() => openEditor(s.id, s.is_current)}>
                  {s.is_current ? 'Open editor' : 'Switch & edit'}
                </Button>
                {!s.is_current && (
                  <Button size="sm" variant="secondary" loading={busy === `switch-${s.id}`} onClick={() => switchTo(s.id)}>Make active</Button>
                )}
                {s.published && (
                  <a href={s.public_url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm"><Icon name="eye" size={15} /> View</a>
                )}
                <Button size="sm" variant="secondary" icon="link" onClick={() => setSharing(s)}>Share</Button>
                <IconButton name="trash" label="Delete site" className="ml-auto hover:text-danger" disabled={busy === `del-${s.id}`} onClick={() => remove(s)} />
              </div>
            </div>
          );
        })}
      </div>

      {sharing && (
        <Modal open onClose={() => setSharing(null)} title={`Share “${sharing.title}”`} size="md">
          {sharing.published ? (
            <ShareMenu url={sharing.public_url} title={`${sharing.title} — portfolio`} />
          ) : (
            <p className="text-ink-muted text-sm">Publish this site first to share a public link. Open the editor and hit Publish.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-display font-bold text-lg text-ink">{value ?? 0}</div>
    </div>
  );
}

function CreateButton({ onCreated, open, setOpen }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post('/sites', { title: title.trim() });
      setOpen(false); setTitle('');
      toast.success('New site created — it’s now your active site.');
      await onCreated();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>New site</Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Create a new site" size="sm"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create site</Button></>}>
          <Field label="Site name" hint="You can rename it any time in the editor.">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. Wildlife portfolio" />
          </Field>
        </Modal>
      )}
    </>
  );
}
