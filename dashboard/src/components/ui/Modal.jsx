import { useEffect } from 'react';
import { Icon } from './Icon';
import { classNames } from '../../lib/format';

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];

  return (
    <div
      className="fixed inset-0 z-[150] grid place-items-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ animation: 'toastIn .18s ease' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={classNames('card w-full shadow-lg overflow-hidden flex flex-col max-h-[90vh]', width)}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
            <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close">
              <Icon name="x" size={20} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t bg-surface-2 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
