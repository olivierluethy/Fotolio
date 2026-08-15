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
sessions with their current page, and the 30 most recent events. The Analytics
panel polls `realtime` every 5 seconds.

## Dashboard — the Analytics tab

Analytics live on their own **Analytics** sidebar tab (`/app/analytics`), not on
Overview. The page renders `components/Analytics.jsx` (stats, trend, top pages,
referrers, countries, devices, browsers, live feed) plus an interactive **world
globe** (`components/VisitorGlobe.jsx`).

The globe uses **react-globe.gl** (the React binding for `globe.gl`, built on
three.js — the most widely used globe library). Each located visitor country is
a point sized by visitor count, with a pulsing ring; it auto-rotates and can be
dragged to spin. Country codes are mapped to marker coordinates via a bundled
centroid table (`lib/countryCentroids.js`) so the globe works **fully offline**;
an Earth texture loads from a CDN on top when reachable, and there is a graceful
empty state. The page is lazy-loaded so three.js stays out of the main bundle.

## GeoIP — self-hosted country lookup

Countries are resolved from a **self-hosted GeoLite2-Country database** with a
dependency-free pure-PHP reader (`Fotolio\Support\MaxMindDbReader`, used via
`GeoIpService`). There are **no external calls** and **no API key at runtime**.

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
| `analytics.geolite_path` / `GEOLITE2_DB` | `storage/GeoLite2-Country.mmdb` | path to the `.mmdb` |
| `analytics.active_window` / `ANALYTICS_ACTIVE_WINDOW` | `300` | "active now" window, seconds |

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
