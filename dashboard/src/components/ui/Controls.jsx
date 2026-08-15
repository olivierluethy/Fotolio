import { classNames } from '../../lib/format';

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? (
        <p className="text-[12px] mt-1" style={{ color: 'var(--danger)' }}>{error}</p>
      ) : hint ? (
        <p className="text-[12px] mt-1 text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ error, className = '', ...props }) {
  return <input className={classNames('input', error && '!border-danger', className)} {...props} />;
}

export function Textarea({ error, className = '', rows = 4, ...props }) {
  return <textarea rows={rows} className={classNames('input', error && '!border-danger', className)} {...props} />;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 group"
    >
      <span
        className="relative w-10 h-6 rounded-full transition-colors flex-none"
        style={{ background: checked ? 'var(--accent)' : 'var(--surface-3)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'none' }}
        />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </button>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex p-1 rounded-md bg-surface-2 border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={classNames(
            'px-3 h-8 rounded-sm text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={classNames('input pr-8 appearance-none cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="text-center py-16 px-6">
      {icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-xl grid place-items-center bg-surface-2 text-ink-faint">
          {icon}
        </div>
      )}
      <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
      {children && <p className="text-ink-muted mt-1.5 max-w-md mx-auto text-sm">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
