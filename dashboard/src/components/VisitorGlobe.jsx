import { useEffect, useMemo, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { Icon } from './ui/Icon';

/**
 * "Where visitors are" — an interactive globe built with cobe (a tiny WebGL
 * globe, https://cobe.vercel.app). Themed to the Fotolio styleguide: dark
 * graphite sphere, teal markers and glow. It auto-rotates and can be dragged to
 * spin.
 *
 * Two marker layers are plotted from the live analytics feed:
 *   • historical visitors — small, steady teal dots;
 *   • currently-active visitors — larger, pulsing teal markers showing where
 *     people are viewing the site from right now.
 *
 * Marker data is refreshed live (the parent polls realtime every few seconds)
 * without tearing down the globe — the render loop reads the latest markers
 * each frame, so new active visitors appear and pulse instantly.
 */
const HEIGHT = 440;

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [0.133, 0.722, 0.769]; // #22B8C4
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function VisitorGlobe({ points = [], countriesLocated = 0, demo = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(0);

  // Live marker source: the render loop reads this ref every frame, so updating
  // it (when the poll returns) reflects immediately without recreating the globe.
  const markersRef = useRef([]);
  const phiRef = useRef(0);
  const pointerInteracting = useRef(null);
  const pointerMovement = useRef(0);

  const accentRgb = useMemo(() => {
    const v = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--accent')
      : '';
    return hexToRgb(v);
  }, []);

  const activeCount = points.filter((p) => p.active).length;

  // Keep the marker buffer in sync with the latest located visitors.
  useEffect(() => {
    markersRef.current = (points || [])
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({ location: [p.lat, p.lng], baseSize: p.active ? 0.06 : 0.028, active: !!p.active }));
  }, [points]);

  // Responsive width from the container.
  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    ro.observe(wrapRef.current);
    setWidth(Math.round(wrapRef.current.clientWidth));
    return () => ro.disconnect();
  }, []);

  // Create the globe once we have a width (and recreate on width / theme change).
  useEffect(() => {
    if (!width || !canvasRef.current) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let opacity = 0;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: HEIGHT * 2,
      phi: 0,
      theta: 0.26,
      dark: 1,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 5.2,
      baseColor: [0.16, 0.18, 0.21],
      markerColor: accentRgb,
      glowColor: [0.11, 0.34, 0.37],
      markers: [],
      opacity: 0.95,
      onRender: (state) => {
        frame += 1;
        if (opacity < 1) opacity = Math.min(1, opacity + 0.04);
        if (!pointerInteracting.current && !reduce) phiRef.current += 0.0038;
        state.phi = phiRef.current + pointerMovement.current / 200;
        state.width = width * 2;
        state.height = HEIGHT * 2;
        // Pulse the active markers; historical markers stay steady.
        const pulse = reduce ? 1 : 0.55 + 0.45 * Math.sin(frame * 0.08);
        state.markers = markersRef.current.map((m) => ({
          location: m.location,
          size: m.active ? m.baseSize * (0.7 + 0.85 * pulse) : m.baseSize,
        }));
      },
    });

    requestAnimationFrame(() => { if (canvasRef.current) canvasRef.current.style.opacity = '1'; });
    return () => globe.destroy();
  }, [width, accentRgb]);

  const onPointerDown = (e) => {
    pointerInteracting.current = e.clientX - pointerMovement.current;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  };
  const onPointerUp = () => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  };
  const onPointerMove = (e) => {
    if (pointerInteracting.current === null) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    pointerMovement.current = clientX - pointerInteracting.current;
  };

  const hasPoints = markersRef.current.length > 0 || points.length > 0;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <span className="text-ink-faint"><Icon name="globe" size={16} /></span>
          <span className="eyebrow">Where visitors are</span>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--accent)' }} />
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
              </span>
              {activeCount} active now
            </span>
          )}
          <span className="text-ink-faint">
            {countriesLocated} {countriesLocated === 1 ? 'country' : 'countries'} located
          </span>
        </div>
      </div>

      <div ref={wrapRef} className="relative mt-3" style={{ height: HEIGHT }}>
        {!hasPoints && (
          <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
            <div className="text-center px-6">
              <p className="text-ink-muted text-sm">No located visitors yet.</p>
              <p className="text-ink-faint text-[12px] mt-1">Markers appear here as visits arrive.</p>
            </div>
          </div>
        )}
        {width > 0 && (
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerOut={onPointerUp}
            onMouseMove={onPointerMove}
            onTouchMove={onPointerMove}
            style={{
              width,
              height: HEIGHT,
              maxWidth: '100%',
              cursor: 'grab',
              contain: 'layout paint size',
              opacity: 0,
              transition: 'opacity 0.6s var(--ease-out, ease)',
            }}
          />
        )}
        {demo && (
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-ink-faint text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--surface) 70%, transparent)' }}>
              demo locations — local visits shown near {countryHint(points)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function countryHint(points) {
  const withCountry = points.find((p) => p.country && p.country !== 'Local' && p.country !== 'Unknown');
  return withCountry ? withCountry.country : 'the demo region';
}
