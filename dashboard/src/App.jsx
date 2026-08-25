import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Spinner } from './components/ui/Button';
import { DashboardLayout } from './components/DashboardLayout';
import { ErrorBoundary, lazyWithReload } from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Overview from './pages/Overview';
import Upload from './pages/Upload';
import Library from './pages/Library';
import SiteEditor from './pages/SiteEditor';
import Sites from './pages/Sites';
import Settings from './pages/Settings';

// Lazy: pulls in the cobe WebGL globe only when the Analytics tab is opened.
// lazyWithReload recovers from a stale-chunk 504 after a Vite rebuild/deploy.
const AnalyticsPage = lazyWithReload(() => import('./pages/Analytics'), 'analytics');

function FullPageLoader() {
  return (
    <div className="min-h-screen grid place-items-center text-accent">
      <Spinner size={28} />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route
        path="/app"
        element={
          <Protected>
            <DashboardLayout />
          </Protected>
        }
      >
        <Route index element={<Overview />} />
        <Route path="analytics" element={
          <ErrorBoundary label="Analytics page">
            <Suspense fallback={<div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>}>
              <AnalyticsPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="upload" element={<Upload />} />
        <Route path="library" element={<Library />} />
        <Route path="sites" element={<Sites />} />
        <Route path="editor" element={<SiteEditor />} />
        {/* Legacy routes now live inside the unified Site Editor. */}
        <Route path="galleries" element={<Navigate to="/app/editor" replace />} />
        <Route path="header" element={<Navigate to="/app/editor" replace />} />
        <Route path="pages" element={<Navigate to="/app/editor" replace />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
