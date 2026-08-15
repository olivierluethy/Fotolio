<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\HttpException;

final class SiteService
{
    /** Provision the single site + default Home gallery for a new user. */
    public function createForUser(int $userId, string $displayName): int
    {
        $slug = $this->uniqueSlug(str_slug($displayName) ?: 'studio');
        $siteId = Database::insert('sites', [
            'user_id' => $userId,
            'title' => trim($displayName) . "'s portfolio",
            'tagline' => null,
            'slug' => $slug,
            'subdomain' => null,
            'subdomain_enabled' => 0,
            'custom_domain' => null,
            'domain_verified' => 0,
            'published' => 0,
            'theme' => 'default',
            'home_header' => json_encode(self::defaultHeader()),
            'settings' => json_encode(['social' => new \stdClass(), 'footer' => null]),
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ]);

        Database::insert('galleries', [
            'site_id' => $siteId,
            'name' => 'Home',
            'slug' => 'home',
            'description' => null,
            'sort' => 0,
            'is_home' => 1,
            'show_in_nav' => 1,
            'header_config' => null,
            'cover_image_id' => null,
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ]);

        // Seed the draft/published state documents for the editor + public site.
        $doc = json_encode((new SiteStateService())->composeFromTables($siteId));
        Database::update('sites', [
            'draft_state' => $doc,
            'published_state' => $doc,
        ], 'id = :id', ['id' => $siteId]);

        return $siteId;
    }

    public function forUser(int $userId): array
    {
        $site = Database::fetch('SELECT * FROM sites WHERE user_id = :u', ['u' => $userId]);
        if (!$site) {
            throw HttpException::notFound('Site not found.');
        }
        return $this->hydrate($site);
    }

    public function find(int $siteId): ?array
    {
        $site = Database::fetch('SELECT * FROM sites WHERE id = :id', ['id' => $siteId]);
        return $site ? $this->hydrate($site) : null;
    }

    public function update(int $userId, array $data): array
    {
        $site = $this->forUser($userId);
        $fields = [];
        // title is NOT NULL — only overwrite with a real value.
        if (array_key_exists('title', $data) && is_string($data['title']) && trim($data['title']) !== '') {
            $fields['title'] = trim($data['title']);
        }
        foreach (['tagline', 'theme', 'accent'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[$key] = $data[$key];
            }
        }
        if (array_key_exists('home_header', $data)) {
            $fields['home_header'] = json_encode($data['home_header']);
        }
        if (array_key_exists('settings', $data)) {
            $fields['settings'] = json_encode($data['settings']);
        }
        if (array_key_exists('slug', $data) && is_string($data['slug']) && $data['slug'] !== '' && $data['slug'] !== $site['slug']) {
            $fields['slug'] = $this->uniqueSlug($data['slug'], $site['id']);
        }
        if ($fields) {
            $fields['updated_at'] = Database::now();
            Database::update('sites', $fields, 'id = :id', ['id' => $site['id']]);
        }
        return $this->forUser($userId);
    }

    public function setPublished(int $userId, bool $published): array
    {
        $site = $this->forUser($userId);
        Database::update('sites', [
            'published' => $published ? 1 : 0,
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $site['id']]);
        return $this->forUser($userId);
    }

    public function uniqueSlug(string $base, ?int $ignoreId = null): string
    {
        $base = str_slug($base) ?: 'studio';
        if (strlen($base) < 3) {
            $base = str_pad($base, 3, '0');
        }
        $base = substr($base, 0, 40);
        $slug = $base;
        $i = 1;
        while (true) {
            $params = ['s' => $slug];
            $sql = 'SELECT id FROM sites WHERE slug = :s';
            if ($ignoreId) {
                $sql .= ' AND id != :id';
                $params['id'] = $ignoreId;
            }
            if (!Database::fetch($sql, $params)) {
                return $slug;
            }
            $slug = $base . '-' . (++$i);
        }
    }

    public function publicUrl(array $site): string
    {
        $base = config('app.url');
        if (!empty($site['custom_domain']) && $site['domain_verified']) {
            return 'https://' . $site['custom_domain'];
        }
        if (!empty($site['subdomain']) && $site['subdomain_enabled']) {
            return 'https://' . $site['subdomain'] . '.' . config('app.base_domain');
        }
        return $base . '/@' . $site['slug'];
    }

    private function hydrate(array $site): array
    {
        $site['subdomain_enabled'] = (bool) $site['subdomain_enabled'];
        $site['domain_verified'] = (bool) $site['domain_verified'];
        $site['published'] = (bool) $site['published'];
        $site['home_header'] = $site['home_header'] ? json_decode($site['home_header'], true) : self::defaultHeader();
        $site['settings'] = $site['settings'] ? json_decode($site['settings'], true) : [];
        $site['public_url'] = $this->publicUrl($site);
        // The full state documents are served by the Site Editor endpoint, not
        // in every /site payload — keep this response lean.
        unset($site['draft_state'], $site['published_state']);
        return $site;
    }

    public static function defaultHeader(): array
    {
        return [
            'mode' => 'single',           // single | slideshow
            'image_ids' => [],
            'slideshow' => ['autoplay' => true, 'interval' => 5000, 'controls' => true],
            'overlay' => [
                'title' => '',
                'subtitle' => '',
                'position' => 'center',   // top | center | bottom
                'align' => 'center',      // left | center | right
                'style' => 'light',       // light | dark
            ],
            'animate_text' => true,       // the reimplemented "text pops up" reveal
            'rotating_words' => [],
            'parallax' => true,
            'height' => 'tall',           // tall | medium | full
        ];
    }
}
