import { createContext, useContext, useCallback, useState } from 'react';
import { Icon } from '../components/ui/Icon';

const ToastContext = createContext(null);
let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message, type = 'success') => {
      const id = ++idSeq;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5 w-[min(92vw,360px)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in card px-4 py-3 flex items-start gap-3 shadow-lg"
            role="status"
          >
            <span
              className="mt-0.5 flex-none"
              style={{ color: t.type === 'error' ? 'var(--danger)' : t.type === 'info' ? 'var(--accent)' : 'var(--success)' }}
            >
              <Icon name={t.type === 'error' ? 'alert' : t.type === 'info' ? 'info' : 'check'} size={18} />
            </span>
            <p className="text-sm text-ink flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-ink-faint hover:text-ink flex-none">
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
