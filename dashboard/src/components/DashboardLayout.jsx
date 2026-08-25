import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Wordmark } from './Brand';
import { Icon } from './ui/Icon';
import { ThemeToggle } from './ThemeToggle';
import { ErrorBoundary } from './ErrorBoundary';
import { classNames } from '../lib/format';

const NAV = [
  { to: '/app', end: true, icon: 'gauge', label: 'Overview' },
  { to: '/app/analytics', icon: 'activity', label: 'Analytics' },
  { to: '/app/upload', icon: 'upload', label: 'Upload' },
  { to: '/app/library', icon: 'image', label: 'Library' },
  { to: '/app/sites', icon: 'layers', label: 'Sites' },
  { to: '/app/editor', icon: 'layout', label: 'Site editor' },
  { to: '/app/settings', icon: 'settings', label: 'Settings & publish' },
];

export function DashboardLayout() {
  const { user, site, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  const NavItems = ({ onClick }) => (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onClick}
          className={({ isActive }) =>
            classNames(
              'relative flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium transition-colors',
              isActive ? 'text-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            )
          }
          style={({ isActive }) => (isActive ? { background: 'var(--accent-weak)' } : undefined)}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
              <Icon name={item.icon} size={18} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-60 flex-col border-r bg-surface fixed inset-y-0 z-30">
        <div className="h-16 flex items-center px-5 border-b">
          <Wordmark className="text-lg" markSize={24} />
        </div>
        <div className="flex-1 py-4 overflow-y-auto">
          <NavItems />
        </div>
        <AccountBox user={user} site={site} onLogout={onLogout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface border-r flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b">
              <Wordmark className="text-lg" markSize={24} />
              <button onClick={() => setMobileOpen(false)} className="text-ink-faint"><Icon name="x" /></button>
            </div>
            <div className="flex-1 py-4 overflow-y-auto"><NavItems onClick={() => setMobileOpen(false)} /></div>
            <AccountBox user={user} site={site} onLogout={onLogout} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        <header className="h-16 border-b bg-surface/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-ink-muted" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <Icon name="menu" />
            </button>
            <PublishPill site={site} />
          </div>
          <div className="flex items-center gap-2">
            {site?.public_url && (
              <a href={site.public_url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                <Icon name="eye" size={15} /> View site
              </a>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-content w-full mx-auto">
          {/* Keyed by path so each page gets a fresh boundary — a crash on one
              route is contained and clears when you navigate away. */}
          <ErrorBoundary key={location.pathname} label="page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function PublishPill({ site }) {
  if (!site) return null;
  const live = site.published;
  return (
    <span className="badge" style={{ background: live ? 'var(--accent-weak)' : 'var(--surface-2)', color: live ? 'var(--accent)' : 'var(--ink-muted)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: live ? 'var(--accent)' : 'var(--ink-faint)' }} />
      {live ? 'Published' : 'Draft'}
    </span>
  );
}

function AccountBox({ user, onLogout }) {
  return (
    <div className="border-t p-3 flex items-center gap-3">
      {user?.avatar_path ? (
        <img src={user.avatar_path} alt="" className="w-9 h-9 rounded-full object-cover flex-none border" />
      ) : (
        <div className="w-9 h-9 rounded-full grid place-items-center font-mono text-sm flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
          {(user?.name || 'U').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate text-ink">{user?.name}</div>
        <div className="text-[12px] truncate text-ink-faint">{user?.email}</div>
      </div>
      <button onClick={onLogout} className="text-ink-faint hover:text-danger" aria-label="Sign out" title="Sign out">
        <Icon name="logout" size={18} />
      </button>
    </div>
  );
}
