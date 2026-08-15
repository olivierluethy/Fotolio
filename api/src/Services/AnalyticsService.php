<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Support\UserAgentParser;

/**
 * First-party analytics: ingests beacon events into a per-session roll-up plus
 * a raw event log, and answers the aggregate + real-time queries the Overview
 * dashboard renders. Deliberately pragmatic — a handful of indexed queries, no
 * external services. See docs/ANALYTICS.md.
 */
final class AnalyticsService
{
    /** Event types we accept from the beacon (anything else is coerced to "event"). */
    private const TYPES = ['pageview', 'nav', 'lightbox', 'click', 'event'];

    public function __construct(private GeoIpService $geo)
    {
    }

    /**
     * Record one event and fold it into its session. Silently no-ops on bad
     * input — a tracking beacon must never surface errors to a visitor.
     */
    public function ingest(int $siteId, array $payload, string $ip, ?string $ua): void
    {
        $sid = substr(trim((string) ($payload['sid'] ?? '')), 0, 64);
        if ($sid === '') {
            return;
        }
        $vid = substr(trim((string) ($payload['vid'] ?? '')), 0, 64) ?: null;
        $type = (string) ($payload['type'] ?? 'pageview');
        if (!in_array($type, self::TYPES, true)) {
            $type = 'event';
        }
        $path = $this->clip($payload['path'] ?? '/', 400) ?: '/';
        $label = $this->clip($payload['label'] ?? null, 200);
        $referrer = $this->clip($payload['referrer'] ?? null, 500);
        $now = Database::now();
        $isView = $type === 'pageview';

        Database::transaction(function () use ($siteId, $sid, $vid, $type, $path, $label, $referrer, $ip, $ua, $now, $isView) {
            $existing = Database::fetch(
                'SELECT id FROM analytics_sessions WHERE site_id = :s AND session_id = :sid',
                ['s' => $siteId, 'sid' => $sid]
            );

            if ($existing === null) {
                $geo = $this->locate($sid, $ip);
                $agent = UserAgentParser::parse($ua);
                Database::insert('analytics_sessions', [
                    'site_id' => $siteId,
                    'session_id' => $sid,
                    'visitor_id' => $vid,
                    'ip' => substr($ip, 0, 45),
                    'country' => $geo['country'],
                    'country_code' => $geo['country_code'],
                    'lat' => $geo['lat'],
                    'lng' => $geo['lng'],
                    'device' => $agent['device'],
                    'browser' => $agent['browser'],
                    'os' => $agent['os'],
                    'user_agent' => $this->clip($ua, 500),
                    'referrer' => $referrer,
                    'landing_path' => $path,
                    'current_path' => $path,
                    'pageviews' => $isView ? 1 : 0,
                    'events' => $isView ? 0 : 1,
                    'first_seen' => $now,
                    'last_seen' => $now,
                ]);
            } else {
                Database::run(
                    'UPDATE analytics_sessions
                        SET last_seen = :now,
                            current_path = CASE WHEN :isview = 1 THEN :cp ELSE current_path END,
                            pageviews = pageviews + :pv,
                            events = events + :ev
                      WHERE id = :id',
                    [
                        'now' => $now,
                        'isview' => $isView ? 1 : 0,
                        'cp' => $path,
                        'pv' => $isView ? 1 : 0,
                        'ev' => $isView ? 0 : 1,
                        'id' => $existing['id'],
                    ]
                );
            }

            Database::insert('analytics_events', [
                'site_id' => $siteId,
                'session_id' => $sid,
                'type' => $type,
                'path' => $path,
                'label' => $label,
                'referrer' => $referrer,
                'created_at' => $now,
            ]);
        });
    }

    /** Aggregate stats over the trailing $days window. */
    public function overview(int $siteId, int $days = 14): array
    {
        $days = max(1, min($days, 90));
        $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);

        $visitors = (int) Database::column(
            'SELECT COUNT(*) FROM analytics_sessions WHERE site_id = :s AND last_seen >= :since',
            ['s' => $siteId, 'since' => $since]
        );
        $pageviews = (int) Database::column(
            "SELECT COUNT(*) FROM analytics_events WHERE site_id = :s AND type = 'pageview' AND created_at >= :since",
            ['s' => $siteId, 'since' => $since]
        );

