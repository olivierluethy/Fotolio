<?php

namespace Fotolio\Services;

/**
 * Address <-> place-name geocoding, proxied server-side.
 *
 * Runs the request from PHP (not the browser) so there is one shared User-Agent,
 * a small server-side cache, and no provider key in the frontend — and so the
 * provider can be swapped in one place. Uses Photon (Komoot, OSM-based,
 * key-less) for both forward autocomplete and reverse lookups, matching the
 * project's no-cost stance. Swapping providers means editing `endpoint()` and
 * the two `map*` methods here — nothing else changes.
 */
final class GeocodingService
{
    private const UA = 'Fotolio/1.0 (self-hosted photo portfolio; +https://fotolio.app)';
    private const TIMEOUT = 6;

    private function base(): string
    {
        return rtrim((string) (config('geocode.url') ?: 'https://photon.komoot.io'), '/');
    }

    /** Forward search / typeahead: a query string → ranked place suggestions. */
    public function search(string $query, int $limit = 6): array
    {
        $query = trim($query);
        if (mb_strlen($query) < 2) {
            return [];
        }
        $limit = max(1, min(10, $limit));
        $url = $this->base() . '/api/?' . http_build_query(['q' => $query, 'limit' => $limit, 'lang' => 'en']);
        $data = $this->fetch($url, 'fwd:' . $limit . ':' . mb_strtolower($query), 7 * 86400);
        $out = [];
        foreach (($data['features'] ?? []) as $f) {
            $row = $this->mapFeature($f);
            if ($row) {
                $out[] = $row;
            }
        }
        return $out;
    }

    /** Reverse lookup: coordinates → a single readable place name. */
    public function reverse(float $lat, float $lng): ?array
    {
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            return null;
        }
        $url = $this->base() . '/reverse?' . http_build_query([
            'lat' => $lat, 'lon' => $lng, 'lang' => 'en',
        ]);
        $key = 'rev:' . round($lat, 4) . ',' . round($lng, 4);
        $data = $this->fetch($url, $key, 30 * 86400);
        foreach (($data['features'] ?? []) as $f) {
            $row = $this->mapFeature($f);
            if ($row) {
                return $row;
            }
        }
        return null;
    }

    /** GeoJSON feature → { label, lat, lng }. */
    private function mapFeature(array $f): ?array
    {
        $coords = $f['geometry']['coordinates'] ?? null;
        $p = $f['properties'] ?? [];
        if (!is_array($coords) || count($coords) < 2) {
            return null;
        }
        $label = $this->label($p);
        if ($label === '') {
            return null;
        }
        return [
            'label' => $label,
            'lat' => (float) $coords[1],
            'lng' => (float) $coords[0],
        ];
    }

    /** Compose a human place label from Photon/OSM properties. */
    private function label(array $p): string
    {
        $name = trim((string) ($p['name'] ?? ''));
        $street = trim(((string) ($p['street'] ?? '')) . ' ' . ((string) ($p['housenumber'] ?? '')));
        $head = $name !== '' ? $name : $street;
        $parts = [];
        if ($head !== '') {
            $parts[] = $head;
        }
        foreach (['city', 'state', 'country'] as $k) {
            $v = trim((string) ($p[$k] ?? ''));
            if ($v !== '' && !in_array($v, $parts, true)) {
                $parts[] = $v;
            }
        }
        return implode(', ', $parts);
    }

    /** GET JSON with a shared UA + a small on-disk cache. Returns [] on failure. */
    private function fetch(string $url, string $cacheKey, int $ttl): array
    {
        $cached = $this->cacheGet($cacheKey, $ttl);
        if ($cached !== null) {
            return $cached;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::TIMEOUT,
            CURLOPT_USERAGENT => self::UA,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 2,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false || $status < 200 || $status >= 300) {
            return [];
        }
        $data = json_decode((string) $body, true);
        if (!is_array($data)) {
            return [];
        }
        $this->cacheSet($cacheKey, $data);
        return $data;
    }

    private function cacheDir(): string
    {
        $dir = storage_path('cache/geocode');
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    private function cacheFile(string $key): string
    {
        return $this->cacheDir() . '/' . md5($key) . '.json';
    }

    private function cacheGet(string $key, int $ttl): ?array
    {
        $file = $this->cacheFile($key);
        if (!is_file($file) || (time() - filemtime($file)) > $ttl) {
            return null;
        }
        $data = json_decode((string) @file_get_contents($file), true);
        return is_array($data) ? $data : null;
    }

    private function cacheSet(string $key, array $data): void
    {
        @file_put_contents($this->cacheFile($key), json_encode($data), LOCK_EX);
    }
}
