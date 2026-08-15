import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { centroidFor } from '../lib/countryCentroids';
import { Icon } from './ui/Icon';

/**
 * Interactive world globe (react-globe.gl → globe.gl/three.js) plotting where a
 * site's visitors come from. Each located country gets a point sized by visitor
 * count; hover for the tally. Auto-rotates, drag to spin. Works offline (solid
 * shaded globe + graticules); an Earth texture loads on top when reachable.
 */
const EARTH_IMG = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';

export default function VisitorGlobe({ countries }) {
  const wrapRef = useRef(null);
  const globeRef = useRef(null);
  const [width, setWidth] = useState(0);
  const height = 440;

  const accent = useMemo(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#22B8C4';
  }, []);

  const points = useMemo(() => {
    const out = [];
    for (const row of countries || []) {
      const c = centroidFor(row.country_code);
      if (!c) continue; // Unknown / Local / unmapped
      out.push({ lat: c.lat, lng: c.lng, name: c.name, count: Number(row.count) });
    }
    return out;
  }, [countries]);

  const maxCount = Math.max(1, ...points.map((p) => p.count));

  // Responsive width from the container.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    setWidth(wrapRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Auto-rotate + frame the busiest region.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enableZoom = true;
    if (points.length) {
      const top = points.reduce((a, b) => (b.count > a.count ? b : a), points[0]);
      g.pointOfView({ lat: top.lat, lng: top.lng, altitude: 2.2 }, 800);
    }
  }, [points]);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <span className="text-ink-faint"><Icon name="globe" size={16} /></span>
          <span className="eyebrow">Where visitors are</span>
        </div>
        <span className="text-ink-faint text-[12px]">{points.length} {points.length === 1 ? 'country' : 'countries'} located</span>
      </div>

      <div ref={wrapRef} className="relative mt-3" style={{ height }}>
        {points.length === 0 && (
          <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
            <div className="text-center px-6">
              <p className="text-ink-muted text-sm">No located visitors yet.</p>
              <p className="text-ink-faint text-[12px] mt-1">Countries appear once visits arrive and the GeoIP database is installed.</p>
            </div>
          </div>
        )}
        {width > 0 && (
          <Globe
            ref={globeRef}
            width={width}
            height={height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={EARTH_IMG}
            showGraticules
            showAtmosphere
            atmosphereColor={accent}
            atmosphereAltitude={0.18}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor={() => accent}
            pointAltitude={(d) => 0.04 + (d.count / maxCount) * 0.32}
            pointRadius={(d) => 0.25 + (d.count / maxCount) * 0.45}
            pointsMerge={false}
            pointLabel={(d) => `<div style="font:600 12px/1.4 system-ui,sans-serif;background:rgba(17,20,24,.92);color:#fff;padding:6px 9px;border-radius:8px;white-space:nowrap">${d.name} · ${d.count} ${d.count === 1 ? 'visitor' : 'visitors'}</div>`}
            ringsData={points}
            ringLat="lat"
            ringLng="lng"
            ringColor={() => accent}
            ringMaxRadius={(d) => 1.2 + (d.count / maxCount) * 3}
            ringPropagationSpeed={1.4}
            ringRepeatPeriod={1400}
          />
        )}
      </div>
    </div>
  );
}
