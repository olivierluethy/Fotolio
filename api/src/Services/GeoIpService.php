<?php

namespace Fotolio\Services;

use Fotolio\Support\MaxMindDbReader;

/**
 * Resolves an IP address to a country using a self-hosted GeoLite2-Country
 * database — no per-request external calls. The lookup provider is pluggable:
 * the default reads a local .mmdb; if the file is absent or unreadable every
 * lookup gracefully degrades to "Unknown" (private/loopback IPs report
 * "Local"). See docs/ANALYTICS.md for how to install the database.
 */
final class GeoIpService
{
    private ?MaxMindDbReader $reader = null;
    private bool $attempted = false;

    /** @return array{country:string,country_code:?string} */
    public function lookup(?string $ip): array
    {
        $unknown = ['country' => 'Unknown', 'country_code' => null];
        if (!$ip) {
            return $unknown;
        }
        if ($this->isPrivate($ip)) {
            return ['country' => 'Local', 'country_code' => null];
        }

        $reader = $this->reader();
        if (!$reader) {
            return $unknown;
        }

        try {
            $record = $reader->get($ip);
            $country = $record['country'] ?? $record['registered_country'] ?? null;
            if (is_array($country)) {
                $code = isset($country['iso_code']) ? (string) $country['iso_code'] : null;
                $name = $country['names']['en'] ?? null;
                if ($name) {
                    return ['country' => (string) $name, 'country_code' => $code];
                }
            }
        } catch (\Throwable) {
            // fall through to Unknown — a malformed DB never breaks ingestion
        }
        return $unknown;
    }

    public function available(): bool
    {
        return $this->reader() !== null;
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
