import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './ui/Icon';
import { Spinner, Button } from './ui/Button';
import { Field, Input, Select } from './ui/Controls';
import { useToast } from '../context/ToastContext';
import VisitorGlobe from './VisitorGlobe';

/**
 * First-party site analytics for the Overview: rich date-range filtering,
 * aggregate stats, a pageview trend, best/worst pages, most-clicked images,
 * popular flow, dwell time, user-defined goals with conversion + region
 * breakdown, heuristic suggestions, CSV/XLSX export, a real-time active count,
 * a live activity feed and a multi-site performance comparison. Reads the
 * /analytics endpoints; the realtime feed polls every few seconds. Visual
 * system per docs/STYLEGUIDE.md.
 */
const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_hour', label: 'Last hour' },
  { value: 'last_24h', label: 'Last 24 hours' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'last_180d', label: 'Last 180 days' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range…' },
];

const METRIC_OPTIONS = [
  { value: 'visit', label: 'A whole visit' },
  { value: 'pageview', label: 'Pageview' },
  { value: 'click', label: 'Click' },
  { value: 'lightbox', label: 'Lightbox open' },
  { value: 'nav', label: 'Navigation' },
];

function overviewQuery(applied) {
  const p = new URLSearchParams({ range: applied.range });
  if (applied.range === 'custom') {
    if (applied.from) p.set('from', applied.from);
    if (applied.to) p.set('to', applied.to);
  }
  return p;
}

