# Fotolio — Site Editor (WYSIWYG, draft/preview/publish)

This document is the design map for the live Site Editor that replaces the three
form-based editors (galleries navigation, header & hero, pages). It is the
contract between the PHP theme (rendered in an iframe), the JS bridge, and the
React panels. Visual system is fixed by `docs/STYLEGUIDE.md` — nothing is
restyled here.

## 1. State model

Each site gains two JSON documents plus a timestamp (migration `008`):

- `sites.draft_state`   — what the editor and Preview render from.
- `sites.published_state` — what the **public site** renders from.
- `sites.last_published_at` — when draft was last promoted.

**Guarantee:** public renders `published_state`; editor/preview render
`draft_state`. Nothing the editor does touches the live site until *Publish*.

Image **assets** and their intrinsic metadata (title, location, description,
EXIF, variants) stay in the `images` table and are referenced by id. The state
document owns *composition*: which galleries/pages exist in the site, their
order, nav visibility, names, hero config, page blocks, gallery photo
membership + order, and site-level settings.

### 1.1 Document shape

```jsonc
{
  "version": 1,
  "site": {
    "title": "Jane Doe's portfolio",
    "tagline": "Alpine & aerial photography",
    "settings": { "footer": "© Jane Doe", "social": { "instagram": "https://…" } },
    "home_header": { /* header config, see 1.2 */ }
  },
  "galleries": [
    {
      "id": 12,                 // -> galleries.id (identity, slug, is_home live in table)
      "name": "Aerial",
      "description": "Shot from above",
      "show_in_nav": true,      // the "Show in site navigation" flag, now visual
      "header_config": null,    // null => auto hero from first image; or a header config
      "image_ids": [7, 3, 21]   // ordered membership (draftable photo order)
    }
  ],
  "pages": [
    {
      "id": 5,                  // -> pages.id
      "title": "About",
      "show_in_nav": true,
      "published": true,
      "header_config": null,
      "content": [ /* ordered blocks, see 1.3 */ ]
    }
  ]
}
```

Galleries/pages are **entities** (rows carry id, slug, is_home, type). The state
holds an ordered list referencing them. On read the stored draft is *reconciled*
against current rows: entities missing from the doc are appended, orphaned
entries dropped — so creating/deleting a gallery or page via existing CRUD shows
up in the editor without manual sync. `is_home`/`slug`/`type` are always read
from the row, never the doc.

### 1.2 Header config (unchanged from `SiteService::defaultHeader`)

```jsonc
{
  "mode": "single|slideshow", "image_ids": [1,2],
  "slideshow": { "autoplay": true, "interval": 5000, "controls": true },
  "overlay": { "title": "", "subtitle": "", "position": "top|center|bottom",
               "align": "left|center|right", "style": "light|dark" },
  "animate_text": true, "rotating_words": ["…"], "parallax": true,
  "height": "medium|tall|full"
}
```

### 1.3 Page blocks (unchanged shape)

`{ "type": "heading|subheading|paragraph|quote|image", "text": "…" }` and for
image `{ "type": "image", "src": "…", "caption": "…" }`.

## 2. Render modes

`PublicRenderer` renders from a **state document** + the `images` table:

| Mode | Source | Route | Editable affordances | Bridge |
|------|--------|-------|----------------------|--------|
| live | `published_state` | `/@slug`, host | none | no |
| edit | `draft_state` | `GET /api/site/editor/render?token&path` | `data-editable` markers | yes |
| preview | `draft_state` | `GET /api/site/preview?token&path` | none (clean) | no |

Edit/preview are **token-gated** (signed JWT, `type=edit|preview`, `site_id`,
short TTL) so the iframe needs no auth header. In-site links in edit/preview are
rewritten to `?token=…&path=…` on the same endpoint so navigation stays in mode.

