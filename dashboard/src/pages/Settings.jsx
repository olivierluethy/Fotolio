import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHead } from './Upload';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Input, Textarea, Toggle } from '../components/ui/Controls';
import { Icon } from '../components/ui/Icon';

function Section({ title, subtitle, children, action }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-ink">{title}</h2>
          {subtitle && <p className="text-ink-muted text-sm mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { site, setSite } = useAuth();
  const toast = useToast();

  if (!site) return null;

  return (
    <div className="max-w-3xl">
      <PageHead title="Settings & publish" subtitle="Your site details, web address, and going live." />
      <div className="space-y-6">
        <PublishSection site={site} setSite={setSite} toast={toast} />
        <DetailsSection site={site} setSite={setSite} toast={toast} />
        <SubdomainSection site={site} setSite={setSite} toast={toast} />
        <DomainSection site={site} setSite={setSite} toast={toast} />
        <SocialSection site={site} setSite={setSite} toast={toast} />
      </div>
    </div>
  );
}

function CopyableUrl({ url }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2 font-mono text-sm bg-surface-2 rounded-md px-3 py-2 border">
      <Icon name="link" size={15} className="text-ink-faint flex-none" />
      <a href={url} target="_blank" rel="noopener" className="link truncate flex-1">{url}</a>
      <IconButton name="copy" label="Copy link" size="sm" onClick={() => { navigator.clipboard?.writeText(url); toast.success('Link copied.'); }} />
    </div>
  );
}

function PublishSection({ site, setSite, toast }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      const { site: s, message } = await api.post('/site/publish', { published: !site.published });
      setSite(s); toast.success(message);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Publishing" subtitle={site.published ? 'Your site is live and visible to everyone.' : 'Your site is a private draft.'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-lg grid place-items-center flex-none"
            style={{ background: site.published ? 'var(--accent-weak)' : 'var(--surface-2)', color: site.published ? 'var(--accent)' : 'var(--ink-faint)' }}>
            <Icon name={site.published ? 'globe' : 'eye'} size={22} />
          </span>
          <div>
            <div className="font-medium text-ink">{site.published ? 'Published' : 'Draft'}</div>
            <div className="text-[13px] text-ink-muted">{site.published ? 'Anyone with the link can view it.' : 'Only you can see it.'}</div>
          </div>
        </div>
        <Button onClick={toggle} loading={busy} variant={site.published ? 'secondary' : 'primary'} icon={site.published ? 'eye' : 'rocket'}>
          {site.published ? 'Unpublish' : 'Publish site'}
        </Button>
      </div>
      <div className="mt-4"><CopyableUrl url={site.public_url} /></div>
    </Section>
  );
}

function DetailsSection({ site, setSite, toast }) {
  const [form, setForm] = useState({ title: site.title, tagline: site.tagline || '', slug: site.slug });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const save = async () => {
    setBusy(true); setErrors({});
    try {
      const { site: s } = await api.patch('/site', form);
      setSite(s); setForm({ title: s.title, tagline: s.tagline || '', slug: s.slug });
      toast.success('Site details saved.');
    } catch (e) { setErrors(e.errors || {}); toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Site details" action={<Button size="sm" onClick={save} loading={busy}>Save</Button>}>
      <div className="space-y-4">
        <Field label="Site title" error={errors.title}><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Tagline" error={errors.tagline}><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="A short line under your name" /></Field>
        <Field label="Address slug" error={errors.slug} hint={`Your site lives at /@${form.slug || 'your-slug'}`}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-faint">/@</span>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
          </div>
        </Field>
      </div>
    </Section>
  );
}

function SubdomainSection({ site, setSite, toast }) {
  const [subdomain, setSubdomain] = useState(site.subdomain || '');
  const [enabled, setEnabled] = useState(site.subdomain_enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const { site: s } = await api.put('/site/subdomain', { subdomain, enabled });
      setSite(s); toast.success('Subdomain saved.');
    } catch (e) { setError(e.errors?.subdomain || e.message); toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Subdomain" subtitle="A friendlier address than the slug." action={<Button size="sm" onClick={save} loading={busy}>Save</Button>}>
      <Field error={error}>
        <div className="flex items-center gap-2">
          <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase())} placeholder="your-studio" className="max-w-[220px]" />
          <span className="font-mono text-sm text-ink-faint">.{site.public_url?.includes('localhost') ? 'localhost' : 'fotolio.app'}</span>
        </div>
      </Field>
      <div className="mt-3"><Toggle checked={enabled} onChange={setEnabled} label="Use this subdomain when published" /></div>
    </Section>
  );
}

