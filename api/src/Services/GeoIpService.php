<?php

namespace Fotolio\Services;

use Fotolio\Support\CountryCentroids;
use Fotolio\Support\MaxMindDbReader;

/**
 * Resolves an IP address to a country **and plottable coordinates** for the
 * analytics globe, with no per-request external calls.
 *
 * Resolution order for a public IP:
 *   1. GeoLite2-**City** location (latitude/longitude) if a City DB is installed;
 *   2. otherwise the country code → a bundled country-centroid coordinate;
 *   3. otherwise "Unknown" (no coordinates).
 *
 * Loopback/private IPs — and, by default, every visit outside a production
 * environment — fall back to a configurable **demo coordinate** (the site
 * owner's region) so the globe is demonstrably live on localhost. Real public
 * IPs in production still resolve normally. See docs/ANALYTICS.md.
 *
 * The provider is a single seam: swap this class' resolvePublic() to use a
 * hosted service or a different vendor without touching anything else.
 */
final class GeoIpService
{
    private ?MaxMindDbReader $reader = null;
    private bool $attempted = false;

    /** @return array{country:string,country_code:?string,lat:?float,lng:?float,demo:bool} */
    public function lookup(?string $ip): array
    {
        $private = $ip ? $this->isPrivate($ip) : true;

        // A real, resolvable public IP always wins.
        if ($ip && !$private) {
            $resolved = $this->resolvePublic($ip);
            if ($resolved) {
                return $resolved + ['demo' => false];
            }
        }

        // Nothing resolved. Fall back to the demo coordinate for loopback/private
        // IPs, or for any environment that isn't production (localhost demos).
        if ($this->demoEnabled($private)) {
            return $this->demoLocation();
        }

        if ($private) {
            return ['country' => 'Local', 'country_code' => null, 'lat' => null, 'lng' => null, 'demo' => false];
        }
        return ['country' => 'Unknown', 'country_code' => null, 'lat' => null, 'lng' => null, 'demo' => false];
    }

    public function available(): bool
    {
        return $this->reader() !== null;
    }

    /** True when the demo coordinate is being used for un-resolvable visits. */
    public function demoActive(): bool
    {
        return $this->demoEnabled(true);
    }

    /** @return array{country:string,country_code:?string,lat:?float,lng:?float}|null */
    private function resolvePublic(string $ip): ?array
    {
        $reader = $this->reader();
        if (!$reader) {
            return null;
        }
        try {
            $record = $reader->get($ip);
        } catch (\Throwable) {
            return null; // a malformed DB never breaks ingestion
        }
        if (!is_array($record)) {
            return null;
        }

        $country = $record['country'] ?? $record['registered_country'] ?? null;
        $code = null;
        $name = null;
        if (is_array($country)) {
            $code = isset($country['iso_code']) ? (string) $country['iso_code'] : null;
            $name = $country['names']['en'] ?? null;
        }

        // Precise coordinates from a City database, if present.
        $lat = null;
        $lng = null;
        if (isset($record['location']) && is_array($record['location'])) {
            $loc = $record['location'];
            $lat = isset($loc['latitude']) ? (float) $loc['latitude'] : null;
            $lng = isset($loc['longitude']) ? (float) $loc['longitude'] : null;
        }

        // Country-only DB (or a City record with no coordinates): centroid.
        if (($lat === null || $lng === null) && $code) {
            $c = CountryCentroids::get($code);
            if ($c) {
                $lat = $c['lat'];
                $lng = $c['lng'];
                $name = $name ?: $c['name'];
            }
        }

        if ($name === null && $code === null) {
            return null;
        }
        return [
            'country' => (string) ($name ?? 'Unknown'),
            'country_code' => $code,
            'lat' => $lat,
            'lng' => $lng,
        ];
    }

    private function demoEnabled(bool $private): bool
    {
        if (!(bool) config('analytics.demo_geo', false)) {
            return false;
        }
        return $private || config('app.env') !== 'production';
    }

    /** @return array{country:string,country_code:?string,lat:?float,lng:?float,demo:bool} */
    private function demoLocation(): array
    {
        $code = (string) config('analytics.demo_country_code', 'CH');
        return [
            'country' => (string) config('analytics.demo_country', 'Switzerland'),
            'country_code' => $code !== '' ? $code : null,
            'lat' => (float) config('analytics.demo_lat', 47.0502),
            'lng' => (float) config('analytics.demo_lng', 8.3093),
            'demo' => true,
        ];
    }

    private function reader(): ?MaxMindDbReader
    {
        if ($this->attempted) {
            return $this->reader;
        }
        $this->attempted = true;
        $path = (string) config('analytics.geolite_path');
        if ($path === '') {
            return null;
        }
        if (!str_starts_with($path, '/')) {
            $path = base_path($path);
        }
        if (!is_file($path)) {
            return null;
        }
        try {
            $this->reader = new MaxMindDbReader($path);
        } catch (\Throwable) {
            $this->reader = null;
        }
        return $this->reader;
    }

    private function isPrivate(string $ip): bool
    {
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) === false;
    }
}
