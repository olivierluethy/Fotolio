import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Brand';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';

function Nav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-16 flex items-center transition-all"
      style={{
        background: scrolled ? 'color-mix(in srgb, var(--surface) 85%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <div className="max-w-content w-full mx-auto px-6 flex items-center justify-between">
        <Wordmark className="text-xl" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button as={Link} to="/app">Open dashboard</Button>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" className="hidden sm:inline-flex">Sign in</Button>
              <Button as={Link} to="/register">Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const WORDS = ['load instantly.', 'look effortless.', 'feel like yours.'];

function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WORDS.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden" style={{ background: '#0b0c0f' }}>
      <img src="/landing-1.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,12,15,.5), rgba(10,12,15,.4) 40%, rgba(10,12,15,.9))' }} />
      <div className="relative max-w-content w-full mx-auto px-6 pt-24 text-white">
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,.72)' }}>Photo portfolio platform</div>
        <h1 className="font-display font-extrabold tracking-tight mt-4 leading-[1.03]" style={{ fontSize: 'clamp(2.6rem, 7vw, 5rem)' }}>
          Portfolios that<br />
          <span className="inline-block h-[1.1em] overflow-hidden align-bottom">
            <span key={i} style={{ color: 'var(--accent-bright)', display: 'inline-block', animation: 'toastIn .5s cubic-bezier(0.57,1.52,0.9,1.08)' }}>
              {WORDS[i]}
            </span>
          </span>
        </h1>
        <p className="mt-6 text-lg max-w-xl" style={{ color: 'rgba(255,255,255,.86)' }}>
          Upload your photos, let Fotolio optimise every one for the web automatically, arrange them
          into galleries, and publish your own portfolio site — on your own domain.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button as={Link} to="/register" size="lg" iconRight="chevronRight">Start building free</Button>
          <Button as="a" href="/@meggen-studio" target="_blank" size="lg" variant="secondary" icon="eye"
            style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>
            See a live site
          </Button>
        </div>

        <div className="mt-12 inline-flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm px-5 py-4 rounded-xl"
          style={{ background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.14)' }}>
          <span style={{ color: 'rgba(255,255,255,.6)' }}>every upload, automatically</span>
          <span className="opacity-40">|</span>
          <span style={{ color: 'rgba(255,255,255,.8)' }}>4.2 MB</span>
          <Icon name="chevronRight" size={14} className="opacity-40" />
          <span className="text-white font-semibold">0.5 MB</span>
          <span className="font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>−88%</span>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', icon: 'upload', title: 'Upload anything', body: 'Drag a folder, drop a ZIP, paste a URL, or pick files. JPEG, PNG, WebP and more — all in one place.' },
  { n: '02', icon: 'sparkle', title: 'We optimise it', body: 'Every photo becomes fast, responsive WebP with JPEG fallbacks and a blur placeholder. You see exactly how much lighter it got.' },
  { n: '03', icon: 'rocket', title: 'Publish your site', body: 'Group photos into galleries, design your hero, and go live at your slug, a subdomain, or your own domain.' },
];

const FEATURES = [
  { icon: 'gauge', title: 'Automatic optimisation', body: 'Lossy-but-beautiful downscaling with a visible before/after and real % saved.' },
  { icon: 'grid', title: 'Galleries, your way', body: 'Create, reorder and assign photos to as many galleries as you like.' },
  { icon: 'layout', title: 'A hero you control', body: 'Single image or slideshow, overlay text, parallax, and an animated reveal.' },
  { icon: 'file', title: 'About & custom pages', body: 'Add rich content pages — only the ones you want, never empty stubs.' },
  { icon: 'globe', title: 'Your own domain', body: 'Publish on a subdomain or connect a custom domain with guided DNS.' },
  { icon: 'image', title: 'Metadata from EXIF', body: 'Camera, lens and capture date are read automatically to prefill each photo.' },
];

export default function Landing() {
  return (
    <div className="bg-bg">
      <Nav />
      <Hero />

      {/* Problem → solution */}
      <section className="max-w-content mx-auto px-6 py-24">
        <div className="max-w-2xl">
          <div className="eyebrow">Why Fotolio</div>
          <h2 className="font-display font-bold mt-3 leading-tight text-ink" style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)' }}>
            The two things that make photo sites bad — solved by default.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <div className="card p-8">
            <div className="badge-accent badge">Problem 1</div>
            <h3 className="font-display font-semibold text-xl mt-4 text-ink">Big images make sites slow</h3>
            <p className="text-ink-muted mt-2">A single unoptimised photo can be several megabytes. Fotolio rebuilds every image into web-ready sizes and shows you the saving on each one.</p>
            <div className="mt-6 font-mono text-sm flex items-center gap-3 p-3 rounded-lg bg-surface-2">
              <span className="text-ink-muted">3.8 MB</span><Icon name="chevronRight" size={14} className="text-ink-faint" />
              <span className="text-ink font-semibold">0.42 MB</span>
              <span className="badge-success badge ml-auto">−89%</span>
            </div>
          </div>
          <div className="card p-8">
            <div className="badge-accent badge">Problem 2</div>
            <h3 className="font-display font-semibold text-xl mt-4 text-ink">Clunky, dated interfaces</h3>
            <p className="text-ink-muted mt-2">A modern builder for you, and a fast, correct theme for your visitors — sticky gallery nav, a smooth lightbox, and a mobile menu that just works.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Sticky gallery nav', 'Symmetric lightbox', 'No menu flicker', 'LQIP placeholders'].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className="max-w-content mx-auto px-6 py-24">
          <div className="eyebrow">How it works</div>
          <h2 className="font-display font-bold mt-3 text-ink" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>Three steps to live.</h2>
          <div className="grid md:grid-cols-3 gap-5 mt-12">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-8">
                <div className="flex items-center justify-between">
                  <span className="w-11 h-11 rounded-lg grid place-items-center" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span className="font-mono text-2xl font-semibold text-ink-faint">{s.n}</span>
                </div>
                <h3 className="font-display font-semibold text-xl mt-5 text-ink">{s.title}</h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-content mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-10">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="text-accent"><Icon name={f.icon} size={24} /></span>
              <h3 className="font-display font-semibold text-lg mt-3 text-ink">{f.title}</h3>
              <p className="text-ink-muted mt-1.5 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden" style={{ background: '#0b0c0f' }}>
        <img src="/landing-3.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,12,15,.7), rgba(10,12,15,.92))' }} />
        <div className="relative max-w-content mx-auto px-6 py-28 text-center text-white">
          <h2 className="font-display font-extrabold tracking-tight" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)' }}>
            Your photographs deserve their own home.
          </h2>
          <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,.85)' }}>
            Set up your studio in minutes. No credit card, no code.
          </p>
          <div className="mt-8 flex justify-center">
            <Button as={Link} to="/register" size="lg" iconRight="chevronRight">Create your portfolio</Button>
          </div>
        </div>
      </section>

      <footer className="max-w-content mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4">
        <Wordmark />
        <p className="font-mono text-[12px] text-ink-faint">© {new Date().getFullYear()} Fotolio · Made for photographers</p>
      </footer>
    </div>
  );
}
