// Fotolio wordmark + aperture mark, matching brand/aperture.svg.
export function ApertureMark({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke="currentColor"
      strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="42" />
      <path d="M67.3 42 L50 32 L32.7 42 L32.7 62 L50 72 L67.3 62 Z" />
      <path d="M50 32 L58.7 26" /><path d="M67.3 42 L76 47" /><path d="M67.3 62 L76 57" />
      <path d="M50 72 L41.3 78" /><path d="M32.7 62 L24 67" /><path d="M32.7 42 L24 37" />
    </svg>
  );
}

export function Wordmark({ className = '', markSize = 26 }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display font-extrabold tracking-tight ${className}`}>
      <span style={{ color: 'var(--accent)' }}><ApertureMark size={markSize} /></span>
      <span className="text-ink">Fotolio</span>
    </span>
  );
}
