import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';

// Split auth screen: form on the left, a photography-forward panel on the right
// that demonstrates the product's promise (a real optimisation readout).
export function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col px-6 sm:px-10 py-8">
        <div className="flex items-center justify-between">
          <Link to="/"><Wordmark className="text-xl" /></Link>
          <ThemeToggle />
        </div>
        <div className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-[12px] text-ink-faint text-center">© {new Date().getFullYear()} Fotolio</p>
      </div>

      <div className="hidden lg:block relative overflow-hidden" style={{ background: '#0b0c0f' }}>
        <img
          src="/showcase.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-90"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,12,15,.15), rgba(10,12,15,.85))' }} />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>Automatic optimisation</div>
          <h2 className="font-display font-bold text-3xl mt-3 max-w-md leading-tight">
            Beautiful photos that load in an instant.
          </h2>
          <div className="mt-6 inline-flex items-center gap-3 font-mono text-sm px-4 py-3 rounded-lg"
            style={{ background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.14)' }}>
            <span className="opacity-70">4.2 MB</span>
            <span className="opacity-50">→</span>
            <span>0.5 MB</span>
            <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>−88%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
