<?php

use Fotolio\Core\Database;
use Fotolio\Services\AnalyticsService;
use Fotolio\Services\GeoIpService;

/**
 * Plottable coordinates for the analytics globe.
 *
 * Adds analytics_sessions.lat / .lng and backfills every existing session from
 * its stored IP via GeoIpService (City coords → country centroid → demo
 * coordinate for loopback/private/non-prod). This is why visits that already
 * exist light up the cobe globe immediately after upgrading. See docs/ANALYTICS.md.
 */
return [
    'up' => function (PDO $db, string $driver) {
        $db->exec('ALTER TABLE analytics_sessions ADD COLUMN lat DOUBLE NULL');
        $db->exec('ALTER TABLE analytics_sessions ADD COLUMN lng DOUBLE NULL');

        $analytics = new AnalyticsService(new GeoIpService());
        $count = $analytics->backfillCoordinates();
        error_log("[migration 010] backfilled coordinates for {$count} analytics session(s)");
    },
];