export default function Analytics({ showGlobe = false, heading = true }) {
  const toast = useToast();

  const [range, setRange] = useState('last_14d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ range: 'last_14d', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);

  const [ov, setOv] = useState(null);
  const [rt, setRt] = useState(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(null);

  // Overview — refetches whenever the applied range (or a manual reload) changes.
  useEffect(() => {
    let alive = true;
    setOv(null);
    api.get(`/analytics/overview?${overviewQuery(applied).toString()}`)
      .then((d) => alive && setOv(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [applied, reloadKey]);

  // Realtime — unchanged 5s poll.
  useEffect(() => {
    let alive = true;
    const tick = () => api.get('/analytics/realtime')
      .then((d) => alive && setRt(d))
      .catch(() => {});
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const refetchOverview = () => setReloadKey((k) => k + 1);

  function onRangeChange(v) {
    setRange(v);
    if (v !== 'custom') setApplied({ range: v, from: '', to: '' });
  }
  function applyCustom() {
    if (!from || !to) { toast.error('Pick both a start and end date.'); return; }
    if (from > to) { toast.error('Start date must be before the end date.'); return; }
    setApplied({ range: 'custom', from, to });
  }

  async function exportFile(format) {
    setExporting(format);
    try {
      const p = overviewQuery(applied);
      p.set('format', format);
      const res = await api.raw('GET', `/analytics/export?${p.toString()}`);
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      const name = (m && decodeURIComponent(m[1])) || `analytics.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Couldn’t export ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  }

  if (failed) return null; // analytics not reachable — hide gracefully

  const active = rt?.active ?? 0;
  const empty = ov && ov.pageviews === 0 && ov.visitors === 0 && active === 0;

  const stats = [
    { label: 'Visitors', value: ov?.visitors, icon: 'users' },
    { label: 'Pageviews', value: ov?.pageviews, icon: 'eye' },
    { label: 'Views / visitor', value: ov?.views_per_visitor, icon: 'gauge' },
    { label: 'Avg. visit', value: fmtDuration(ov?.avg_visit_seconds), icon: 'clock' },
    { label: 'Active now', value: active, icon: 'activity', accent: true },
  ];

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {heading && <h2 className="font-display font-semibold text-lg text-ink">Site analytics</h2>}
          <LivePill active={active} window={rt?.window_seconds} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onChange={(e) => onRangeChange(e.target.value)} className="!h-9 !py-0 text-sm">
            {RANGE_PRESETS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!h-9 !py-0 text-sm" aria-label="From date" />
              <span className="text-ink-faint text-sm">→</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!h-9 !py-0 text-sm" aria-label="To date" />
              <Button size="sm" variant="secondary" icon="check" onClick={applyCustom}>Apply</Button>
            </div>
          )}
          <Button size="sm" variant="ghost" icon="download" loading={exporting === 'csv'} onClick={() => exportFile('csv')}>CSV</Button>
          <Button size="sm" variant="ghost" icon="download" loading={exporting === 'xlsx'} onClick={() => exportFile('xlsx')}>XLSX</Button>
        </div>
      </div>

      {ov?.range?.label && (
        <p className="text-ink-faint text-[13px] mb-3 -mt-1">
          Showing <span className="text-ink-muted font-medium">{ov.range.label}</span>
          {ov.range.from && ov.range.to ? <span className="font-mono"> · {ov.range.from} → {ov.range.to}</span> : null}
        </p>
      )}

      {!ov ? (
        <div className="card grid place-items-center py-16 text-accent"><Spinner size={22} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {stats.map((s) => (
              <div key={s.label} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{s.label}</span>
                  <span style={{ color: s.accent ? 'var(--accent)' : 'var(--ink-faint)' }}><Icon name={s.icon} size={18} /></span>
                </div>
                <div className="font-display font-bold text-2xl mt-2 text-ink" style={s.accent && active > 0 ? { color: 'var(--accent)' } : undefined}>
                  {s.value ?? 0}
                </div>
              </div>
            ))}
          </div>

          {showGlobe && (
            <div className="mb-4">
              <VisitorGlobe points={rt?.located || []} countriesLocated={rt?.located_countries || 0} demo={!!rt?.geoip_demo} />
            </div>
          )}

          {empty ? (
            <div className="card p-8 text-center">
              <div className="w-11 h-11 rounded-lg grid place-items-center mx-auto mb-3" style={{ background: 'var(--surface-2)', color: 'var(--ink-faint)' }}>
                <Icon name="activity" size={22} />
              </div>
              <p className="text-ink font-medium">No visits yet</p>
              <p className="text-ink-muted text-sm mt-1">Publish your site and share the link — visitors show up here in real time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="eyebrow">Pageviews · {ov.range?.label || `last ${ov.range_days} days`}</span>
                  <span className="text-ink-faint text-[13px] font-mono">{ov.pageviews} total</span>
                </div>
                <Trend series={ov.trend} />
              </div>

              <Suggestions rows={ov.suggestions} />

              <div className="grid lg:grid-cols-2 gap-4">
                <BarList title="Top pages" icon="file" rows={ov.top_pages} mono />
                <BarList title="Referrers" icon="link" rows={ov.referrers} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ImageList rows={ov.top_images} />
                <UnderperformingPages rows={ov.worst_pages} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <BarList title="Popular flow" icon="activity" rows={ov.flow} mono />
                <DwellList rows={ov.page_dwell} />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <BarList title="Countries" icon="globe" rows={ov.countries} flags />
                <BarList title="Devices" icon="monitor" rows={ov.devices} cap />
                <BarList title="Browsers" icon="grid" rows={ov.browsers} cap />
              </div>

              <Goals goals={ov.goals} onChanged={refetchOverview} toast={toast} />

              <CompareSites />

              <LiveFeed rt={rt} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LivePill({ active, window: win }) {
  const on = active > 0;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium"
      style={{ background: on ? 'var(--accent-weak)' : 'var(--surface-2)', color: on ? 'var(--accent)' : 'var(--ink-faint)' }}
      title={win ? `Active in the last ${Math.round(win / 60)} min` : undefined}>
      <span className="relative flex w-2 h-2">
        {on && <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--accent)' }} />}
        <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: on ? 'var(--accent)' : 'var(--ink-faint)' }} />
      </span>
      {active} active now
    </span>
  );
}

function Trend({ series }) {
  if (!series?.length) return null;
  const w = 720, h = 120, pad = 6;
  const max = Math.max(1, ...series.map((d) => d.count));
  const step = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const x = (i) => pad + i * step;
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const pts = series.map((d, i) => `${x(i)},${y(d.count)}`);
  const area = `M${x(0)},${h - pad} L${pts.join(' L')} L${x(series.length - 1)},${h - pad} Z`;
  const line = `M${pts.join(' L')}`;
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 120 }} role="img" aria-label="Pageviews over time">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {series.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.count)} r="2.5" fill="var(--accent)"
            vectorEffect="non-scaling-stroke"><title>{`${d.day}: ${d.count}`}</title></circle>
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-ink-faint font-mono mt-1">
        <span>{fmtDay(series[0].day)}</span>
        <span>{fmtDay(series[series.length - 1].day)}</span>
      </div>
    </div>
  );
}

function BarList({ title, icon, rows, mono, flags, cap }) {
  const max = Math.max(1, ...(rows || []).map((r) => Number(r.count)));
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-faint"><Icon name={icon} size={16} /></span>
        <span className="eyebrow">{title}</span>
      </div>
      {!rows?.length ? (
        <p className="text-ink-faint text-sm py-2">No data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => {
            const label = cap ? capitalize(r.label) : r.label;
            return (
              <li key={i}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className={`truncate text-[13px] text-ink ${mono ? 'font-mono' : ''}`}>
                    {flags && <span className="mr-1.5">{flag(r.country_code)}</span>}
                    {label || '—'}
                  </span>
                  <span className="text-ink-faint text-[13px] font-mono flex-none">{r.count}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(Number(r.count) / max) * 100}%`, background: 'var(--accent)' }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Most-clicked (lightbox-opened) images — label plus its path as a muted suffix.
function ImageList({ rows }) {
  const max = Math.max(1, ...(rows || []).map((r) => Number(r.count)));
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-faint"><Icon name="image" size={16} /></span>
        <span className="eyebrow">Most-clicked images</span>
      </div>
      {!rows?.length ? (
        <p className="text-ink-faint text-sm py-2">No image opens yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="truncate text-[13px] text-ink min-w-0">
                  {r.label || 'Untitled'}
                  {r.path && <span className="text-ink-faint font-mono ml-1.5 text-[12px]">{r.path}</span>}
                </span>
                <span className="text-ink-faint text-[13px] font-mono flex-none">{r.count}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(Number(r.count) / max) * 100}%`, background: 'var(--accent)' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Fewest-viewed pages — candidates to improve or retire.
function UnderperformingPages({ rows }) {
  const max = Math.max(1, ...(rows || []).map((r) => Number(r.count)));
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-ink-faint"><Icon name="alert" size={16} /></span>
        <span className="eyebrow">Underperforming pages</span>
      </div>
      <p className="text-ink-faint text-[12px] mb-3">Fewest views in range — consider improving or removing them.</p>
      {!rows?.length ? (
        <p className="text-ink-faint text-sm py-2">No data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="truncate text-[13px] text-ink font-mono">{r.label || '—'}</span>
                <span className="text-ink-faint text-[13px] font-mono flex-none">{r.count}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(Number(r.count) / max) * 100}%`, background: 'var(--warn)' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Average time-on-page — bar width scaled by seconds, value via fmtDuration.
function DwellList({ rows }) {
  const max = Math.max(1, ...(rows || []).map((r) => Number(r.seconds)));
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-faint"><Icon name="clock" size={16} /></span>
        <span className="eyebrow">Time on page</span>
      </div>
      {!rows?.length ? (
        <p className="text-ink-faint text-sm py-2">No dwell data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="truncate text-[13px] text-ink font-mono">{r.label || '—'}</span>
                <span className="text-ink-faint text-[13px] font-mono flex-none">{fmtDuration(r.seconds)}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(Number(r.seconds) / max) * 100}%`, background: 'var(--accent)' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Heuristic "AI" suggestions, coloured by severity.
function Suggestions({ rows }) {
  if (!rows?.length) return null;
  const styleFor = (sev) => ({
    good: { color: 'var(--success)', bg: 'var(--accent-weak)', icon: 'check' },
    warn: { color: 'var(--warn)', bg: 'var(--surface-2)', icon: 'alert' },
    info: { color: 'var(--ink-faint)', bg: 'var(--surface-2)', icon: 'info' },
  }[sev] || { color: 'var(--ink-faint)', bg: 'var(--surface-2)', icon: 'info' });
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-faint"><Icon name="sparkle" size={16} /></span>
        <span className="eyebrow">Suggestions</span>
      </div>
      <ul className="space-y-2.5">
        {rows.map((s, i) => {
          const st = styleFor(s.severity);
          return (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg grid place-items-center flex-none" style={{ background: st.bg, color: st.color }}>
                <Icon name={st.icon} size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{s.title}</p>
                {s.detail && <p className="text-[13px] text-ink-muted">{s.detail}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// User-defined conversion goals with a region breakdown and a create/delete form.
function Goals({ goals, onChanged, toast }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ name: '', metric: 'visit', path: '', label_match: '', threshold: 1 });

  async function create(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Give the goal a name.'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        metric: form.metric,
        threshold: Number(form.threshold) || 1,
      };
      if (form.path.trim()) body.path = form.path.trim();
      if (form.label_match.trim()) body.label_match = form.label_match.trim();
      await api.post('/analytics/goals', body);
      setForm({ name: '', metric: 'visit', path: '', label_match: '', threshold: 1 });
      setOpen(false);
      toast.success('Goal created.');
      onChanged();
    } catch {
      toast.error('Couldn’t create the goal.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setBusyId(id);
    try {
      await api.del(`/analytics/goals/${id}`);
      toast.success('Goal deleted.');
      onChanged();
    } catch {
      toast.error('Couldn’t delete the goal.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-ink-faint"><Icon name="rocket" size={16} /></span>
          <span className="eyebrow">Goals</span>
        </div>
        <Button size="sm" variant={open ? 'ghost' : 'secondary'} icon={open ? 'x' : 'plus'} onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : 'New goal'}
        </Button>
      </div>

      {open && (
        <form onSubmit={create} className="rounded-lg p-4 mb-4" style={{ background: 'var(--surface-2)' }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contact page reached" />
            </Field>
            <Field label="Metric">
              <Select value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}>
                {METRIC_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
            <Field label="Path (optional)" hint="e.g. /aerial">
              <Input value={form.path} onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))} placeholder="/aerial" />
            </Field>
            <Field label="Label match (optional)" hint="Match a click/nav label">
              <Input value={form.label_match} onChange={(e) => setForm((f) => ({ ...f, label_match: e.target.value }))} placeholder="Book now" />
            </Field>
            <Field label="Threshold" hint="A visitor converts when they trigger the chosen action at least N times in one visit">
              <Input type="number" min="1" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end mt-3">
            <Button size="sm" variant="primary" icon="check" loading={saving} type="submit">Create goal</Button>
          </div>
        </form>
      )}

      {!goals?.length ? (
        <p className="text-ink-faint text-sm py-2">No goals yet. Create one to track conversions.</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const rate = Math.max(0, Math.min(100, Number(g.rate) || 0));
            return (
              <li key={g.id} className="rounded-lg p-4 border border-[var(--border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{g.name}</p>
                    <p className="text-ink-faint text-[12px] font-mono">{g.conversions} / {g.sessions} sessions</p>
                  </div>
                  <div className="flex items-center gap-3 flex-none">
                    <span className="font-display font-bold text-lg text-ink">{rate}%</span>
                    <button onClick={() => remove(g.id)} disabled={busyId === g.id}
                      className="text-ink-faint hover:text-[var(--danger)] transition-colors disabled:opacity-50" title="Delete goal" aria-label="Delete goal">
                      {busyId === g.id ? <Spinner size={16} /> : <Icon name="trash" size={16} />}
                    </button>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${rate}%`, background: 'var(--accent)' }} />
                </div>
                {g.countries?.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
                    {g.countries.map((c, i) => (
                      <span key={i} className="text-[12px] text-ink-muted" title={c.label}>
                        <span className="mr-1">{flag(c.country_code)}</span>{c.label} <span className="text-ink-faint font-mono">{c.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Multi-site performance comparison — fetched once on mount.
function CompareSites() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/analytics/compare')
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  if (failed) return null;

  const sites = data?.sites || [];
  const single = sites.length <= 1;
  const title = single ? 'Site performance' : 'Compare sites';
  const bestVisitors = Math.max(0, ...sites.map((s) => Number(s.visitors) || 0));

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-faint"><Icon name="grid" size={16} /></span>
        <span className="eyebrow">{title}</span>
        {data?.range_days ? <span className="text-ink-faint text-[12px]">· last {data.range_days} days</span> : null}
      </div>
      {!data ? (
        <div className="grid place-items-center py-8 text-accent"><Spinner size={20} /></div>
      ) : !sites.length ? (
        <p className="text-ink-faint text-sm py-2">No sites to compare yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead>
              <tr className="text-left text-ink-faint">
                <th className="font-medium py-2 pr-3">Site</th>
                <th className="font-medium py-2 px-3 text-right">Visitors</th>
                <th className="font-medium py-2 px-3 text-right">Pageviews</th>
                <th className="font-medium py-2 px-3 text-right">Views / visitor</th>
                <th className="font-medium py-2 px-3 text-right">Avg. visit</th>
                <th className="font-medium py-2 pl-3">Top page</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const best = !single && Number(s.visitors) === bestVisitors && bestVisitors > 0;
                return (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-ink font-medium truncate">{s.title || s.slug || 'Untitled'}</span>
                        {best && (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>Best</span>
                        )}
                        {!s.published && <span className="text-ink-faint text-[11px] flex-none">draft</span>}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-ink">{s.visitors ?? 0}</td>
                    <td className="py-2 px-3 text-right font-mono text-ink-muted">{s.pageviews ?? 0}</td>
                    <td className="py-2 px-3 text-right font-mono text-ink-muted">{s.views_per_visitor ?? 0}</td>
                    <td className="py-2 px-3 text-right font-mono text-ink-muted">{fmtDuration(s.avg_visit_seconds)}</td>
                    <td className="py-2 pl-3 font-mono text-ink-muted truncate max-w-[160px]">{s.top_page || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LiveFeed({ rt }) {
  const sessions = rt?.sessions || [];
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-ink-faint"><Icon name="activity" size={16} /></span>
          <span className="eyebrow">Live activity</span>
        </div>
        {rt && !rt.geoip && (
          <span className="text-ink-faint text-[11px]" title="Drop a GeoLite2-Country.mmdb to resolve countries (see docs/ANALYTICS.md)">
            country DB not installed
          </span>
        )}
      </div>
      {!sessions.length ? (
        <p className="text-ink-faint text-sm py-2">No recent sessions.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {sessions.map((s) => (
            <li key={s.session_id} className="flex items-center gap-3 py-2.5">
              <span className="text-lg leading-none flex-none" title={s.country}>{flag(s.country_code)}</span>
              <span className="text-ink-faint flex-none" title={s.device}><Icon name={deviceIcon(s.device)} size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-ink truncate">{s.current_path || '/'}</span>
                  <span className="text-ink-faint text-[12px] flex-none">· {s.pageviews} views</span>
                </div>
                <div className="text-ink-faint text-[11px] truncate">
                  {[s.browser, s.os, s.country !== 'Unknown' ? s.country : null, s.ip].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="text-ink-faint text-[12px] font-mono flex-none whitespace-nowrap">{timeAgo(s.last_seen)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- helpers ----------------------------------------------------------

function fmtDuration(s) {
  s = Math.round(Number(s) || 0);
  if (s <= 0) return '0s';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function fmtDay(s) {
  const d = new Date(`${s}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeAgo(s) {
  if (!s) return '';
  const then = new Date(`${s.replace(' ', 'T')}Z`).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 10) return 'now';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function flag(cc) {
  if (!cc || cc.length !== 2 || !/^[A-Za-z]{2}$/.test(cc)) return '🌐';
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
}

function deviceIcon(d) {
  return { mobile: 'mobile', tablet: 'tablet', desktop: 'monitor', bot: 'settings' }[d] || 'monitor';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
