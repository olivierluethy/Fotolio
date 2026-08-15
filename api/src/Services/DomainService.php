<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\HttpException;

/**
 * Subdomain + custom-domain resolution. TLS/cert provisioning and wildcard-DNS
 * are deployment concerns (see DEPLOYMENT.md) — this only manages records and
 * verifies resolution.
 */
final class DomainService
{
    public function __construct(private SiteService $sites)
    {
    }

    public function setSubdomain(int $userId, ?string $subdomain, bool $enabled): array
    {
        $site = $this->sites->forUser($userId);
        if ($subdomain !== null && $subdomain !== '') {
            $subdomain = str_slug($subdomain);
            if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/', $subdomain)) {
                throw HttpException::unprocessable('Use 3–40 lowercase letters, numbers and hyphens.', ['subdomain' => 'Invalid subdomain.']);
            }
            $taken = Database::fetch('SELECT id FROM sites WHERE subdomain = :s AND id != :id', ['s' => $subdomain, 'id' => $site['id']]);
            if ($taken) {
                throw HttpException::conflict('That subdomain is already taken.');
            }
        }
        Database::update('sites', [
            'subdomain' => $subdomain ?: null,
            'subdomain_enabled' => $enabled && $subdomain ? 1 : 0,
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $site['id']]);

        return $this->sites->forUser($userId);
    }

    public function setDomain(int $userId, string $domain): array
    {
        $site = $this->sites->forUser($userId);
        $domain = strtolower(trim($domain));
        $domain = preg_replace('#^https?://#', '', $domain);
        $domain = rtrim(explode('/', $domain)[0], '.');
        if (!preg_match('/^(?=.{4,191}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/', $domain)) {
            throw HttpException::unprocessable('Enter a valid domain like studio.example.com.', ['custom_domain' => 'Invalid domain.']);
        }
        $taken = Database::fetch('SELECT id FROM sites WHERE custom_domain = :d AND id != :id', ['d' => $domain, 'id' => $site['id']]);
        if ($taken) {
            throw HttpException::conflict('That domain is already connected to another site.');
        }
        $token = 'fotolio-verify=' . bin2hex(random_bytes(16));
        Database::update('sites', [
            'custom_domain' => $domain,
            'domain_verified' => 0,
            'domain_verify_token' => $token,
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $site['id']]);

        return [
            'site' => $this->sites->forUser($userId),
            'dns_records' => $this->records($domain, $token),
        ];
    }

    public function verify(int $userId): array
    {
        $site = $this->sites->forUser($userId);
        if (empty($site['custom_domain'])) {
            throw HttpException::unprocessable('Add a domain first.');
        }
        $domain = $site['custom_domain'];
        $token = $site['domain_verify_token'];

        $verified = $this->txtContains('_fotolio-challenge.' . $domain, $token)
            || $this->resolvesToPlatform($domain);

        if ($verified) {
            Database::update('sites', ['domain_verified' => 1, 'updated_at' => Database::now()], 'id = :id', ['id' => $site['id']]);
        }
        return [
            'verified' => $verified,
            'site' => $this->sites->forUser($userId),
            'dns_records' => $this->records($domain, $token),
            'checked_at' => gmdate('c'),
        ];
    }

    public function removeDomain(int $userId): array
    {
        $site = $this->sites->forUser($userId);
        Database::update('sites', [
            'custom_domain' => null,
            'domain_verified' => 0,
            'domain_verify_token' => null,
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $site['id']]);
        return $this->sites->forUser($userId);
    }

    private function records(string $domain, string $token): array
    {
        $base = config('app.base_domain');
        $apex = substr_count($domain, '.') < 2;
        return [
            [
                'purpose' => 'Point your domain at Fotolio',
                'type' => $apex ? 'A' : 'CNAME',
                'name' => $apex ? '@' : explode('.', $domain)[0],
                'value' => $apex ? '203.0.113.10' : ('sites.' . $base),
                'note' => $apex ? 'Replace with your server’s IP once deployed.' : 'CNAME to the Fotolio sites host.',
            ],
            [
                'purpose' => 'Verify ownership',
                'type' => 'TXT',
                'name' => '_fotolio-challenge',
                'value' => $token,
                'note' => 'Used once to confirm the domain is yours.',
            ],
        ];
    }

    private function txtContains(string $host, ?string $needle): bool
    {
        if (!$needle) {
            return false;
        }
        $records = @dns_get_record($host, DNS_TXT) ?: [];
        foreach ($records as $r) {
            if (isset($r['txt']) && str_contains($r['txt'], $needle)) {
                return true;
            }
        }
        return false;
    }

    private function resolvesToPlatform(string $domain): bool
    {
        $base = config('app.base_domain');
        $cname = @dns_get_record($domain, DNS_CNAME) ?: [];
        foreach ($cname as $r) {
            if (isset($r['target']) && str_ends_with(rtrim($r['target'], '.'), (string) $base)) {
                return true;
            }
        }
        return false;
    }
}
