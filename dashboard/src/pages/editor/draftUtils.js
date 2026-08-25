// Helpers for reading and mutating the site draft document (see docs/EDITOR.md).
// The draft mirrors the server document: { site, galleries[], pages[] }.

export function defaultHeader() {
  return {
    mode: 'single',
    image_ids: [],
    slideshow: { autoplay: true, interval: 5000, controls: true },
    overlay: { title: '', subtitle: '', position: 'center', align: 'center', panel: false },
    animate_text: true,
    rotating_words: [],
    parallax: true,
    height: 'tall',
  };
}

export const findGallery = (draft, id) => draft.galleries.find((g) => g.id === Number(id));
export const findPage = (draft, id) => draft.pages.find((p) => p.id === Number(id));

// The header shown for a target, materialised so it can be edited. For a gallery
// with no override, seed from its auto-hero (first photo, gallery name).
export function ensureHeader(draft, target, galleriesById = {}) {
  if (target === 'home') {
    if (!draft.site.home_header) draft.site.home_header = defaultHeader();
    return draft.site.home_header;
  }
  const [kind, idStr] = target.split(':');
  const id = Number(idStr);
  if (kind === 'gallery') {
    const g = findGallery(draft, id);
    if (!g) return defaultHeader();
    if (!g.header_config) {
      const meta = galleriesById[id] || {};
      g.header_config = {
        ...defaultHeader(),
        mode: 'single',
        height: 'medium',
        image_ids: (g.image_ids || []).slice(0, 1),
        overlay: { ...defaultHeader().overlay, title: g.name || meta.name || '', subtitle: g.description || '' },
        animate_text: false,
      };
    }
    return g.header_config;
  }
  if (kind === 'page') {
    const p = findPage(draft, id);
    if (!p) return defaultHeader();
    if (!p.header_config) p.header_config = defaultHeader();
    return p.header_config;
  }
  return defaultHeader();
}

// The header to display for a target without mutating (for panel initial values).
export function readHeader(draft, target, galleriesById = {}) {
  if (target === 'home') return draft.site.home_header || defaultHeader();
  const [kind, idStr] = target.split(':');
  const id = Number(idStr);
  if (kind === 'gallery') {
    const g = findGallery(draft, id);
    if (!g) return defaultHeader();
    if (g.header_config) return g.header_config;
    const meta = galleriesById[id] || {};
    return {
      ...defaultHeader(), mode: 'single', height: 'medium',
      image_ids: (g.image_ids || []).slice(0, 1),
      overlay: { ...defaultHeader().overlay, title: g.name || meta.name || '', subtitle: g.description || '' },
      animate_text: false,
    };
  }
  if (kind === 'page') return (findPage(draft, id)?.header_config) || defaultHeader();
  return defaultHeader();
}

// Ordered secondary-nav items for the canvas (non-home galleries flagged visible).
export function navItems(draft, galleriesById, buildHref, activeSlug = '') {
  return draft.galleries
    .filter((g) => g.show_in_nav && !(galleriesById[g.id]?.is_home))
    .map((g) => {
      const meta = galleriesById[g.id] || {};
      return {
        galleryId: g.id,
        label: g.name || meta.name || 'Untitled',
        href: buildHref(meta.slug || ''),
        active: !!activeSlug && meta.slug === activeSlug,
      };
    });
}

// The path that renders a given target/entity in the canvas.
export const targetPath = (kind, slug) => (kind === 'home' ? '' : slug || '');

export function clone(doc) {
  return typeof structuredClone === 'function' ? structuredClone(doc) : JSON.parse(JSON.stringify(doc));
}

/* ---- Page content blocks ------------------------------------------------ */
// A fresh block for the page editor. Text blocks carry alignment; headings a
// level (H1–H6); images alignment / width / border; tables a row grid.
export function newPageBlock(type) {
  switch (type) {
    case 'heading': return { type: 'heading', text: '', level: 2, align: 'left' };
    case 'subheading': return { type: 'subheading', text: '', align: 'left' };
    case 'quote': return { type: 'quote', text: '', align: 'left' };
    case 'table': return { type: 'table', header: true, rows: [['Column 1', 'Column 2'], ['', '']] };
    case 'image': return { type: 'image', src: '', caption: '', align: 'center', width: 100, border: { width: 0, color: '', radius: 0 } };
    default: return { type: 'paragraph', text: '', align: 'left' };
  }
}

