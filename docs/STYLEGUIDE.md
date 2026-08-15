# Fotolio — Styleguide

> Single source of truth for the Fotolio visual system. Every feature — dashboard SPA and
> server-rendered public theme — must look like it was always part of this product. Colours and
> text styling stay exactly as defined here; new work extends the system, never restyles it.

Product: **Fotolio** (foto + portfolio) — a self-service platform where photographers upload
photos that are automatically optimised for the web, arrange them into galleries, and publish
their own portfolio site.

---

## 1. Design direction — "Darkroom & Lightbox"

The chrome is deliberately **quiet, neutral graphite** so the photographs carry all the colour on
the page. Personality comes from two subject-native moves, not from loud colour:

1. **Lens-coating teal** — the single accent, drawn from the iridescent teal of anti-reflective
   lens coatings. Used sparingly for brand, primary actions and the "savings/optimised" state.
2. **Instrument readout typography** — all measured data (EXIF, byte sizes, reduction %, load-time
   deltas, dimensions) is set in mono, echoing the engraved markings on a lens barrel. The
   optimisation differentiator reads like a camera's control panel.

Signature element: the **before/after optimisation loupe** — a draggable split comparison with a
mono readout of `original → optimised`, `−NN %`, and estimated speed gain at 5 Mbps.

Both a **light** ("Gallery") and **dark** ("Darkroom") theme are first-class. Photos are the only
source of saturation; the UI stays neutral in both.

---

## 2. Colour tokens

Defined as CSS custom properties on `:root` (light) and `:root[data-theme="dark"]` /
`@media (prefers-color-scheme: dark)`. Tailwind maps these via `theme.extend.colors`.

### 2.1 Light theme — "Gallery"

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#FBFBFA` | Page background (warm near-white paper) |
| `--surface` | `#FFFFFF` | Cards, panels, modals |
| `--surface-2` | `#F4F4F2` | Subtle raised / inset fills, table stripes |
| `--surface-3` | `#ECECE9` | Hover fills, skeletons |
| `--ink` | `#16181D` | Primary text (graphite near-black) |
| `--ink-muted` | `#5A5F6B` | Secondary text, labels |
| `--ink-faint` | `#8A909C` | Tertiary text, placeholders, captions |
| `--border` | `#E4E4E1` | Hairline borders, dividers |
| `--border-strong` | `#D3D3CF` | Input borders, stronger separation |
| `--accent` | `#0E7C86` | Primary actions, links, brand, "optimised" |
| `--accent-hover` | `#0A626A` | Accent hover/active |
| `--accent-bright` | `#17B0BD` | Accent highlights, focus glow, charts |
| `--accent-weak` | `#E3F1F2` | Accent-tinted backgrounds, badges |
| `--on-accent` | `#FFFFFF` | Text/icon on accent fills |

### 2.2 Dark theme — "Darkroom"

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#0E0F12` | Page background (blue-graphite near-black) |
| `--surface` | `#16181C` | Cards, panels, modals |
| `--surface-2` | `#1E2126` | Raised fills, table stripes |
| `--surface-3` | `#262A31` | Hover fills, skeletons |
| `--ink` | `#F2F3F4` | Primary text |
| `--ink-muted` | `#A0A6B0` | Secondary text, labels |
| `--ink-faint` | `#6B7280` | Tertiary text, placeholders |
| `--border` | `#26292F` | Hairline borders, dividers |
| `--border-strong` | `#343943` | Input borders |
| `--accent` | `#22B8C4` | Primary actions, links, brand |
| `--accent-hover` | `#38C8D2` | Accent hover/active |
| `--accent-bright` | `#57D6DF` | Highlights, focus glow |
| `--accent-weak` | `#0E2E31` | Accent-tinted backgrounds, badges |
| `--on-accent` | `#06232629` (solid: `#062326`) | Text/icon on accent fills (dark ink on bright teal) |

> On dark, accent fills use **dark ink** (`#062326`) for text, not white — bright teal on white
> text fails contrast.

### 2.3 Semantic (shared, tuned per theme)

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--success` | `#2E7D5B` | `#4FB988` | Confirmations, healthy savings |
| `--warn` | `#C9821E` | `#E4A94C` | Warnings, "heavy" images, safelight amber |
| `--danger` | `#C4443B` | `#E86A60` | Destructive actions, errors |
| `--info` | `#0E7C86` | `#22B8C4` | Info (== accent) |

Semantic colours are for state only — never for decoration.

---

## 3. Typography

Three roles, loaded from Google Fonts (self-host in production — see `docs/DEPLOYMENT.md`).

