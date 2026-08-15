import { useState } from 'react';
import { useSiteEditor } from './editor/useSiteEditor';
import { Inspector } from './editor/Inspector';
import { Button, Spinner } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { classNames } from '../lib/format';

export default function SiteEditor() {
  const e = useSiteEditor();

  if (e.loading) {
    return <div className="grid place-items-center py-24 text-accent"><Spinner size={28} /></div>;
  }

  return (
    // Break out of the padded, max-width dashboard main so the canvas gets the
    // full area beside the sidebar — the editing surface is the whole point.
    <div className="fixed inset-0 top-16 lg:left-60 z-10 flex flex-col bg-bg">
      <TopBar e={e} />
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="border-r bg-surface flex flex-col min-h-0">
          <TabStrip e={e} />
          <div className="flex-1 overflow-y-auto">
            <Inspector e={e} />
          </div>
        </aside>
        <div className="relative bg-surface-2 hidden lg:block">
          {e.canvasSrc ? (
            <iframe ref={e.canvasRef} src={e.canvasSrc} title="Your site — live editing canvas"
              className="w-full h-full border-0 bg-white" />
          ) : (
            <div className="w-full h-full grid place-items-center text-accent"><Spinner size={24} /></div>
          )}
        </div>
      </div>
      <div className="lg:hidden px-4 py-3 text-[13px] text-ink-muted border-t bg-surface">
        Open the editor on a larger screen to edit your site on the live canvas.
      </div>
    </div>
  );
}

/* ---- Top bar: status + preview / publish / discard ---------------------- */
function TopBar({ e }) {
  const [busy, setBusy] = useState('');
  const run = (key, fn) => async () => { setBusy(key); try { await fn(); } finally { setBusy(''); } };

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b bg-surface flex-none">
      <div className="flex items-center gap-2 min-w-0">
        <Icon name="layout" size={18} className="text-accent flex-none" />
        <span className="font-display font-bold text-ink truncate">Site editor</span>
        <StatusPill e={e} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SaveState state={e.saving} />
        {e.dirty && (
          <button className="btn btn-ghost btn-sm !text-ink-muted" disabled={busy === 'discard'}
            onClick={run('discard', async () => { if (confirm('Discard your unpublished changes and go back to the published version?')) await e.discard(); })}>
            {busy === 'discard' ? <Spinner size={14} /> : <Icon name="x" size={15} />} Discard
          </button>
        )}
        <Button size="sm" variant="secondary" icon="eye" loading={busy === 'preview'} onClick={run('preview', e.openPreview)}>Preview</Button>
        <Button size="sm" icon="rocket" loading={busy === 'publish'} disabled={!e.dirty && e.publishedLive}
          onClick={run('publish', e.publish)}>Publish</Button>
      </div>
    </header>
  );
}

function StatusPill({ e }) {
  let label, bg, color, dot;
  if (e.dirty) { label = 'Unpublished changes'; bg = 'color-mix(in srgb, var(--warn) 16%, transparent)'; color = 'var(--warn)'; dot = 'var(--warn)'; }
  else if (e.publishedLive) { label = 'Published'; bg = 'var(--accent-weak)'; color = 'var(--accent)'; dot = 'var(--accent)'; }
  else { label = 'Not published yet'; bg = 'var(--surface-2)'; color = 'var(--ink-muted)'; dot = 'var(--ink-faint)'; }
  return (
    <span className="badge ml-1.5" style={{ background: bg, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} /> {label}
    </span>
  );
}

function SaveState({ state }) {
  if (state === 'saving') return <span className="text-[12px] text-ink-faint flex items-center gap-1.5"><Spinner size={12} /> Saving…</span>;
  if (state === 'error') return <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--danger)' }}><Icon name="alert" size={13} /> Couldn’t save</span>;
  return <span className="text-[12px] text-ink-faint flex items-center gap-1.5"><Icon name="check" size={13} /> All changes saved</span>;
}

/* ---- Tab strip + contextual back ---------------------------------------- */
const TABS = [
  { key: 'site', label: 'Site', icon: 'settings', select: { kind: 'site' }, path: '' },
  { key: 'galleries', label: 'Galleries', icon: 'grid', select: { kind: 'nav' }, path: '' },
  { key: 'pages', label: 'Pages', icon: 'file', select: { kind: 'pages' } },
];
function TabStrip({ e }) {
  const sel = e.selection;
  const active = sel.kind === 'site' ? 'site'
    : (sel.kind === 'nav' || sel.kind === 'gallery') ? 'galleries'
    : (sel.kind === 'pages' || sel.kind === 'page') ? 'pages'
    : sel.kind === 'hero' ? (sel.target?.startsWith('gallery') ? 'galleries' : sel.target?.startsWith('page') ? 'pages' : 'site')
    : 'site';

  const deep = ['gallery', 'page', 'hero'].includes(sel.kind);
  const goBack = () => {
    if (sel.kind === 'gallery') e.setSelection({ kind: 'nav' });
    else if (sel.kind === 'page') e.setSelection({ kind: 'pages' });
    else if (sel.kind === 'hero') {
      const t = sel.target || 'home';
      if (t.startsWith('gallery:')) e.setSelection({ kind: 'gallery', id: Number(t.split(':')[1]) });
      else if (t.startsWith('page:')) e.setSelection({ kind: 'page', id: Number(t.split(':')[1]) });
      else e.setSelection({ kind: 'site' });
    }
  };

  return (
    <div className="border-b flex-none">
      <div className="flex px-2 pt-2 gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { e.setSelection(t.select); if (t.path !== undefined) e.navigateCanvas(t.path); }}
            className={classNames(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md text-[13px] font-medium transition-colors',
              active === t.key ? 'text-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            )}
            style={active === t.key ? { background: 'var(--accent-weak)' } : undefined}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>
      {deep && (
        <button onClick={goBack} className="flex items-center gap-1 px-4 py-2 text-[12px] text-ink-muted hover:text-ink">
          <Icon name="chevronLeft" size={14} /> Back
        </button>
      )}
    </div>
  );
}
