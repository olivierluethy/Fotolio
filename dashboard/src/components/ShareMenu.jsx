import { useToast } from '../context/ToastContext';
import { Icon } from './ui/Icon';

/**
 * Share a live site: a copy-link button plus one-tap targets (email, WhatsApp,
 * Facebook, X, LinkedIn). Uses the native share sheet when the browser offers
 * one (mobile), and always falls back to the explicit links.
 */
const TARGETS = [
  { key: 'email', label: 'Email', href: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}` },
  { key: 'whatsapp', label: 'WhatsApp', href: (u, t) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}` },
  { key: 'facebook', label: 'Facebook', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'x', label: 'X', href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: 'linkedin', label: 'LinkedIn', href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
];

export function ShareMenu({ url, title = 'Check out my portfolio', compact = false }) {
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      toast.error("Couldn't copy — select and copy the link.");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* dismissed */ }
    } else {
      copy();
    }
  };

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-1.5' : 'space-y-3'}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 border rounded-md px-3 h-9 bg-surface-2">
          <Icon name="link" size={15} className="text-ink-faint flex-none" />
          <span className="font-mono text-[13px] text-ink truncate">{url}</span>
        </div>
        <button onClick={copy} className="flex-none btn btn-secondary btn-sm" title="Copy link">
          <Icon name="copy" size={15} /> Copy
        </button>
        {typeof navigator !== 'undefined' && navigator.share && (
          <button onClick={nativeShare} className="flex-none btn btn-secondary btn-sm" title="Share">
            <Icon name="upload" size={15} /> Share
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TARGETS.map((t) => (
          <a key={t.key} href={t.href(url, title)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border text-[13px] text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors">
            <Icon name="globe" size={14} /> {t.label}
          </a>
        ))}
      </div>
    </div>
  );
}