| Role | Family | Usage |
|------|--------|-------|
| **Display** | `Archivo` (400/600/700/800; Expanded axis for wordmark & hero) | Wordmark, hero headline, big numbers, section titles |
| **UI / Body** | `IBM Plex Sans` (400/500/600/700) | All interface text, paragraphs, buttons, labels |
| **Data / Mono** | `IBM Plex Mono` (400/500/600) | EXIF, byte sizes, `−NN %`, dimensions, slugs, code, DNS records, eyebrows |

Font stacks:
```
--font-display: 'Archivo', 'Segoe UI', system-ui, sans-serif;
--font-ui:      'IBM Plex Sans', system-ui, -apple-system, sans-serif;
--font-mono:    'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

### 3.1 Type scale (px / rem @16)

| Token | Size | Line height | Weight | Use |
|-------|------|-------------|--------|-----|
| `display-xl` | 72 / 4.5 | 1.02 | 800 | Marketing hero |
| `display-lg` | 56 / 3.5 | 1.05 | 700 | Public site hero |
| `display-md` | 40 / 2.5 | 1.1 | 700 | Page titles |
| `h1` | 30 / 1.875 | 1.15 | 700 | Section headings |
| `h2` | 24 / 1.5 | 1.2 | 600 | Subsections |
| `h3` | 20 / 1.25 | 1.3 | 600 | Card titles |
| `body-lg` | 18 / 1.125 | 1.6 | 400 | Lead paragraphs |
| `body` | 16 / 1 | 1.6 | 400 | Default body |
| `body-sm` | 14 / 0.875 | 1.5 | 400 | Secondary, dense UI |
| `caption` | 13 / 0.8125 | 1.4 | 500 | Captions, helper text |
| `micro` | 12 / 0.75 | 1.3 | 500 | Badges, table headers |

### 3.2 Eyebrows / labels (signature detail)

Small technical labels use mono, uppercase, wide tracking — like engraved lens markings:

```
font-family: var(--font-mono);
font-size: 12px;
font-weight: 500;
letter-spacing: 0.14em;
text-transform: uppercase;
color: var(--ink-faint);
```

Instrument readouts (savings, sizes) use mono at `body-sm`, `--ink` for numbers,
`--ink-muted` for units, `--accent` (or `--success`) for the reduction figure.

---

## 4. Spacing, radii, borders, shadows

### 4.1 Spacing scale (4px base)
`0 · 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128`

Section vertical rhythm: 96–128 on desktop, 56–72 on mobile. Card padding: 20–24.
Control padding: 8×12 (sm), 10×16 (md), 12×20 (lg).

### 4.2 Radii — precise, machined (not pill-heavy)
| Token | px | Use |
|-------|----|-----|
| `radius-sm` | 6 | Inputs, badges, small buttons |
| `radius-md` | 8 | Buttons, cards |
| `radius-lg` | 12 | Panels, modals, image tiles |
| `radius-xl` | 16 | Hero cards, large surfaces |
| `radius-full` | 999 | Avatars, status dots, toggles only |

### 4.3 Borders
Hairlines everywhere: `1px solid var(--border)`. Inputs `1px solid var(--border-strong)`.
Focus ring: `0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent)` + `border-color: var(--accent)`.

### 4.4 Shadows — soft, diffuse gallery lighting
```
--shadow-sm: 0 1px 2px rgba(16,24,40,.05);
--shadow-md: 0 4px 12px -2px rgba(16,24,40,.08), 0 2px 6px -2px rgba(16,24,40,.05);
--shadow-lg: 0 16px 40px -8px rgba(16,24,40,.16), 0 4px 12px -4px rgba(16,24,40,.08);
```
Dark theme uses deeper, softer shadows with black at higher alpha and a faint top hairline
(`inset 0 1px 0 rgba(255,255,255,.04)`) for elevation.

---

## 5. Components

### 5.1 Buttons
- **Primary**: `--accent` fill, `--on-accent` text, `radius-md`, weight 600. Hover `--accent-hover`,
  subtle lift (`translateY(-1px)` + `shadow-md`). Active resets lift.
- **Secondary**: `--surface` fill, `1px solid --border-strong`, `--ink` text. Hover `--surface-2`.
- **Ghost**: transparent, `--ink-muted` text. Hover `--surface-2`, text `--ink`.
- **Danger**: `--danger` fill, white text. Used only for destructive confirms.
- Sizes: sm (32h), md (40h), lg (48h). Icon buttons are square at each height.
- Disabled: 45% opacity, `cursor: not-allowed`.

### 5.2 Inputs / selects / textareas
`--surface` fill, `1px solid --border-strong`, `radius-sm`, 40h, `body-sm`. Label above in
`caption`, `--ink-muted`. Helper/error text below in `caption`. Error state: `--danger` border +
ring. Placeholders `--ink-faint`.

### 5.3 Cards / panels
`--surface`, `1px solid --border`, `radius-lg`, `shadow-sm`. Section header row with `h3` +
optional action. Hover-interactive cards lift to `shadow-md`.

### 5.4 Badges / chips
`micro` mono, `radius-full` (status) or `radius-sm` (tags). Accent badge = `--accent-weak` bg +
`--accent` text. Neutral = `--surface-2` + `--ink-muted`.

### 5.5 Image tiles (contact-sheet grid)
`radius-lg`, `1px solid --border`, LQIP blurred background swapped for the real image on load
(fade 300ms). Hover: scale `1.02`, `shadow-md`, caption slides up. Never scale beyond `1.03` —
photos are the subject, not toys. Selected state: 2px `--accent` ring + check.

### 5.6 Optimisation loupe (signature)
Split before/after with a draggable vertical handle (teal, with a grip). Below, a mono readout:
```
4.2 MB  →  1.1 MB      −74%      ~5.0 s → 1.3 s @ 5 Mbps
```
`original` in `--ink-muted`, `optimised` in `--ink`, reduction in `--accent`/`--success` bold.
A quality slider (0–100) re-runs optimisation; nothing is forced (default = accept).

### 5.7 Navigation
- **Dashboard**: left sidebar (240px) on desktop, collapsible; top bar with brand, theme toggle,
  account menu. Active item: `--accent-weak` bg + `--accent` text + 2px left accent bar.
- **Public top nav**: minimal, transparent over hero then `--surface` + hairline + `shadow-sm`
  on scroll. Mobile menu opens **only on user action** (no first-render flash) and behaves as a
  standard drawer.
- **Public secondary (gallery) nav**: **sticky** under the top nav on scroll; active gallery
  underlined in `--accent`; horizontal scroll on overflow.

### 5.8 Modal / lightbox (public)
Backdrop `rgba(0,0,0,.9)` (fade in). Content scales **from the clicked tile's position** open and
**reverses (shrinks back) closed** on X / Escape / backdrop click — the animation is **symmetric**,
never a jarring full-page overlap. Prev/next arrows, caption in mono, optional download.

---

## 6. Motion

| Token | Value |
|-------|-------|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-pop` | `cubic-bezier(0.57, 1.52, 0.9, 1.08)` (the reimplemented hero reveal bounce) |
| duration-fast | 150ms |
| duration | 250ms |
| duration-slow | 400ms |

