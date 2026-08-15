# Fotolio — Site Analytics

First-party, self-hosted visitor analytics for published sites. No third-party
scripts, no external per-request calls, no shared trackers. Everything lives in
the Fotolio database and renders on the dashboard **Overview**.

## What it captures

A tiny beacon (`api/public/assets/analytics.js`, ~2 KB) is embedded on every
**published** page (live mode only — never in the editor or preview). It records:

| Event | When |
|-------|------|
| `pageview` | on every page load |
| `nav` | click on a top-nav or sub-nav link |
| `lightbox` | opening an image in the lightbox |
| `click` | click on any element marked `data-track="label"` |
| `event` (heartbeat) | every 60s while the tab is visible, to keep "active now" fresh (capped at 30) |

For each session we store: a first-party **session id** (per tab, `sessionStorage`)
and a returning-**visitor id** (`localStorage`), timestamp, path, referrer,
user-agent (→ device / browser / OS), **IP address**, and the IP-derived
**country**. The beacon posts same-origin to `POST /api/analytics/collect`
(via `navigator.sendBeacon`, falling back to `fetch(..., {keepalive})`).

## Data model (migration `009`)

- **`analytics_sessions`** — one row per session, rolled up for fast queries:
  device/browser/os, country + country_code, ip, referrer, landing + current
  path, `pageviews`/`events` counters, `first_seen`/`last_seen`. Unique on
  `(site_id, session_id)`, indexed on `(site_id, last_seen)` for "active now".
- **`analytics_events`** — one row per event: `type`, `path`, `label`,
  `referrer`, `created_at`. Indexed on `(site_id, created_at)` and `(site_id, type)`.

Ingestion upserts the session and appends the event inside one transaction
(`AnalyticsService::ingest`). The collect endpoint **always** answers `204` and
swallows every error — a tracking beacon must never slow down or break a
visitor's page.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/analytics/collect` | none | beacon ingestion (site id in payload) |
| GET | `/api/analytics/overview?days=14` | yes | aggregates for the range |
| GET | `/api/analytics/realtime` | yes | active count + live feed |

`overview` returns visitors, pageviews, views/visitor, top pages, referrers,
countries, devices, browsers, and a dense per-day pageview trend. `realtime`
returns the active-session count (last 5 min, configurable), the 20 most recent
sessions with their current page, the 30 most recent events, and a **`located`**
array (every session that resolved to a coordinate, each flagged `active`) plus a
**`located_countries`** count for the globe. The Analytics panel polls `realtime`
every 5 seconds, which is what keeps the active globe markers live.

## Dashboard — the Analytics tab

Analytics live on their own **Analytics** sidebar tab (`/app/analytics`), not on
Overview. The page renders `components/Analytics.jsx` (stats, trend, top pages,
referrers, countries, devices, browsers, live feed) plus an interactive **world
globe** (`components/VisitorGlobe.jsx`).

The globe uses **cobe** (<https://cobe.vercel.app>) — a tiny (~5 KB) WebGL
globe. It is themed to the styleguide: a dark graphite sphere with teal markers
and glow, smooth auto-rotation, and pointer-drag to spin. It plots two marker
layers, fed **live** from the realtime endpoint (`located`):

- **historical visitors** — small, steady teal dots;
- **currently-active visitors** — larger, **pulsing** teal markers showing where
  people are viewing the site from right now.

The realtime poll (every 5 s) updates the markers in place — the render loop
reads the latest marker buffer each frame, so new active visitors appear and
pulse without recreating the globe. The "N countries located" counter and the
empty state reflect the real located data. The page is lazy-loaded so the globe
stays out of the main bundle.

## GeoIP — self-hosted location lookup (country + coordinates)

Locations are resolved with a dependency-free pure-PHP reader
(`Fotolio\Support\MaxMindDbReader`, used via `GeoIpService`). There are **no
external calls** and **no API key at runtime**. `GeoIpService::lookup()` returns
a country **and plottable latitude/longitude**, resolved in this order:

1. **GeoLite2-City** location (`location.latitude` / `location.longitude`) — used
   when a City database is installed (the reader decodes MMDB doubles);
2. otherwise the **country code → a bundled country-centroid** coordinate
   (`Fotolio\Support\CountryCentroids`, the server twin of
   `lib/countryCentroids.js`), which also works with the smaller Country DB;
3. otherwise **"Unknown"** with no coordinates.

Resolved coordinates are stored on the session (`analytics_sessions.lat/.lng`,
migration `010`, which backfills existing visits) and drive the globe.

### Loopback / private / non-production → demo coordinate

The demo runs on **localhost**, whose loopback IP has no real location — which is
why the globe used to sit empty. When a visit's IP is loopback/private, **or the
app is not in a production environment**, `GeoIpService` falls back to a
**configurable demo coordinate** (default **Lucerne, CH**) so the globe is
demonstrably live locally. A small deterministic per-session jitter fans multiple
local visits out around the demo city instead of stacking them on one pixel.
**Real public IPs in production resolve normally** — the demo fallback only
applies to unresolvable IPs or non-prod environments. Toggle it with
`ANALYTICS_DEMO_GEO`; it defaults **on** whenever `APP_ENV` ≠ `production`.

Countries can additionally be resolved from a **self-hosted GeoLite2-Country (or
City) database**.

**The database is not bundled in the repo** (MaxMind's licence requires you to
download it under your own account). Until it is installed, every lookup
degrades gracefully to **"Unknown"** (private/loopback IPs report **"Local"**),
and the live feed shows a small "country DB not installed" hint. Everything else
works unchanged.

### Install the database

1. Create a free MaxMind account and download **GeoLite2-Country** (`.mmdb`)
   from <https://www.maxmind.com/en/geolite2/signup> (or your distro's
   `geoipupdate` package).
