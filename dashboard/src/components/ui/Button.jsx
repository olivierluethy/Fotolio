import { classNames } from '../../lib/format';
import { Icon } from './Icon';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  className = '',
  as: As = 'button',
  ...props
}) {
  return (
    <As
      className={classNames(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 15 : 17} /> : null}
    </As>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconButton({ name, label, size = 'md', variant = 'ghost', className = '', ...props }) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <button
      aria-label={label}
      title={label}
      className={classNames('btn', `btn-${variant}`, dim, 'px-0', className)}
      {...props}
    >
      <Icon name={name} size={size === 'sm' ? 16 : 18} />
    </button>
  );
}
