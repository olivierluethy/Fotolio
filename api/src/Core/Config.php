<?php

namespace Fotolio\Core;

use Dotenv\Dotenv;

/**
 * Loads .env and exposes a flat, dotted config map.
 */
final class Config
{
    private static array $items = [];
    private static bool $booted = false;

    public static function boot(string $root): void
    {
        if (self::$booted) {
            return;
        }
        if (is_file($root . '/.env')) {
            Dotenv::createImmutable($root)->safeLoad();
        }

        $secure = filter_var(env('REFRESH_COOKIE_SECURE', false), FILTER_VALIDATE_BOOLEAN);

        self::$items = [
            'app.name'      => env('APP_NAME', 'Fotolio'),
            'app.env'       => env('APP_ENV', 'local'),
            'app.debug'     => filter_var(env('APP_DEBUG', false), FILTER_VALIDATE_BOOLEAN),
            'app.url'       => rtrim((string) env('APP_URL', 'http://localhost:8000'), '/'),
            'app.dashboard_url' => rtrim((string) env('DASHBOARD_URL', 'http://localhost:5173'), '/'),
            'app.platform_hosts' => array_filter(array_map('trim', explode(',', (string) env('PLATFORM_HOSTS', 'localhost')))),
            'app.base_domain' => env('PLATFORM_BASE_DOMAIN', 'localhost'),

            'db.driver'     => env('DB_DRIVER', 'sqlite'),
            'db.sqlite_path'=> env('DB_SQLITE_PATH', 'storage/fotolio.sqlite'),
            'db.host'       => env('DB_HOST', '127.0.0.1'),
            'db.port'       => (int) env('DB_PORT', 3306),
            'db.name'       => env('DB_NAME', 'fotolio'),
            'db.user'       => env('DB_USER', 'root'),
            'db.pass'       => (string) env('DB_PASS', ''),

            'jwt.secret'      => env('JWT_SECRET', 'insecure-dev-secret'),
            'jwt.access_ttl'  => (int) env('JWT_ACCESS_TTL', 900),
            'jwt.refresh_ttl' => (int) env('JWT_REFRESH_TTL', 2592000),
            'jwt.refresh_cookie' => env('REFRESH_COOKIE_NAME', 'fotolio_rt'),
            'jwt.refresh_secure' => $secure,

            'media.url'       => env('MEDIA_URL', '/media'),
            'media.max_mb'    => (int) env('UPLOAD_MAX_MB', 40),
            'media.reference_mbps' => (float) env('REFERENCE_BANDWIDTH_MBPS', 5),

            'oauth.google'   => (string) env('GOOGLE_CLIENT_ID', ''),
            'oauth.facebook' => (string) env('FACEBOOK_CLIENT_ID', ''),
            'oauth.apple'    => (string) env('APPLE_CLIENT_ID', ''),

            // Self-hosted GeoIP: drop a GeoLite2-Country.mmdb here to resolve
            // visitor countries with no per-request external calls. Absent =>
            // "Unknown" fallback. See docs/ANALYTICS.md.
            'analytics.geolite_path' => env('GEOLITE2_DB', 'storage/GeoLite2-Country.mmdb'),
            'analytics.active_window' => (int) env('ANALYTICS_ACTIVE_WINDOW', 300),
        ];
        self::$booted = true;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::$items[$key] ?? $default;
    }

    public static function all(): array
    {
        return self::$items;
    }
}
