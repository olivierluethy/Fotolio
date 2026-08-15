<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\HttpException;

/**
 * About + custom content pages. Pages are opt-in — none are created as empty
 * stubs; the user adds them explicitly.
 */
final class PageService
{
    public function list(int $siteId): array
    {
        $rows = Database::all('SELECT * FROM pages WHERE site_id = :s ORDER BY sort ASC, id ASC', ['s' => $siteId]);
        return array_map([$this, 'present'], $rows);
    }

    public function create(int $siteId, array $data): array
    {
        $type = ($data['type'] ?? 'custom') === 'about' ? 'about' : 'custom';
        if ($type === 'about' && Database::fetch('SELECT id FROM pages WHERE site_id = :s AND type = :t', ['s' => $siteId, 't' => 'about'])) {
            throw HttpException::conflict('An About page already exists.');
        }
        $title = trim($data['title'] ?? ($type === 'about' ? 'About' : 'Untitled page'));
        $slug = $this->uniqueSlug($siteId, $data['slug'] ?? $title);
        $id = Database::insert('pages', [
            'site_id' => $siteId,
            'type' => $type,
            'title' => $title,
            'slug' => $slug,
            'content' => json_encode($data['content'] ?? []),
            'header_config' => isset($data['header_config']) ? json_encode($data['header_config']) : null,
            'sort' => $this->nextSort($siteId),
            'published' => isset($data['published']) ? (int) (bool) $data['published'] : 1,
            'show_in_nav' => isset($data['show_in_nav']) ? (int) (bool) $data['show_in_nav'] : 1,
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ]);
        return $this->present($this->row($siteId, $id));
    }

    public function update(int $siteId, int $id, array $data): array
    {
        $page = $this->row($siteId, $id);
        $fields = [];
        if (array_key_exists('title', $data)) {
            $fields['title'] = trim($data['title']);
        }
        if (array_key_exists('content', $data)) {
            $fields['content'] = json_encode($data['content']);
        }
        if (array_key_exists('header_config', $data)) {
            $fields['header_config'] = json_encode($data['header_config']);
        }
        if (array_key_exists('published', $data)) {
            $fields['published'] = (int) (bool) $data['published'];
        }
        if (array_key_exists('show_in_nav', $data)) {
            $fields['show_in_nav'] = (int) (bool) $data['show_in_nav'];
        }
        if (array_key_exists('slug', $data) && $data['slug'] !== $page['slug']) {
            $fields['slug'] = $this->uniqueSlug($siteId, $data['slug'], $id);
        }
        if ($fields) {
            $fields['updated_at'] = Database::now();
            Database::update('pages', $fields, 'id = :id', ['id' => $id]);
        }
        return $this->present($this->row($siteId, $id));
    }

    public function delete(int $siteId, int $id): void
    {
        $this->row($siteId, $id);
        Database::delete('pages', 'id = :id', ['id' => $id]);
    }

    public function reorder(int $siteId, array $orderedIds): array
    {
        foreach (array_values($orderedIds) as $i => $pid) {
            Database::update('pages', ['sort' => $i], 'id = :id AND site_id = :s', ['id' => (int) $pid, 's' => $siteId]);
        }
        return $this->list($siteId);
    }

    public function present(array $page): array
    {
        return [
            'id' => (int) $page['id'],
            'type' => $page['type'],
            'title' => $page['title'],
            'slug' => $page['slug'],
            'content' => $page['content'] ? json_decode($page['content'], true) : [],
            'header_config' => $page['header_config'] ? json_decode($page['header_config'], true) : null,
            'sort' => (int) $page['sort'],
            'published' => (bool) $page['published'],
            'show_in_nav' => (bool) $page['show_in_nav'],
        ];
    }

    public function row(int $siteId, int $id): array
    {
        $row = Database::fetch('SELECT * FROM pages WHERE id = :id AND site_id = :s', ['id' => $id, 's' => $siteId]);
        if (!$row) {
            throw HttpException::notFound('Page not found.');
        }
        return $row;
    }

    private function nextSort(int $siteId): int
    {
        return (int) Database::column('SELECT COALESCE(MAX(sort),0)+1 FROM pages WHERE site_id = :s', ['s' => $siteId]);
    }

    private function uniqueSlug(int $siteId, string $base, ?int $ignoreId = null): string
    {
        $base = str_slug($base) ?: 'page';
        $slug = $base;
        $i = 1;
        while (true) {
            $sql = 'SELECT id FROM pages WHERE site_id = :s AND slug = :slug';
            $params = ['s' => $siteId, 'slug' => $slug];
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
}
