import { Component, lazy } from 'react';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

/**
 * A single failed component (a render error, or a dynamic-import chunk that 504s
 * after a rebuild) must not take down the whole SPA. This boundary catches the
 * error, shows a controlled, on-brand fallback, and offers a recovery path
 * instead of leaving the app on an unhandled runtime error / blank screen.
 *
 * Chunk-load failures are treated specially: after a Vite rebuild or a deploy
 * the previously-loaded module URLs can go stale, so the fix is a fresh reload.
 */
const CHUNK_ERROR = /Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

export function isChunkLoadError(err) {
  const msg = (err && (err.message || String(err))) || '';
  return CHUNK_ERROR.test(msg);
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep real failures loud in the console while giving the user a calm UI.
    // (A dev-time warning printed by a library is not routed here — only thrown
    // errors reach an error boundary — which keeps the two clearly distinct.)
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label || 'app', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  reload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    const title = chunk ? 'This section needs a refresh' : 'Something went wrong here';
    const body = chunk
      ? 'The app was updated in the background and this part failed to load. Reloading will pick up the latest version.'
      : `This ${this.props.label || 'section'} hit an unexpected error. The rest of the app is unaffected — you can try again or reload.`;

    return (
      <div className="grid place-items-center py-20 px-6">
        <div className="max-w-md text-center">
          <div className="inline-grid place-items-center w-12 h-12 rounded-full bg-danger/10 text-danger mb-4">
            <Icon name="alert" size={22} />
          </div>
          <h2 className="font-display font-bold text-xl text-ink">{title}</h2>
          <p className="text-ink-muted text-sm mt-2">{body}</p>
          {import.meta.env?.DEV && (
            <pre className="mt-3 text-left text-[11px] font-mono text-ink-faint bg-surface-2 border rounded-md p-2 overflow-auto max-h-32">
              {String(error.stack || error.message || error)}
            </pre>
          )}
          <div className="flex items-center justify-center gap-2 mt-5">
            {!chunk && <Button variant="secondary" onClick={this.reset}>Try again</Button>}
            <Button onClick={this.reload}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * React.lazy that survives a stale-chunk failure. If a dynamic import fails and
 * the page hasn't already been reloaded for this exact chunk, force one fresh
 * reload (the new build's URLs are then fetched); if it still fails, rethrow so
 * the nearest ErrorBoundary renders its fallback instead of a white screen.
 */
export function lazyWithReload(factory, key = 'chunk') {
  return lazy(() =>
    factory().catch((err) => {
      const flag = `fotolio_reload_${key}`;
      const alreadyReloaded = sessionStorage.getItem(flag);
      if (isChunkLoadError(err) && !alreadyReloaded) {
        sessionStorage.setItem(flag, '1');
        window.location.reload();
        // Return a never-resolving promise so nothing renders before the reload.
        return new Promise(() => {});
      }
      sessionStorage.removeItem(flag);
      throw err;
    }),
  );
}