function DomainSection({ site, setSite, toast }) {
  const [domain, setDomain] = useState(site.custom_domain || '');
  const [records, setRecords] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const { site: s, dns_records, message } = await api.put('/site/domain', { domain });
      setSite(s); setRecords(dns_records); toast.success(message);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setVerifying(true);
    try {
      const { site: s, verified, dns_records, message } = await api.post('/site/domain/verify', {});
      setSite(s); setRecords(dns_records);
      verified ? toast.success(message) : toast.info(message);
    } catch (e) { toast.error(e.message); }
    finally { setVerifying(false); }
  };
  const remove = async () => {
    if (!confirm('Disconnect this custom domain?')) return;
    try { const { site: s } = await api.del('/site/domain'); setSite(s); setDomain(''); setRecords(null); toast.info('Domain removed.'); }
    catch (e) { toast.error(e.message); }
  };

  const connected = !!site.custom_domain;
  return (
    <Section title="Custom domain" subtitle="Publish on a domain you own.">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Domain" className="flex-1 min-w-[220px]">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="studio.example.com" disabled={connected} />
        </Field>
        {connected ? (
          <>
            <Button variant="secondary" onClick={verify} loading={verifying} icon="check">Verify</Button>
            <IconButton name="trash" label="Remove domain" onClick={remove} className="hover:text-danger" />
          </>
        ) : (
          <Button onClick={connect} loading={busy} disabled={!domain.trim()} icon="globe">Connect</Button>
        )}
      </div>

      {connected && (
        <div className="mt-3 flex items-center gap-2">
          {site.domain_verified
            ? <span className="badge-success badge"><Icon name="check" size={12} /> Verified & active</span>
            : <span className="badge" style={{ background: 'color-mix(in srgb, var(--warn) 16%, transparent)', color: 'var(--warn)' }}><Icon name="alert" size={12} /> Awaiting DNS</span>}
          <span className="font-mono text-[13px] text-ink-muted">{site.custom_domain}</span>
        </div>
      )}

      {records && !site.domain_verified && (
        <div className="mt-4">
          <p className="text-sm text-ink-muted mb-2">Add these records at your DNS provider, then click Verify:</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-[13px] font-mono">
              <thead className="bg-surface-2 text-ink-muted">
                <tr>{['Type', 'Name', 'Value'].map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-ink">{r.type}</td>
                    <td className="px-3 py-2 text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-ink break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-ink-faint mt-2">DNS changes can take up to a few hours to propagate. TLS is provisioned automatically once verified.</p>
        </div>
      )}
    </Section>
  );
}

function SocialSection({ site, setSite, toast }) {
  const social = site.settings?.social || {};
  const [form, setForm] = useState({
    instagram: social.instagram || '', website: social.website || '', email: social.email || '',
    footer: site.settings?.footer || '',
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const settings = { ...(site.settings || {}), social: { instagram: form.instagram, website: form.website, email: form.email }, footer: form.footer };
      const { site: s } = await api.patch('/site', { settings });
      setSite(s); toast.success('Saved.');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Links & footer" subtitle="Shown in your site footer." action={<Button size="sm" onClick={save} loading={busy}>Save</Button>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Instagram"><Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="https://instagram.com/…" /></Field>
        <Field label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Contact email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></Field>
        <Field label="Footer note"><Input value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} placeholder="© Your Studio" /></Field>
      </div>
    </Section>
  );
}
