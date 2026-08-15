import { useRef, useState } from 'react';
import { humanBytes, pct, seconds } from '../lib/format';
import { Icon } from './ui/Icon';

// The signature element: a draggable split between the original and the
// optimised image, with a mono instrument readout of the saving.
export function OptimizationLoupe({ image, height = 300 }) {
  const [split, setSplit] = useState(50);
  const ref = useRef(null);
  const m = image.metrics || {};
  const optimised = image.variants?.large?.webp || image.variants?.medium?.webp;

  const move = (clientX) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setSplit(Math.max(0, Math.min(100, p)));
  };
  const onDown = (e) => {
    e.preventDefault();
    const onMove = (ev) => move((ev.touches ? ev.touches[0] : ev).clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    move((e.touches ? e.touches[0] : e).clientX);
  };

  return (
    <div>
      <div
        ref={ref}
        className="relative overflow-hidden rounded-lg border select-none cursor-ew-resize bg-surface-2"
        style={{ height }}
        onPointerDown={onDown}
      >
        {/* Optimised (base layer) */}
        <img src={optimised} alt="Optimised" className="absolute inset-0 w-full h-full object-contain" draggable="false" />
        {/* Original (clipped to the left of the handle) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${split}%` }}>
          <img
            src={image.original_url}
            alt="Original"
            className="absolute inset-0 h-full object-contain"
            style={{ width: ref.current?.offsetWidth || '100%', maxWidth: 'none' }}
            draggable="false"
          />
        </div>

        {/* Labels */}
        <span className="absolute top-2 left-2 badge" style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}>Original</span>
        <span className="absolute top-2 right-2 badge-accent badge">Optimised</span>

        {/* Handle */}
        <div className="absolute top-0 bottom-0" style={{ left: `${split}%`, transform: 'translateX(-50%)' }}>
          <div className="w-0.5 h-full" style={{ background: 'var(--accent)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full grid place-items-center shadow-md"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            <Icon name="drag" size={16} />
          </div>
        </div>
      </div>

      {/* Instrument readout */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[13px]">
        <span className="text-ink-muted">{m.original_human || humanBytes(m.original_bytes)}</span>
        <Icon name="chevronRight" size={13} className="text-ink-faint" />
        <span className="text-ink font-semibold">{m.optimised_human || humanBytes(m.optimised_bytes)}</span>
        <span className="badge-success badge">−{pct(m.reduction_pct)}</span>
        <span className="text-ink-faint ml-auto">
          {seconds(m.load_original_s)} → <span className="text-accent">{seconds(m.load_optimised_s)}</span> @ {m.reference_mbps || 5}&nbsp;Mbps
        </span>
      </div>
    </div>
  );
}
