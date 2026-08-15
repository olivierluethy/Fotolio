import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './ui/Icon';
import { Spinner } from './ui/Button';

/**
 * First-party site analytics for the Overview: aggregate stats, a pageview
 * trend, top pages / referrers / countries / devices, a real-time active count
 * and a live activity feed. Reads the /analytics endpoints; the realtime feed
 * polls every few seconds. Visual system per docs/STYLEGUIDE.md.
 */
const RANGES = [
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
];

export default function Analytics() {
  const [days, setDays] = useState(14);
  const [ov, setOv] = useState(null);
  const [rt, setRt] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setOv(null);
    api.get(`/analytics/overview?days=${days}`)
      .then((d) => alive && setOv(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [days]);

  useEffect(() => {
    let alive = true;
    const tick = () => api.get('/analytics/realtime')
      .then((d) => alive && setRt(d))
      .catch(() => {});
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (failed) return null; // analytics not reachable — hide gracefully

  const active = rt?.active ?? 0;
  const empty = ov && ov.pageviews === 0 && ov.visitors === 0 && active === 0;

  const stats = [
    { label: 'Visitors', value: ov?.visitors, icon: 'users' },
    { label: 'Pageviews', value: ov?.pageviews, icon: 'eye' },
    { label: 'Views / visitor', value: ov?.views_per_visitor, icon: 'gauge' },
    { label: 'Active now', value: active, icon: 'activity', accent: true },
  ];

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-semibold text-lg text-ink">Site analytics</h2>
          <LivePill active={active} window={rt?.window_seconds} />
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 font-medium transition-colors ${days === r.days ? 'text-[var(--on-accent)]' : 'text-ink-muted hover:text-ink'}`}
              style={days === r.days ? { background: 'var(--accent)' } : undefined}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!ov ? (
        <div className="card grid place-items-center py-16 text-accent"><Spinner size={22} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                  <span className="eyebrow">Pageviews · last {ov.range_days} days</span>
                  <span className="text-ink-faint text-[13px] font-mono">{ov.pageviews} total</span>
                </div>
                <Trend series={ov.trend} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <BarList title="Top pages" icon="file" rows={ov.top_pages} mono />
                <BarList title="Referrers" icon="link" rows={ov.referrers} />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <BarList title="Countries" icon="globe" rows={ov.countries} flags />
                <BarList title="Devices" icon="monitor" rows={ov.devices} cap />
                <BarList title="Browsers" icon="grid" rows={ov.browsers} cap />
              </div>

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