2. Drop it at `api/storage/GeoLite2-Country.mmdb` (the default), or point
   `GEOLITE2_DB` in `.env` at another path:
   ```
   GEOLITE2_DB=/var/lib/GeoIP/GeoLite2-Country.mmdb
   ```
3. No restart-time step is required — `GeoIpService` picks it up on the next
   request. Keep it fresh with `geoipupdate` on a cron if you like.

The provider is **pluggable**: `GeoIpService` is the single seam. Swapping in a
different lookup (a hosted service, a City database, a different vendor) means
implementing one `lookup(?string $ip): array` method — nothing else changes.

Config knobs (`api/src/Core/Config.php`):

| Key / env | Default | Meaning |
|-----------|---------|---------|
| `analytics.geolite_path` / `GEOLITE2_DB` | `storage/GeoLite2-Country.mmdb` | path to the `.mmdb` (Country **or** City) |
| `analytics.active_window` / `ANALYTICS_ACTIVE_WINDOW` | `300` | "active now" window, seconds |
| `analytics.demo_geo` / `ANALYTICS_DEMO_GEO` | on when `APP_ENV`≠`production` | plot unresolvable/loopback visits at the demo coordinate |
| `analytics.demo_lat` / `ANALYTICS_DEMO_LAT` | `47.0502` | demo latitude (Lucerne) |
| `analytics.demo_lng` / `ANALYTICS_DEMO_LNG` | `8.3093` | demo longitude (Lucerne) |
| `analytics.demo_country` / `ANALYTICS_DEMO_COUNTRY` | `Switzerland` | demo country name |
| `analytics.demo_country_code` / `ANALYTICS_DEMO_CC` | `CH` | demo country code |

> To resolve **city-level** coordinates for real visitors, install
> **GeoLite2-City** instead of Country and point `GEOLITE2_DB` at it — the reader
> and `GeoIpService` pick up `location.latitude/longitude` automatically.

## Privacy & GDPR — read before going live

This subsystem stores **personal data**: full IP addresses and derived location,
plus a first-party visitor id. That is lawful for first-party, self-hosted
analytics in many jurisdictions, but under the GDPR/ePrivacy regime you remain
responsible for:

- **Lawful basis & notice.** Add a privacy-policy entry describing what is
  collected (IP, country, device, pages, referrer), why, and for how long. If
  you rely on consent (rather than legitimate interest), gate the beacon behind
  a consent banner — the script is a single `<script>` you can defer until
  consent is given.
- **Data minimisation.** IP is stored to power the live feed and country
  lookup. If you don't need raw IPs, truncate them (e.g. zero the last octet)
  in `AnalyticsService::ingest` before insert, or drop the column — country and
  device stats keep working.
- **Retention.** There is no automatic purge yet. Add a scheduled
  `DELETE FROM analytics_events WHERE created_at < :cutoff` (and the same for
  stale sessions) to match your stated retention period.
- **No cookies are set** by the beacon; it uses `localStorage`/`sessionStorage`
  first-party identifiers only. Depending on your consent framework these may
  still require notice.
- **DNT / GPC.** Not honoured automatically. To respect Do-Not-Track, bail early
  in `analytics.js` when `navigator.doNotTrack === '1'` or the Global Privacy
  Control signal is set.

The design is intentionally **pragmatic, not exhaustive** — the per-click live
view favours immediacy over completeness, and the feed is capped. Treat it as
operational insight, not a compliance-grade audit log.
