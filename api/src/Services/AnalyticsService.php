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

    /**
     * Aggregate stats over a resolved date range (see {@see resolveRange}). Adds
     * dwell time, best/worst pages, most-clicked images and the popular flow on
     * top of the visitor/pageview basics.
     */
    public function overview(int $siteId, array $range): array
    {
        $from = $range['from'];
        $to = $range['to'];
        $p = ['s' => $siteId, 'from' => $from, 'to' => $to];

        $visitors = (int) Database::column(
            'SELECT COUNT(*) FROM analytics_sessions WHERE site_id = :s AND last_seen >= :from AND last_seen < :to',
            $p
        );
        $pageviews = (int) Database::column(
            "SELECT COUNT(*) FROM analytics_events WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to",
            $p
        );
        $paths = $this->sessionPathAnalysis($siteId, $from, $to);

        return [
            'range' => ['from' => $from, 'to' => $to, 'label' => $range['label'], 'days' => $range['days']],
            'range_days' => $range['days'],
            'visitors' => $visitors,
            'pageviews' => $pageviews,
            'views_per_visitor' => $visitors ? round($pageviews / $visitors, 1) : 0,
            'avg_visit_seconds' => $this->avgVisitSeconds($siteId, $from, $to),
            'top_pages' => Database::all(
                "SELECT path AS label, COUNT(*) AS count
                   FROM analytics_events
                  WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to
                  GROUP BY path ORDER BY count DESC LIMIT 8",
                $p
            ),
            'worst_pages' => $this->worstPages($siteId, $from, $to),
            'top_images' => $this->topImages($siteId, $from, $to),
            'referrers' => $this->groupReferrers($siteId, $from, $to),
            'countries' => $this->groupCountries($siteId, $from, $to),
            'devices' => $this->group('device', $siteId, $from, $to),
            'browsers' => $this->group('browser', $siteId, $from, $to),
            'flow' => $paths['flow'],
            'page_dwell' => $paths['dwell'],
            'trend' => $this->trend($siteId, $from, $to),
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

    private function group(string $col, int $siteId, string $from, string $to): array
    {
        return Database::all(
            "SELECT COALESCE($col, 'Unknown') AS label, COUNT(*) AS count
               FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :from AND last_seen < :to
              GROUP BY label ORDER BY count DESC LIMIT 8",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
    }

    private function groupCountries(int $siteId, string $from, string $to): array
    {
        return Database::all(
            "SELECT COALESCE(country, 'Unknown') AS label, country_code, COUNT(*) AS count
               FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :from AND last_seen < :to
              GROUP BY label, country_code ORDER BY count DESC LIMIT 8",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
    }

    private function groupReferrers(int $siteId, string $from, string $to): array
    {
        $rows = Database::all(
            "SELECT referrer, COUNT(*) AS count
               FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :from AND last_seen < :to
              GROUP BY referrer ORDER BY count DESC LIMIT 12",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
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

    private function trend(int $siteId, string $from, string $to): array
    {
        $rows = Database::all(
            "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
               FROM analytics_events
              WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to
              GROUP BY day",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
        $byDay = [];
        foreach ($rows as $row) {
            $byDay[$row['day']] = (int) $row['count'];
        }
        // Emit a dense series so the chart has a point per day even when zero.
        // Cap at 180 buckets so a huge custom range stays a sane payload.
        $fromTs = strtotime($from . ' UTC');
        $toTs = strtotime($to . ' UTC');
        $days = (int) min(180, max(1, ceil(($toTs - $fromTs) / 86400)));
        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = gmdate('Y-m-d', $toTs - $i * 86400);
            $series[] = ['day' => $day, 'count' => $byDay[$day] ?? 0];
        }
        return $series;
    }

    // ---- Date ranges -----------------------------------------------------

    /**
     * Resolve a named range (or a custom from/to) to UTC datetime bounds.
     * `to` is exclusive. Supported presets cover the common dashboard windows
     * plus a fully custom span. Everything the DB stores is UTC (Database::now).
     *
     * @return array{from:string,to:string,label:string,days:int}
     */
    public static function resolveRange(?string $preset, ?string $from = null, ?string $to = null): array
    {
        $tz = new \DateTimeZone('UTC');
        $now = new \DateTimeImmutable('now', $tz);
        $fmt = fn (\DateTimeImmutable $d) => $d->format('Y-m-d H:i:s');
        $startOfDay = fn (\DateTimeImmutable $d) => $d->setTime(0, 0, 0);

        $preset = $preset ?: 'last_14d';
        $labels = [
            'today' => 'Today', 'yesterday' => 'Yesterday', 'last_hour' => 'Last hour',
            'last_24h' => 'Last 24 hours', 'last_7d' => 'Last 7 days', 'last_14d' => 'Last 14 days',
            'last_30d' => 'Last 30 days', 'last_90d' => 'Last 90 days', 'last_180d' => 'Last 180 days',
            'this_week' => 'This week', 'last_week' => 'Last week', 'this_month' => 'This month',
            'last_month' => 'Last month', 'this_year' => 'This year', 'custom' => 'Custom range',
        ];

        [$start, $end] = match ($preset) {
            'today' => [$startOfDay($now), $now],
            'yesterday' => [$startOfDay($now)->modify('-1 day'), $startOfDay($now)],
            'last_hour' => [$now->modify('-1 hour'), $now],
            'last_24h' => [$now->modify('-24 hours'), $now],
            'last_7d' => [$now->modify('-7 days'), $now],
            'last_30d' => [$now->modify('-30 days'), $now],
            'last_90d' => [$now->modify('-90 days'), $now],
            'last_180d' => [$now->modify('-180 days'), $now],
            'this_week' => [$startOfDay($now)->modify('monday this week'), $now],
            'last_week' => [$startOfDay($now)->modify('monday last week'), $startOfDay($now)->modify('monday this week')],
            'this_month' => [$startOfDay($now)->modify('first day of this month'), $now],
            'last_month' => [$startOfDay($now)->modify('first day of last month'), $startOfDay($now)->modify('first day of this month')],
            'this_year' => [$now->setDate((int) $now->format('Y'), 1, 1)->setTime(0, 0, 0), $now],
            'custom' => self::customBounds($from, $to, $now, $tz),
            default => [$now->modify('-14 days'), $now],
        };

        if ($start >= $end) {
            $start = $end->modify('-1 day');
            $preset = $preset === 'custom' ? 'custom' : $preset;
        }
        $days = (int) max(1, ceil(($end->getTimestamp() - $start->getTimestamp()) / 86400));
        return [
            'from' => $fmt($start),
            'to' => $fmt($end),
            'label' => $labels[$preset] ?? 'Last 14 days',
            'days' => $days,
        ];
    }

    private static function customBounds(?string $from, ?string $to, \DateTimeImmutable $now, \DateTimeZone $tz): array
    {
        $start = $from ? (new \DateTimeImmutable($from, $tz))->setTime(0, 0, 0) : $now->modify('-14 days');
        // Inclusive end date → advance to the start of the following day.
        $end = $to ? (new \DateTimeImmutable($to, $tz))->setTime(0, 0, 0)->modify('+1 day') : $now;
        if ($end > $now->modify('+1 day')) {
            $end = $now;
        }
        return [$start, $end];
    }

    // ---- Engagement, images, pages, flow ---------------------------------

    /** Average visit length in seconds (session last_seen − first_seen). */
    private function avgVisitSeconds(int $siteId, string $from, string $to): int
    {
        $rows = Database::all(
            'SELECT first_seen, last_seen FROM analytics_sessions
              WHERE site_id = :s AND last_seen >= :from AND last_seen < :to LIMIT 5000',
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
        $sum = 0;
        $n = 0;
        foreach ($rows as $r) {
            $d = strtotime($r['last_seen'] . ' UTC') - strtotime($r['first_seen'] . ' UTC');
            if ($d >= 0 && $d < 6 * 3600) {
                $sum += $d;
                $n++;
            }
        }
        return $n ? (int) round($sum / $n) : 0;
    }

    /** Most-opened images (lightbox events), by label + page. */
    private function topImages(int $siteId, string $from, string $to): array
    {
        return Database::all(
            "SELECT label, path, COUNT(*) AS count
               FROM analytics_events
              WHERE site_id = :s AND type = 'lightbox' AND label IS NOT NULL AND label != ''
                AND created_at >= :from AND created_at < :to
              GROUP BY label, path ORDER BY count DESC LIMIT 10",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
    }

    /** Visited pages with the fewest views — the underperformers. */
    private function worstPages(int $siteId, string $from, string $to): array
    {
        return Database::all(
            "SELECT path AS label, COUNT(*) AS count
               FROM analytics_events
              WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to
              GROUP BY path ORDER BY count ASC LIMIT 6",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
    }

    /**
     * One pass over ordered pageviews per session → the popular flow (top
     * path→path transitions) and per-page dwell time (Δ between consecutive
     * pageviews in a session, capped at 30 min).
     *
     * @return array{flow:list<array{label:string,count:int}>,dwell:list<array{label:string,seconds:int,count:int}>}
     */
    private function sessionPathAnalysis(int $siteId, string $from, string $to): array
    {
        $rows = Database::all(
            "SELECT session_id, path, created_at
               FROM analytics_events
              WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to
              ORDER BY session_id, created_at LIMIT 20000",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
        $flow = [];
        $dwellSum = [];
        $dwellN = [];
        $prevSid = null;
        $prevPath = null;
        $prevTs = 0;
        foreach ($rows as $r) {
            $sid = $r['session_id'];
            $path = $r['path'] ?: '/';
            $ts = strtotime($r['created_at'] . ' UTC');
            if ($sid === $prevSid && $prevPath !== null) {
                $key = $prevPath . ' → ' . $path;
                $flow[$key] = ($flow[$key] ?? 0) + 1;
                $d = $ts - $prevTs;
                if ($d > 0 && $d < 1800) {
                    $dwellSum[$prevPath] = ($dwellSum[$prevPath] ?? 0) + $d;
                    $dwellN[$prevPath] = ($dwellN[$prevPath] ?? 0) + 1;
                }
            }
            $prevSid = $sid;
            $prevPath = $path;
            $prevTs = $ts;
        }
        arsort($flow);
        $flowOut = [];
        foreach (array_slice($flow, 0, 8, true) as $label => $count) {
            $flowOut[] = ['label' => $label, 'count' => $count];
        }
        $dwellOut = [];
        foreach ($dwellSum as $path => $sum) {
            $dwellOut[] = ['label' => $path, 'seconds' => (int) round($sum / max(1, $dwellN[$path])), 'count' => $dwellN[$path]];
        }
        usort($dwellOut, fn ($a, $b) => $b['seconds'] <=> $a['seconds']);
        return ['flow' => $flowOut, 'dwell' => array_slice($dwellOut, 0, 8)];
    }

    // ---- Goals -----------------------------------------------------------

    public function goals(int $siteId): array
    {
        $rows = Database::all(
            'SELECT id, name, metric, path, label_match, threshold FROM analytics_goals WHERE site_id = :s ORDER BY id',
            ['s' => $siteId]
        );
        return array_map(fn ($g) => [
            'id' => (int) $g['id'], 'name' => $g['name'], 'metric' => $g['metric'],
            'path' => $g['path'], 'label_match' => $g['label_match'], 'threshold' => (int) $g['threshold'],
        ], $rows);
    }

    public function createGoal(int $siteId, array $data): array
    {
        $metric = in_array($data['metric'] ?? '', ['pageview', 'click', 'lightbox', 'nav', 'visit'], true) ? $data['metric'] : 'visit';
        $id = Database::insert('analytics_goals', [
            'site_id' => $siteId,
            'name' => substr(trim((string) ($data['name'] ?? 'Goal')), 0, 120) ?: 'Goal',
            'metric' => $metric,
            'path' => $this->clip($data['path'] ?? null, 400),
            'label_match' => $this->clip($data['label_match'] ?? null, 200),
            'threshold' => max(1, (int) ($data['threshold'] ?? 1)),
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ]);
        $all = $this->goals($siteId);
        foreach ($all as $g) {
            if ($g['id'] === $id) {
                return $g;
            }
        }
        return ['id' => $id];
    }

    public function deleteGoal(int $siteId, int $goalId): void
    {
        Database::delete('analytics_goals', 'id = :id AND site_id = :s', ['id' => $goalId, 's' => $siteId]);
    }

    /** Session ids that met a goal in the range (capped). */
    private function convertingSessions(int $siteId, array $goal, string $from, string $to): array
    {
        $threshold = max(1, (int) $goal['threshold']);
        if (($goal['metric'] ?? 'visit') === 'visit') {
            $rows = Database::all(
                'SELECT session_id FROM analytics_sessions
                  WHERE site_id = :s AND last_seen >= :from AND last_seen < :to
                    AND pageviews >= CAST(:th AS INTEGER) LIMIT 2000',
                ['s' => $siteId, 'from' => $from, 'to' => $to, 'th' => $threshold]
            );
            return array_column($rows, 'session_id');
        }
        $sql = "SELECT session_id FROM analytics_events
                 WHERE site_id = :s AND type = :type AND created_at >= :from AND created_at < :to";
        $params = ['s' => $siteId, 'type' => $goal['metric'], 'from' => $from, 'to' => $to];
        if (!empty($goal['path'])) {
            $sql .= ' AND path = :path';
            $params['path'] = $goal['path'];
        }
        if (!empty($goal['label_match'])) {
            $sql .= ' AND label LIKE :m';
            $params['m'] = '%' . $goal['label_match'] . '%';
        }
        $sql .= ' GROUP BY session_id HAVING COUNT(*) >= CAST(:th AS INTEGER) LIMIT 2000';
        $params['th'] = $threshold;
        return array_column(Database::all($sql, $params), 'session_id');
    }

    /** A goal's conversions, rate, and the regions its converters came from. */
    public function goalReport(int $siteId, array $goal, string $from, string $to): array
    {
        $sids = $this->convertingSessions($siteId, $goal, $from, $to);
        $conversions = count($sids);
        $totalSessions = (int) Database::column(
            'SELECT COUNT(*) FROM analytics_sessions WHERE site_id = :s AND last_seen >= :from AND last_seen < :to',
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
        $countries = [];
        if ($sids) {
            $sids = array_slice($sids, 0, 1000);
            $place = implode(',', array_fill(0, count($sids), '?'));
            $countries = Database::all(
                "SELECT COALESCE(country, 'Unknown') AS label, country_code, COUNT(*) AS count
                   FROM analytics_sessions
                  WHERE site_id = ? AND session_id IN ($place)
                  GROUP BY label, country_code ORDER BY count DESC LIMIT 8",
                array_merge([$siteId], $sids)
            );
        }
        return [
            'id' => $goal['id'] ?? null,
            'name' => $goal['name'] ?? '',
            'conversions' => $conversions,
            'sessions' => $totalSessions,
            'rate' => $totalSessions ? round($conversions / $totalSessions * 100, 1) : 0,
            'countries' => $countries,
        ];
    }

    /** Every goal's report for the range. */
    public function goalsReport(int $siteId, string $from, string $to): array
    {
        return array_map(fn ($g) => $this->goalReport($siteId, $g, $from, $to), $this->goals($siteId));
    }

    // ---- Suggestions (heuristic "AI") ------------------------------------

    /** The published pages/galleries of a site, for coverage checks. */
    public function pageInventory(int $siteId): array
    {
        $out = [];
        foreach (Database::all('SELECT slug, name AS title, is_home FROM galleries WHERE site_id = :s', ['s' => $siteId]) as $g) {
            $out[] = ['slug' => ((int) $g['is_home'] === 1) ? '' : $g['slug'], 'title' => $g['title'], 'kind' => 'gallery', 'is_home' => (int) $g['is_home'] === 1];
        }
        foreach (Database::all('SELECT slug, title FROM pages WHERE site_id = :s AND published = 1', ['s' => $siteId]) as $p) {
            $out[] = ['slug' => $p['slug'], 'title' => $p['title'], 'kind' => 'page', 'is_home' => false];
        }
        return $out;
    }

    /**
     * Data-driven, rule-based suggestions — no external model. Flags unvisited
     * pages (improve or delete), highlights the best page, and — where goals
     * exist — recommends where to advertise and where conversions are leaking.
     */
    public function suggestions(int $siteId, string $from, string $to): array
    {
        $out = [];
        $observedPaths = array_column(
            Database::all(
                "SELECT DISTINCT path FROM analytics_events WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to",
                ['s' => $siteId, 'from' => $from, 'to' => $to]
            ),
            'path'
        );
        $seen = function (string $slug) use ($observedPaths): bool {
            foreach ($observedPaths as $p) {
                if ($slug === '' ? ($p === '/' || $p === '' || preg_match('#/@[^/]+/?$#', (string) $p)) : (strpos((string) $p, '/' . $slug) !== false)) {
                    return true;
                }
            }
            return false;
        };

        foreach ($this->pageInventory($siteId) as $page) {
            if (!$seen($page['slug'])) {
                $out[] = [
                    'severity' => 'warn',
                    'title' => "“{$page['title']}” got no visits",
                    'detail' => "This {$page['kind']} had no pageviews in this period. Try refreshing its hero or title to draw people in — or remove it to keep your site focused.",
                ];
            }
        }

        $top = Database::all(
            "SELECT path, COUNT(*) AS c FROM analytics_events WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to GROUP BY path ORDER BY c DESC LIMIT 1",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
        if ($top) {
            $out[] = [
                'severity' => 'good',
                'title' => 'Your strongest page',
                'detail' => "{$top[0]['path']} draws the most views ({$top[0]['c']}). Lead with what works — link to it from your other pages.",
            ];
        }

        $goals = $this->goals($siteId);
        if (!$goals) {
            $out[] = [
                'severity' => 'info',
                'title' => 'Define a goal',
                'detail' => 'Set a goal (e.g. “open 5 photos in a gallery”) to measure what matters and unlock conversion-by-region insights.',
            ];
        } else {
            $bestCountry = null;
            $bestCount = 0;
            foreach ($goals as $g) {
                $rep = $this->goalReport($siteId, $g, $from, $to);
                if ($rep['conversions'] === 0 && $rep['sessions'] > 5) {
                    $out[] = [
                        'severity' => 'warn',
                        'title' => "No one is completing “{$g['name']}”",
                        'detail' => 'You have traffic but no conversions for this goal. Add a clearer call to action, or lower the threshold if it’s too ambitious.',
                    ];
                }
                foreach ($rep['countries'] as $c) {
                    if ((int) $c['count'] > $bestCount) {
                        $bestCount = (int) $c['count'];
                        $bestCountry = $c['label'];
                    }
                }
            }
            if ($bestCountry && $bestCountry !== 'Unknown' && $bestCount > 0) {
                $out[] = [
                    'severity' => 'info',
                    'title' => "Advertise in {$bestCountry}",
                    'detail' => "Most of your goal completions come from {$bestCountry}. That’s where paid promotion (e.g. Google Ads) is most likely to pay off.",
                ];
            }
        }

        return $out;
    }

    // ---- Export + multi-site compare -------------------------------------

    /** Flat event rows for CSV/XLSX export over the range. */
    public function exportRows(int $siteId, string $from, string $to): array
    {
        return Database::all(
            "SELECT e.created_at, e.type, e.path, e.label, e.session_id,
                    s.country, s.country_code, s.device, s.browser, s.os, e.referrer
               FROM analytics_events e
               LEFT JOIN analytics_sessions s ON s.site_id = e.site_id AND s.session_id = e.session_id
              WHERE e.site_id = :s AND e.created_at >= :from AND e.created_at < :to
              ORDER BY e.created_at DESC LIMIT 50000",
            ['s' => $siteId, 'from' => $from, 'to' => $to]
        );
    }

    /** Key metrics for every site the user owns, to compare performance. */
    public function compareSites(int $userId): array
    {
        $range = self::resolveRange('last_30d');
        $sites = Database::all('SELECT id, title, slug, published FROM sites WHERE user_id = :u ORDER BY id', ['u' => $userId]);
        $out = [];
        foreach ($sites as $st) {
            $sid = (int) $st['id'];
            $p = ['s' => $sid, 'from' => $range['from'], 'to' => $range['to']];
            $visitors = (int) Database::column('SELECT COUNT(*) FROM analytics_sessions WHERE site_id = :s AND last_seen >= :from AND last_seen < :to', $p);
            $pageviews = (int) Database::column("SELECT COUNT(*) FROM analytics_events WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to", $p);
            $top = Database::all("SELECT path, COUNT(*) AS c FROM analytics_events WHERE site_id = :s AND type = 'pageview' AND created_at >= :from AND created_at < :to GROUP BY path ORDER BY c DESC LIMIT 1", $p);
            $out[] = [
                'id' => $sid,
                'title' => $st['title'],
                'slug' => $st['slug'],
                'published' => (int) $st['published'] === 1,
                'visitors' => $visitors,
                'pageviews' => $pageviews,
                'views_per_visitor' => $visitors ? round($pageviews / $visitors, 1) : 0,
                'avg_visit_seconds' => $this->avgVisitSeconds($sid, $range['from'], $range['to']),
                'top_page' => $top[0]['path'] ?? null,
            ];
        }
        return ['range_days' => 30, 'sites' => $out];
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
