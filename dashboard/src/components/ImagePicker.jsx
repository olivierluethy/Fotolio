import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button, Spinner } from './ui/Button';
import { Icon } from './ui/Icon';
import { EmptyState } from './ui/Controls';
import { classNames } from '../lib/format';

// Multi-select picker over the whole library. `excludeIds` hides already-added
// photos. Returns the chosen image ids (or full images) via onConfirm.
export function ImagePicker({ open, onClose, onConfirm, excludeIds = [], multiple = true, title = 'Add photos' }) {
  const [images, setImages] = useState(null);
  const [sel, setSel] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    setSel(new Set());
    api.get('/images').then((d) => setImages(d.images)).catch(() => setImages([]));
  }, [open]);

  if (!open) return null;
  const available = (images || []).filter((i) => !excludeIds.includes(i.id));

  const toggle = (id) => {
    setSel((s) => {
      const n = multiple ? new Set(s) : new Set();
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          <span className="text-sm text-ink-muted mr-auto">{sel.size} selected</span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={sel.size === 0} onClick={() => onConfirm([...sel], (images || []).filter((i) => sel.has(i.id)))}>
            {multiple ? `Add ${sel.size || ''}` : 'Choose'}
          </Button>
        </>
      }
    >
      {!images ? (
        <div className="grid place-items-center py-16 text-accent"><Spinner size={24} /></div>
      ) : available.length === 0 ? (
        <EmptyState icon={<Icon name="image" size={22} />} title="No photos available">
          Every photo is already added, or your library is empty.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-[60vh] overflow-y-auto">
          {available.map((img) => {
            const on = sel.has(img.id);
            return (
              <button
                key={img.id}
                onClick={() => toggle(img.id)}
                className={classNames('relative aspect-square rounded-md overflow-hidden border bg-surface-2', on && 'ring-2 ring-accent')}
              >
                <img src={img.variants?.thumb?.webp} alt={img.title} loading="lazy" className="w-full h-full object-cover" />
                {on && (
                  <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded grid place-items-center" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                    <Icon name="check" size={13} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
