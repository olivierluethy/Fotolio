import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHead } from './Upload';
import { Button, Spinner, IconButton } from '../components/ui/Button';
import { Field, Input, Toggle, Segmented, Select } from '../components/ui/Controls';
import { Icon } from '../components/ui/Icon';
import { ImagePicker } from '../components/ImagePicker';
import { Sortable } from '../components/Sortable';

const DEFAULT_HEADER = {
  mode: 'single',
  image_ids: [],
  slideshow: { autoplay: true, interval: 5000, controls: true },
  overlay: { title: '', subtitle: '', position: 'center', align: 'center', style: 'light' },
  animate_text: true,
  rotating_words: [],
  parallax: true,
  height: 'tall',
};

export default function HeaderBuilder() {
  const { site, setSite } = useAuth();
  const toast = useToast();
  const [galleries, setGalleries] = useState([]);
  const [pages, setPages] = useState([]);
  const [target, setTarget] = useState({ type: 'site' });
  const [config, setConfig] = useState(null);
  const [imagesById, setImagesById] = useState({});
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/galleries'), api.get('/pages'), api.get('/images')]).then(([g, p, i]) => {
      setGalleries(g.galleries);
      setPages(p.pages);
      const map = {};
      i.images.forEach((img) => { map[img.id] = img; });
      setImagesById(map);
    });
  }, []);

  // Load the stored config for the current target.
  useEffect(() => {
    let stored = null;
    if (target.type === 'site') stored = site?.home_header;
    else if (target.type === 'gallery') stored = galleries.find((g) => g.id === target.id)?.header_config;
    else if (target.type === 'page') stored = pages.find((p) => p.id === target.id)?.header_config;
    setConfig({ ...DEFAULT_HEADER, ...(stored || {}), overlay: { ...DEFAULT_HEADER.overlay, ...(stored?.overlay || {}) }, slideshow: { ...DEFAULT_HEADER.slideshow, ...(stored?.slideshow || {}) } });
  }, [target, site, galleries, pages]);

  const headerImages = useMemo(
    () => (config?.image_ids || []).map((id) => imagesById[id]).filter(Boolean),
    [config, imagesById]
  );

  if (!config) return <div className="grid place-items-center py-24 text-accent"><Spinner size={26} /></div>;

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const setOverlay = (patch) => setConfig((c) => ({ ...c, overlay: { ...c.overlay, ...patch } }));
  const setSlide = (patch) => setConfig((c) => ({ ...c, slideshow: { ...c.slideshow, ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      if (target.type === 'site') {
        const { site: s } = await api.patch('/site', { home_header: config });
        setSite(s);
      } else if (target.type === 'gallery') {
        const { gallery } = await api.patch(`/galleries/${target.id}`, { header_config: config });
        setGalleries((gs) => gs.map((g) => (g.id === gallery.id ? gallery : g)));
      } else {
        const { page } = await api.patch(`/pages/${target.id}`, { header_config: config });
        setPages((ps) => ps.map((p) => (p.id === page.id ? page : p)));
      }
      toast.success('Header saved.');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const targetOptions = [
    { value: 'site', label: 'Site home' },
    ...galleries.filter((g) => !g.is_home).map((g) => ({ value: `gallery:${g.id}`, label: `Gallery · ${g.name}` })),
    ...pages.map((p) => ({ value: `page:${p.id}`, label: `Page · ${p.title}` })),
  ];
  const targetValue = target.type === 'site' ? 'site' : `${target.type}:${target.id}`;
  const onTargetChange = (v) => {
    if (v === 'site') setTarget({ type: 'site' });
    else { const [t, id] = v.split(':'); setTarget({ type: t, id: +id }); }
  };

  return (
    <div>
      <PageHead
        title="Header & hero"
        subtitle="Design the hero for your site home, any gallery, or any page."
        action={<Button onClick={save} loading={saving} icon="check">Save header</Button>}
      />

      <div className="mb-6 max-w-md">
        <Field label="Editing header for">
          <Select value={targetValue} onChange={(e) => onTargetChange(e.target.value)}>
            {targetOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </Field>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-5">
          <Section title="Images">
            <div className="flex items-center justify-between mb-3">
              <Segmented value={config.mode} onChange={(v) => set({ mode: v })}
                options={[{ value: 'single', label: 'Single image' }, { value: 'slideshow', label: 'Slideshow' }]} />
              <Button size="sm" variant="secondary" icon="plus" onClick={() => setPicking(true)}>Choose</Button>
            </div>
            {headerImages.length === 0 ? (
              <p className="text-sm text-ink-faint">No image selected. Choose at least one for the hero.</p>
            ) : (
              <Sortable
                items={headerImages}
                onReorder={(next) => set({ image_ids: next.map((i) => i.id) })}
                className="grid grid-cols-4 gap-2"
                render={(img) => (
                  <div className="relative group aspect-video rounded-md overflow-hidden border bg-surface-2">
                    <img src={img.variants?.thumb?.webp} alt="" className="w-full h-full object-cover" draggable="false" />
                    <button onClick={() => set({ image_ids: config.image_ids.filter((id) => id !== img.id) })}
                      className="absolute top-1 right-1 w-5 h-5 rounded grid place-items-center opacity-0 group-hover:opacity-100"
                      style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }} aria-label="Remove"><Icon name="x" size={12} /></button>
                  </div>
                )}
              />
            )}
            {config.mode === 'slideshow' && headerImages.length > 1 && (
              <div className="mt-4 space-y-3 pt-3 border-t">
                <Toggle checked={config.slideshow.autoplay} onChange={(v) => setSlide({ autoplay: v })} label="Autoplay" />
                {config.slideshow.autoplay && (
                  <Field label={`Interval — ${(config.slideshow.interval / 1000).toFixed(1)}s`}>
                    <input type="range" min="2000" max="10000" step="500" value={config.slideshow.interval}
                      onChange={(e) => setSlide({ interval: +e.target.value })} className="w-full accent-[var(--accent)]" />
                  </Field>
                )}
                <Toggle checked={config.slideshow.controls} onChange={(v) => setSlide({ controls: v })} label="Show manual controls (arrows & dots)" />
              </div>
            )}
          </Section>

          <Section title="Overlay text">
            <div className="space-y-3">
              <Field label="Title"><Input value={config.overlay.title} onChange={(e) => setOverlay({ title: e.target.value })} placeholder={site?.title} /></Field>
              <Field label="Subtitle"><Input value={config.overlay.subtitle} onChange={(e) => setOverlay({ subtitle: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Position">
                  <Segmented value={config.overlay.position} onChange={(v) => setOverlay({ position: v })}
                    options={[{ value: 'top', label: 'Top' }, { value: 'center', label: 'Mid' }, { value: 'bottom', label: 'Low' }]} />
                </Field>
                <Field label="Alignment">
                  <Segmented value={config.overlay.align} onChange={(v) => setOverlay({ align: v })}
                    options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Motion">
            <div className="space-y-3">
              <Toggle checked={config.animate_text} onChange={(v) => set({ animate_text: v })} label="Animated “text pops up” reveal" />
              {config.animate_text && (
                <Field label="Rotating words" hint="Comma-separated — they rise and fade in turn">
                  <Input value={(config.rotating_words || []).join(', ')}
                    onChange={(e) => set({ rotating_words: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Above the lake, Golden hour, Alpine light" />
                </Field>
              )}
              <Toggle checked={config.parallax} onChange={(v) => set({ parallax: v })} label="Parallax scrolling" />
              <Field label="Height">
                <Segmented value={config.height} onChange={(v) => set({ height: v })}
                  options={[{ value: 'medium', label: 'Medium' }, { value: 'tall', label: 'Tall' }, { value: 'full', label: 'Full screen' }]} />
              </Field>
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="eyebrow mb-2">Live preview</div>
          <HeroPreview config={config} images={headerImages} />
          <p className="text-[12px] text-ink-faint mt-2">Slideshow and reveal animations play on your published site.</p>
        </div>
      </div>

      {picking && (
        <ImagePicker
          open
          multiple
          title="Choose hero images"
          onClose={() => setPicking(false)}
          onConfirm={(ids) => { set({ image_ids: ids }); setPicking(false); }}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-ink mb-3">{title}</h3>
      {children}
    </div>
  );
}

function HeroPreview({ config, images }) {
  const bg = images[0]?.variants?.large?.webp || images[0]?.variants?.medium?.webp;
  const posClass = { top: 'items-start pt-8', center: 'items-center', bottom: 'items-end pb-8' }[config.overlay.position];
  const alignClass = { left: 'text-left items-start', center: 'text-center items-center', right: 'text-right items-end' }[config.overlay.align];
  const h = { medium: 220, tall: 300, full: 360 }[config.height];

  return (
    <div className="rounded-xl overflow-hidden border relative flex flex-col justify-center" style={{ height: h, background: '#0b0c0f' }}>
      {bg ? <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-white/40"><Icon name="image" size={32} /></div>}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,12,15,.35), rgba(10,12,15,.65))' }} />
      <div className={`relative z-10 h-full flex flex-col justify-center px-6 ${posClass}`}>
        <div className={`flex flex-col w-full ${alignClass}`}>
          <div className="font-display font-extrabold text-white leading-tight" style={{ fontSize: 'clamp(1.3rem,3vw,2rem)', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>
            {config.overlay.title || 'Your title'}
          </div>
          {config.overlay.subtitle && <div className="text-white/85 text-sm mt-1.5">{config.overlay.subtitle}</div>}
          {config.animate_text && config.rotating_words?.length > 0 && (
            <div className="font-display font-bold mt-2" style={{ color: 'var(--accent-bright)' }}>{config.rotating_words[0]}</div>
          )}
        </div>
      </div>
      {config.mode === 'slideshow' && images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (<span key={i} className="h-1.5 rounded-full" style={{ width: i === 0 ? 16 : 6, background: i === 0 ? '#fff' : 'rgba(255,255,255,.5)' }} />))}
        </div>
      )}
    </div>
  );
}
