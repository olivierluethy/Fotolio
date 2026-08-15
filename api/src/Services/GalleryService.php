<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\HttpException;

final class GalleryService
{
    public function __construct(private ImageService $images)
    {
    }

    public function list(int $siteId, bool $withImages = false): array
    {
        $rows = Database::all('SELECT * FROM galleries WHERE site_id = :s ORDER BY sort ASC, id ASC', ['s' => $siteId]);
        return array_map(fn ($g) => $this->present($g, $withImages), $rows);
    }

    public function create(int $siteId, array $data): array
    {
        $name = trim($data['name']);
        $slug = $this->uniqueSlug($siteId, $data['slug'] ?? $name);
        $id = Database::insert('galleries', [
            'site_id' => $siteId,
            'name' => $name,
            'slug' => $slug,
            'description' => $data['description'] ?? null,
            'sort' => $this->nextSort($siteId),
            'is_home' => 0,
            'show_in_nav' => isset($data['show_in_nav']) ? (int) (bool) $data['show_in_nav'] : 1,
            'header_config' => isset($data['header_config']) ? json_encode($data['header_config']) : null,
            'cover_image_id' => null,
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ]);
        return $this->present($this->row($siteId, $id));
    }

    public function update(int $siteId, int $id, array $data): array
    {
        $gallery = $this->row($siteId, $id);
        $fields = [];
        if (array_key_exists('name', $data)) {
            $fields['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $fields['description'] = $data['description'] === '' ? null : $data['description'];
        }
        if (array_key_exists('show_in_nav', $data)) {
            $fields['show_in_nav'] = (int) (bool) $data['show_in_nav'];
        }
        if (array_key_exists('header_config', $data)) {
            $fields['header_config'] = json_encode($data['header_config']);
        }
        if (array_key_exists('cover_image_id', $data)) {
            $fields['cover_image_id'] = $data['cover_image_id'] ?: null;
        }
        // The Home gallery keeps its slug; others may rename.
        if (array_key_exists('slug', $data) && !$gallery['is_home'] && $data['slug'] !== $gallery['slug']) {
            $fields['slug'] = $this->uniqueSlug($siteId, $data['slug'], $id);
        }
        if ($fields) {
            $fields['updated_at'] = Database::now();
            Database::update('galleries', $fields, 'id = :id', ['id' => $id]);
        }
        return $this->present($this->row($siteId, $id));
    }

    public function delete(int $siteId, int $id): void
    {
        $gallery = $this->row($siteId, $id);
        if ($gallery['is_home']) {
            throw HttpException::unprocessable('The Home gallery can’t be deleted.');
        }
        Database::delete('galleries', 'id = :id', ['id' => $id]);
    }

    public function reorder(int $siteId, array $orderedIds): array
    {
        foreach (array_values($orderedIds) as $i => $gid) {
            Database::update('galleries', ['sort' => $i], 'id = :id AND site_id = :s', ['id' => (int) $gid, 's' => $siteId]);
        }
        return $this->list($siteId);
    }

    public function assignImages(int $siteId, int $galleryId, array $imageIds): array
    {
        $this->row($siteId, $galleryId);
        $start = (int) Database::column('SELECT COALESCE(MAX(sort),0)+1 FROM image_gallery WHERE gallery_id = :g', ['g' => $galleryId]);
        foreach (array_values($imageIds) as $offset => $imageId) {
            $imageId = (int) $imageId;
            $belongs = Database::fetch('SELECT id FROM images WHERE id = :i AND site_id = :s', ['i' => $imageId, 's' => $siteId]);
            if (!$belongs) {
                continue;
            }
            $exists = Database::fetch(
                'SELECT id FROM image_gallery WHERE gallery_id = :g AND image_id = :i',
                ['g' => $galleryId, 'i' => $imageId]
            );
            if (!$exists) {
                Database::insert('image_gallery', [
                    'gallery_id' => $galleryId,
                    'image_id' => $imageId,
                    'sort' => $start + $offset,
                ]);
            }
        }
        return $this->present($this->row($siteId, $galleryId), true);
    }

    public function removeImage(int $siteId, int $galleryId, int $imageId): array
    {
        $this->row($siteId, $galleryId);
        Database::delete('image_gallery', 'gallery_id = :g AND image_id = :i', ['g' => $galleryId, 'i' => $imageId]);
        return $this->present($this->row($siteId, $galleryId), true);
    }

    public function reorderImages(int $siteId, int $galleryId, array $orderedImageIds): array
    {
        $this->row($siteId, $galleryId);
        foreach (array_values($orderedImageIds) as $i => $imageId) {
            Database::update('image_gallery', ['sort' => $i], 'gallery_id = :g AND image_id = :i', [
                'g' => $galleryId, 'i' => (int) $imageId,
            ]);
        }
        return $this->present($this->row($siteId, $galleryId), true);
    }

    public function present(array $gallery, bool $withImages = false): array
    {
        $count = (int) Database::column('SELECT COUNT(*) FROM image_gallery WHERE gallery_id = :g', ['g' => $gallery['id']]);
        $out = [
            'id' => (int) $gallery['id'],
            'name' => $gallery['name'],
            'slug' => $gallery['slug'],
            'description' => $gallery['description'],
            'sort' => (int) $gallery['sort'],
            'is_home' => (bool) $gallery['is_home'],
            'show_in_nav' => (bool) $gallery['show_in_nav'],
            'header_config' => $gallery['header_config'] ? json_decode($gallery['header_config'], true) : null,
            'cover_image_id' => $gallery['cover_image_id'] ? (int) $gallery['cover_image_id'] : null,
            'image_count' => $count,
        ];
        if ($withImages) {
            $out['images'] = $this->imagesFor((int) $gallery['id']);
        } else {
            $out['cover'] = $this->cover($gallery);
        }
        return $out;
    }

    public function imagesFor(int $galleryId): array
    {
        $rows = Database::all(
            'SELECT i.*, ig.sort AS pivot_sort FROM image_gallery ig
             JOIN images i ON i.id = ig.image_id
             WHERE ig.gallery_id = :g ORDER BY ig.sort ASC, ig.id ASC',
            ['g' => $galleryId]
        );
        return array_map(fn ($r) => $this->images->present($r), $rows);
    }

    private function cover(array $gallery): ?array
    {
        $imageId = $gallery['cover_image_id'];
        if (!$imageId) {
            $imageId = Database::column(
                'SELECT image_id FROM image_gallery WHERE gallery_id = :g ORDER BY sort ASC LIMIT 1',
                ['g' => $gallery['id']]
            );
        }
        if (!$imageId) {
            return null;
        }
        $row = Database::fetch('SELECT * FROM images WHERE id = :id', ['id' => $imageId]);
        return $row ? $this->images->present($row) : null;
    }

    public function row(int $siteId, int $id): array
    {
        $row = Database::fetch('SELECT * FROM galleries WHERE id = :id AND site_id = :s', ['id' => $id, 's' => $siteId]);
        if (!$row) {
            throw HttpException::notFound('Gallery not found.');
        }
        return $row;
    }

    private function nextSort(int $siteId): int
    {
        return (int) Database::column('SELECT COALESCE(MAX(sort),0)+1 FROM galleries WHERE site_id = :s', ['s' => $siteId]);
    }

    private function uniqueSlug(int $siteId, string $base, ?int $ignoreId = null): string
    {
        $base = str_slug($base) ?: 'gallery';
        $slug = $base;
        $i = 1;
        while (true) {
            $sql = 'SELECT id FROM galleries WHERE site_id = :s AND slug = :slug';
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