/* ---- Footer ------------------------------------------------------------- */
// The customizable footer model, mirrored server-side by FooterService. Lives at
// draft.site.settings.footer so it flows through draft → preview → publish.

export const FOOTER_FONTS = [
  { value: 'ui', label: 'Sans' },
  { value: 'display', label: 'Display' },
  { value: 'mono', label: 'Mono' },
];

export const SOCIAL_NETWORKS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'email', label: 'Email' },
  { key: 'twitter', label: 'Twitter' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'pinterest', label: 'Pinterest' },
  { key: 'behance', label: 'Behance' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
];

export const FOOTER_BLOCKS = [
  { type: 'text', label: 'Text', icon: 'file' },
  { type: 'heading', label: 'Heading', icon: 'layout' },
  { type: 'links', label: 'Links', icon: 'link' },
  { type: 'social', label: 'Social', icon: 'globe' },
  { type: 'image', label: 'Image', icon: 'image' },
  { type: 'divider', label: 'Divider', icon: 'layers' },
  { type: 'spacer', label: 'Spacer', icon: 'drag' },
];

export function defaultFooterStyle() {
  return {
    bg: '', color: '', link_color: '', align: 'left',
    font_family: 'ui', font_size: 14, font_weight: 400,
    padding_y: 40, border_top_width: 1, border_top_color: '',
  };
}

export function newFooterBlock(type) {
  switch (type) {
    case 'heading': return { type: 'heading', text: '' };
    case 'text': return { type: 'text', text: '' };
    case 'links': return { type: 'links', inline: false, items: [{ label: '', href: '' }] };
    case 'social': return { type: 'social', items: {} };
    case 'image': return { type: 'image', src: '', alt: '', width: 120, href: '' };
    case 'divider': return { type: 'divider' };
    case 'spacer': return { type: 'spacer', size: 16 };
    default: return { type: 'text', text: '' };
  }
}

export function defaultFooter(note = '', social = {}) {
  return {
    columns: [
      { blocks: [{ type: 'heading', role: 'sitename', text: '' }, { type: 'text', role: 'note', text: note }] },
      { blocks: [{ type: 'social', items: { ...social } }] },
    ],
    style: defaultFooterStyle(),
    show_credit: true,
  };
}

function coerceFooter(settings) {
  const raw = settings?.footer;
  if (raw && typeof raw === 'object' && Array.isArray(raw.columns)) {
    return { ...raw, style: { ...defaultFooterStyle(), ...(raw.style || {}) }, show_credit: raw.show_credit !== false };
  }
  const note = typeof raw === 'string' ? raw : '';
  const social = settings?.social && !Array.isArray(settings.social) ? settings.social : {};
  return defaultFooter(note, social);
}

// Materialise the footer on the draft so ops can mutate it (like ensureHeader).
export function ensureFooter(draft) {
  draft.site.settings = draft.site.settings || {};
  const f = coerceFooter(draft.site.settings);
  if (!Array.isArray(f.columns) || !f.columns.length) f.columns = [{ blocks: [] }];
  draft.site.settings.footer = f;
  return f;
}

// Read the footer without mutating (for panel initial values).
export function readFooter(draft) {
  return coerceFooter(draft.site?.settings || {});
}

// First block with a given role across all columns.
export function findFooterRole(footer, role) {
  for (const col of footer.columns || []) {
    const idx = (col.blocks || []).findIndex((b) => b.role === role);
    if (idx >= 0) return col.blocks[idx];
  }
  return null;
}

export function findFooterType(footer, type) {
  for (const col of footer.columns || []) {
    const idx = (col.blocks || []).findIndex((b) => b.type === type);
    if (idx >= 0) return col.blocks[idx];
  }
  return null;
}