## 3. Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/site/editor` | `{ draft, published, dirty, last_published_at }` |
| PATCH | `/api/site/editor/draft` | autosave — body `{ state }` replaces draft |
| POST | `/api/site/editor/publish` | draft → published, stamp, mark site published |
| POST | `/api/site/editor/discard` | published → draft |
| POST | `/api/site/editor/preview-token` | `{ token, url }` for a clean Preview |
| GET | `/api/site/editor/render` | edit-mode HTML (token) — iframe canvas |
| GET | `/api/site/preview` | preview HTML (token) |

Autosave sends the **whole draft document** (small; one photographer): simplest
correct model, no merge races. Partial top-level keys are also accepted (merged).

## 4. postMessage bridge protocol

Parent (React) ⇄ iframe (`theme.js` edit bridge). All messages `{ source:'fotolio-editor', type, … }`.

**Parent → iframe**
- `patch` `{ target, config }` — re-apply a hero/nav/page region from draft data (fast partial re-render of the marked region).
- `set-text` `{ path, value }` — set text content of a `data-editable` node live.
- `nav-visibility` `{ galleryId, visible }` — animate the gallery's nav item in/out.
- `nav-order` `{ order:[galleryId…] }` — reorder subnav live.
- `select` `{ id }` — highlight a region (from a side-panel hover/click).
- `scroll-to` `{ id }`.

**iframe → parent**
- `ready` — bridge mounted.
- `edit` `{ region, id, field, value }` — an inline edit happened (heading/paragraph/overlay text).
- `select` `{ region, id }` — user clicked an editable region; open its panel.
- `navigate` `{ path }` — user clicked an in-site link; parent updates context + iframe.

## 5. Control → canvas mapping (what replaces what)

| Old form control (file) | New in-canvas equivalent |
|---|---|
| Galleries `Toggle "Show in site navigation"` (`Galleries.jsx`) | Editor gallery panel toggle → `nav-visibility` message animates the subnav item in/out, one-line hint of visitor effect (Stage 4) |
| Galleries drag-reorder list | Subnav reorder in canvas + panel → `nav-order` (Stage 4) |
| Gallery name / description inline inputs | Inline-editable in canvas + panel (Stage 4/5) |
| Gallery photos add/remove/reorder (`Galleries.jsx`) | Gallery panel: ImagePicker add, remove, drag-reorder → draft `image_ids`, canvas grid re-renders (Stage 4) |
| HeaderBuilder target `<Select>` (`HeaderBuilder.jsx`) | Selecting a context = navigating the canvas (home/gallery/page); hero panel binds to that context (Stage 5) |
| Hero single/slideshow, autoplay, interval, controls | Hero panel controls → live `patch` of the real hero (Stage 5) |
| Hero overlay title/subtitle | Click the real overlay text in canvas and type (inline) (Stage 5) |
| Hero position/align/style/height/parallax/animate | Hero panel toggles → live hero update (Stage 5) |
| Pages block editor + "Save page" (`Pages.jsx`) | Inline block editing on the rendered page, add/remove/reorder, autosave — no Save button (Stage 6) |
| Page published / show-in-nav toggles | Page panel toggles, live (Stage 6) |
| "Save header" / "Save page" buttons | Removed — debounced autosave to draft with saved/saving indicator (Stage 7) |
| Settings publish pill | Editor status: "Published" vs "You have unpublished changes" + Publish / Discard / Preview (Stage 7) |

## 6. Decisions taken (running log)

- Autosave replaces the entire `draft_state` document per save (small, single-user) — no partial-patch merge engine.
- Galleries & pages remain table-backed **entities**; the state doc references them by id and layers order/visibility/name/hero/membership. Read-time reconciliation keeps them in sync with CRUD.
- Gallery photo membership/order is drafted via `image_ids` in the state doc, composed initially from the `image_gallery` pivot; the pivot is no longer read by the public renderer.
- Edit & preview are signed-token routes under `/api` (no auth header needed for the iframe); cross-origin dashboard⇄canvas comms use postMessage.