        return [
            'range_days' => $days,
            'visitors' => $visitors,
            'pageviews' => $pageviews,
            'views_per_visitor' => $visitors ? round($pageviews / $visitors, 1) : 0,
            'top_pages' => Database::all(
                "SELECT path AS label, COUNT(*) AS count
                   FROM analytics_events
                  WHERE site_id = :s AND type = 'pageview' AND created_at >= :since
                  GROUP BY path ORDER BY count DESC LIMIT 8",
                ['s' => $siteId, 'since' => $since]
            ),
            'referrers' => $this->groupReferrers($siteId, $since),
            'countries' => $this->groupCountries($siteId, $since),
            'devices' => $this->group('device', $siteId, $since),
            'browsers' => $this->group('browser', $siteId, $since),
            'trend' => $this->trend($siteId, $days),
        ];
    }

    /** Who is on the site right now + a capped recent-activity feed. */
    public function realtime(int $siteId): array
    {
        $window = (int) config('analytics.active_window', 300);
        $threshold = gmdate('Y-m-d H:i:s', time() - $window);

        $active = (int) Database::column(
            'SELECT COUNT(*) FROM analytics_sessions WHERE site_id = :s AND last_seen >= :t',
            ['s' => $siteId, 't' => $threshold]
        );

        $sessions = Database::all(
            'SELECT session_id, country, country_code, device, browser, os, ip,
                    current_path, referrer, pageviews, events, first_seen, last_seen
               FROM analytics_sessions
              WHERE site_id = :s
              ORDER BY last_seen DESC LIMIT 20',
            ['s' => $siteId]
        );

        $events = Database::all(
            'SELECT session_id, type, path, label, created_at
               FROM analytics_events
              WHERE site_id = :s
              ORDER BY id DESC LIMIT 30',
            ['s' => $siteId]
        );

        $located = $this->located($siteId, $threshold);

        return [
            'active' => $active,
            'window_seconds' => $window,
            'sessions' => $sessions,
            'recent_events' => $events,
            'located' => $located['points'],
            'located_countries' => $located['countries'],
            'geoip' => $this->geo->available(),
            'geoip_demo' => $this->geo->demoActive(),
        ];
    }

    /**
     * Every session that resolved to a coordinate, for the globe. Each point
     * carries whether the visitor is currently active (last_seen within the
     * window) so the globe can highlight live viewers distinctly. Capped.
     *
     * @return array{points:list<array<string,mixed>>,countries:int}
     */
    private function located(int $siteId, string $threshold): array
    {
        $rows = Database::all(
            'SELECT lat, lng, country, country_code, session_id, last_seen,
                    CASE WHEN last_seen >= :t THEN 1 ELSE 0 END AS active
               FROM analytics_sessions
              WHERE site_id = :s AND lat IS NOT NULL AND lng IS NOT NULL
              ORDER BY last_seen DESC
              LIMIT 500',
            ['s' => $siteId, 't' => $threshold]
        );
        $codes = [];
        $points = [];
        foreach ($rows as $r) {
            $cc = $r['country_code'] ?? null;
            if ($cc) {
                $codes[$cc] = true;
            }
            $points[] = [
                'lat' => (float) $r['lat'],
                'lng' => (float) $r['lng'],
                'country' => $r['country'],
                'country_code' => $cc,
                'active' => (int) $r['active'] === 1,
                'last_seen' => $r['last_seen'],
            ];
        }
        return ['points' => $points, 'countries' => count($codes)];
    }

    /**
     * Resolve a visitor's location and apply a small deterministic jitter to
     * demo coordinates so many localhost sessions fan out around the demo city
     * instead of stacking on one pixel. Real, resolved coordinates are untouched.
     *
     * @return array{country:string,country_code:?string,lat:?float,lng:?float}
     */
    private function locate(string $sid, ?string $ip): array
    {
        $geo = $this->geo->lookup($ip);
        if (!empty($geo['demo']) && $geo['lat'] !== null && $geo['lng'] !== null) {
            $geo['lat'] = round($geo['lat'] + $this->jitter($sid, 'a', 0.6), 5);
            $geo['lng'] = round($geo['lng'] + $this->jitter($sid, 'o', 0.9), 5);
        }
        return $geo;
    }

    /** Deterministic ±amplitude offset from a seed, stable per session. */
    private function jitter(string $seed, string $axis, float $amplitude): float
    {
        $h = crc32($seed . ':' . $axis);
        return ((($h % 1000) / 1000) - 0.5) * 2 * $amplitude;
    }

    /**
     * Backfill lat/lng for sessions that don't have coordinates yet (called by
     * migration 010 and safe to re-run). Returns the number updated.
     */
    public function backfillCoordinates(): int
    {
        $rows = Database::all(
            "SELECT id, session_id, ip, country, country_code
               FROM analytics_sessions
              WHERE lat IS NULL OR lng IS NULL
                 OR country_code IS NULL OR country_code = ''
                 OR country IN ('Local', 'Unknown')"
        );
        $n = 0;
        foreach ($rows as $row) {
            $geo = $this->locate((string) $row['session_id'], $row['ip'] ?? null);
            if ($geo['lat'] === null || $geo['lng'] === null) {
                continue;
            }
            Database::run(
                'UPDATE analytics_sessions
                    SET lat = :lat, lng = :lng, country = :country, country_code = :cc
                  WHERE id = :id',
                [
                    'lat' => $geo['lat'],
                    'lng' => $geo['lng'],
                    'country' => $geo['country'],
                    'cc' => $geo['country_code'],
                    'id' => $row['id'],
                ]
            );
            $n++;
        }
        return $n;
    }

    // ---- helpers ---------------------------------------------------------

    private function group(string $col, int $siteId, string $since): array
    {
        return Database::all(
            "SELECT COALESCE($col, 'Unknown') AS label, COUNT(*) AS count
               FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :since
              GROUP BY label ORDER BY count DESC LIMIT 8",
            ['s' => $siteId, 'since' => $since]
        );
    }

    private function groupCountries(int $siteId, string $since): array
    {
        return Database::all(
            "SELECT COALESCE(country, 'Unknown') AS label, country_code, COUNT(*) AS count
               FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :since
              GROUP BY label, country_code ORDER BY count DESC LIMIT 8",
            ['s' => $siteId, 'since' => $since]
        );
    }

    private function groupReferrers(int $siteId, string $since): array
    {
        $rows = Database::all(
            "SELECT referrer, COUNT(*) AS count
               FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :since
              GROUP BY referrer ORDER BY count DESC LIMIT 12",
            ['s' => $siteId, 'since' => $since]
        );
        $out = [];
        foreach ($rows as $row) {
            $out[] = ['label' => $this->refLabel($row['referrer'] ?? null), 'count' => (int) $row['count']];
        }
        // Merge duplicates produced by host normalisation (e.g. Direct).
        $merged = [];
        foreach ($out as $r) {
            $merged[$r['label']] = ($merged[$r['label']] ?? 0) + $r['count'];
        }
        arsort($merged);
        $result = [];
        foreach (array_slice($merged, 0, 8, true) as $label => $count) {
            $result[] = ['label' => $label, 'count' => $count];
        }
        return $result;
    }

    private function refLabel(?string $ref): string
    {
        $ref = trim((string) $ref);
        if ($ref === '') {
            return 'Direct';
        }
        $host = parse_url($ref, PHP_URL_HOST);
        return $host ? preg_replace('/^www\./', '', $host) : 'Direct';
    }

    private function trend(int $siteId, int $days): array
    {
        $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);
        $rows = Database::all(
            "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
               FROM analytics_events
              WHERE site_id = :s AND type = 'pageview' AND created_at >= :since
              GROUP BY day",
            ['s' => $siteId, 'since' => $since]
        );
        $byDay = [];
        foreach ($rows as $row) {
            $byDay[$row['day']] = (int) $row['count'];
        }
        // Emit a dense series so the chart has a point per day even when zero.
        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = gmdate('Y-m-d', time() - $i * 86400);
            $series[] = ['day' => $day, 'count' => $byDay[$day] ?? 0];
        }
        return $series;
    }

    private function clip(mixed $value, int $len): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);
        return $value === '' ? null : substr($value, 0, $len);
    }
}
