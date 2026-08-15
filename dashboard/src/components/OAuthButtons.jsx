import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

const PROVIDERS = [
  { key: 'google', label: 'Google' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'apple', label: 'Apple' },
];

const GLYPH = {
  google: <path d="M12 11v2.8h4c-.2 1-.9 1.9-2 2.5v2h3.2c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z M6.5 12A5.5 5.5 0 0112 6.5c1.4 0 2.6.5 3.6 1.4l2-2A8.5 8.5 0 003.6 8.9l2.5 2A5.5 5.5 0 016.5 12z M6.1 13.1l-2.5 2A8.5 8.5 0 0012 20.5c2.3 0 4.2-.8 5.6-2.1l-3.2-2c-.6.4-1.4.6-2.4.6a5.5 5.5 0 01-5.2-3.9z" />,
  facebook: <path d="M15 8h-2a1 1 0 00-1 1v2h3l-.5 3H12v7H9v-7H7v-3h2V8.5A3.5 3.5 0 0112.5 5H15v3z" />,
  apple: <path d="M16 13.5c0 2.5 2 3.3 2 3.4-.1.3-.4 1.3-1.2 2.3-.7.9-1.4 1.8-2.5 1.8s-1.4-.6-2.6-.6-1.6.6-2.6.7c-1 0-1.8-1-2.5-1.9-1.5-2-2.6-5.7-1.1-8.2.7-1.2 2-2 3.4-2 1 0 2 .7 2.6.7.6 0 1.8-.8 3-.7.5 0 2 .2 2.9 1.5-.1 0-1.8 1-1.8 3.2zM14 6.2c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.7-.4 2.3-1.1z" />,
};

export function OAuthButtons() {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const onClick = async (provider) => {
    setBusy(provider.key);
    try {
      await api.get(`/auth/oauth/${provider.key}`, { auth: false });
    } catch (e) {
      // Stub endpoints return 501 with a clear message — surface it.
      toast.info(e.data?.message || `${provider.label} sign-in isn’t set up yet.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {PROVIDERS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onClick(p)}
          disabled={busy === p.key}
          className="btn btn-secondary h-11 disabled:opacity-60"
          title={`Continue with ${p.label}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {GLYPH[p.key]}
          </svg>
          <span className="sr-only">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