- **Hero "text pops up" reveal** (client favourite, reimplemented cleanly): rotating words rise
  and fade with `--ease-pop`, height+opacity, staggered — polished, professional copy, respects
  `prefers-reduced-motion` (falls back to a simple crossfade or static first line).
- Scroll reveals: fade + 12px rise, once, `--ease-out`.
- Hover micro-interactions: 150ms. Modal open/close: 250–300ms symmetric.
- **Always** honour `@media (prefers-reduced-motion: reduce)` — disable transforms, keep opacity.

---

## 7. Accessibility & quality floor
- Text/background contrast ≥ 4.5:1 (body), ≥ 3:1 (large). Accent on white and dark-ink on teal
  both verified.
- Visible keyboard focus on every interactive element (focus ring token above).
- All imagery has alt text; decorative images `alt=""`.
- Responsive from 320px up; no horizontal body scroll; wide content scrolls in its own container.
- Reduced motion respected everywhere.
- Minimum tap target 40×40.

---

## 8. Brand assets
- **Wordmark**: "Fotolio" in Archivo Expanded 800, `--ink`, with the aperture mark; the dot of the
  "o" can carry the aperture motif. Accent teal reserved for the mark or active states.
- **Logo / app icon**: a minimal **camera aperture** — six straight blades forming a hexagonal
  opening, single-weight strokes, teal on dark or ink on light. Provided as SVG + generated PNG
  favicon/app-icon (`/dashboard/public` and `/api/public`).
- **Favicon**: aperture mark on a rounded-square graphite tile.
- Keep the mark geometric and precise — no gradients in the icon itself (chrome stays quiet).

---

## 9. Voice & copy
- Sentence case everywhere. Plain, active verbs. Buttons name the exact outcome ("Publish site",
  not "Submit"); the resulting toast matches ("Site published").
- Name things by what the photographer controls (galleries, header, custom domain), never by
  implementation (JWT, variants).
- Empty states invite action; errors state what happened and how to fix it, in the product's
  voice, never apologising or vague.
- Data is specific: always show real numbers (sizes, %, seconds), set in mono.
