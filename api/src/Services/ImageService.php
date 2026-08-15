<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\HttpException;

final class ImageService
{
    public function __construct(private ImageOptimizationService $optimizer)
    {
    }

    /**
     * Ingest one source file through the full optimisation pipeline and persist
     * it. Returns the API-shaped image with before/after metrics for review.
     */
    public function ingest(int $userId, int $siteId, string $tempPath, string $originalName, int $quality = 82): array
    {
        $mime = $this->detectMime($tempPath);
        if (!$this->optimizer->isSupported($mime)) {
            throw HttpException::unprocessable(
                "“{$originalName}” is a {$mime} file, which this server can’t optimise. "
                . 'JPEG, PNG, WebP, GIF and BMP are supported (HEIC/TIFF need the Imagick backend).'
            );
        }

        $originalBytes = (int) filesize($tempPath);
        $maxBytes = (int) config('media.max_mb', 40) * 1024 * 1024;
        if ($originalBytes > $maxBytes) {
            throw HttpException::unprocessable(
                "“{$originalName}” is " . human_bytes($originalBytes) . '; the limit is ' . config('media.max_mb') . ' MB.'
            );
        }

        $exif = (new ExifService())->extract($tempPath, $mime);
        $key = bin2hex(random_bytes(12));
        $ext = $this->extensionFor($mime);

        // Keep the original private (outside the public web root).
        $originalDir = storage_path("originals/$siteId");
        @mkdir($originalDir, 0775, true);
        $originalPath = "$originalDir/$key.$ext";
        copy($tempPath, $originalPath);

        $mediaDir = base_path("public/media/$siteId/$key");
        $urlBase = rtrim((string) config('media.url'), '/') . "/$siteId/$key";
        $result = $this->optimizer->generate($originalPath, $mediaDir, $urlBase, $quality);

        $title = $this->titleFromFilename($originalName);
        $captureMethod = $this->guessCaptureMethod($originalName, $exif);

        $id = Database::insert('images', array_merge([
            'user_id' => $userId,
            'site_id' => $siteId,
            'title' => $title,
            'location' => null,
            'description' => null,
            'capture_method' => $captureMethod,
            'tags' => json_encode([]),
            'width' => $result['width'],
            'height' => $result['height'],
            'original_filename' => substr($originalName, 0, 255),
            'original_path' => "originals/$siteId/$key.$ext",
            'original_bytes' => $originalBytes,
            'mime' => $mime,
            'variants' => json_encode($result['variants']),
            'optimised_bytes' => $result['optimised_bytes'],
            'reduction_pct' => $this->optimizer->metrics($originalBytes, $result['optimised_bytes'])['reduction_pct'],
            'quality' => $quality,
            'status' => 'ready',
            'sort' => $this->nextSort($siteId),
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ], $exif));

        return $this->present($this->row($id));
    }

    public function reoptimize(int $userId, int $imageId, int $quality): array
    {
        $row = $this->ownedRow($userId, $imageId);
        $originalPath = storage_path($row['original_path']);
        if (!is_file($originalPath)) {
            throw HttpException::unprocessable('The original file for this image is no longer available.');
        }
        $key = basename(dirname($row['original_path'])) . '/' . pathinfo($row['original_path'], PATHINFO_FILENAME);
        // media dir is public/media/{siteId}/{key} where key == the filename token
        $token = pathinfo($row['original_path'], PATHINFO_FILENAME);
        $mediaDir = base_path("public/media/{$row['site_id']}/$token");
        $urlBase = rtrim((string) config('media.url'), '/') . "/{$row['site_id']}/$token";

        $this->optimizer->purge($mediaDir);
        $result = $this->optimizer->generate($originalPath, $mediaDir, $urlBase, $quality);

        Database::update('images', [
            'variants' => json_encode($result['variants']),
            'optimised_bytes' => $result['optimised_bytes'],
            'reduction_pct' => $this->optimizer->metrics((int) $row['original_bytes'], $result['optimised_bytes'])['reduction_pct'],
            'quality' => max(30, min(95, $quality)),
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $imageId]);

        return $this->present($this->row($imageId));
    }

    public function list(int $siteId, array $filters = []): array
    {
        $sql = 'SELECT * FROM images WHERE site_id = :s';
        $params = ['s' => $siteId];
        if (!empty($filters['capture_method'])) {
            $sql .= ' AND capture_method = :cm';
            $params['cm'] = $filters['capture_method'];
        }
        if (!empty($filters['search'])) {
            $sql .= ' AND (title LIKE :q OR location LIKE :q OR description LIKE :q)';
            $params['q'] = '%' . $filters['search'] . '%';
        }
        if (!empty($filters['gallery_id'])) {
            $sql .= ' AND id IN (SELECT image_id FROM image_gallery WHERE gallery_id = :g)';
            $params['g'] = $filters['gallery_id'];
        }
        $sql .= ' ORDER BY sort ASC, id DESC';
        return array_map([$this, 'present'], Database::all($sql, $params));
    }

    public function show(int $siteId, int $imageId): array
    {
        return $this->present($this->siteRow($siteId, $imageId));
    }

    public function update(int $siteId, int $imageId, array $data): array
    {
        $this->siteRow($siteId, $imageId); // ownership check
        $fields = [];
        foreach (['title', 'location', 'description', 'capture_method', 'camera_make', 'camera_model',
                  'lens', 'focal_length', 'aperture', 'shutter', 'iso'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[$key] = $data[$key] === '' ? null : $data[$key];
            }
        }
        if (array_key_exists('tags', $data)) {
            $fields['tags'] = json_encode(array_values(array_filter((array) $data['tags'])));
        }
        if ($fields) {
            $fields['updated_at'] = Database::now();
            Database::update('images', $fields, 'id = :id', ['id' => $imageId]);
        }
        return $this->present($this->row($imageId));
    }

    public function delete(int $siteId, int $imageId): void
    {
        $row = $this->siteRow($siteId, $imageId);
        $token = pathinfo($row['original_path'], PATHINFO_FILENAME);
        $this->optimizer->purge(base_path("public/media/{$row['site_id']}/$token"));
        @unlink(storage_path($row['original_path']));
        Database::delete('images', 'id = :id', ['id' => $imageId]);
    }

    /** Bulk update metadata / capture method / delete for many images. */
    public function bulk(int $siteId, array $ids, string $action, array $payload = []): int
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if (!$ids) {
            return 0;
        }
        $count = 0;
        foreach ($ids as $id) {
            if (!Database::fetch('SELECT id FROM images WHERE id = :id AND site_id = :s', ['id' => $id, 's' => $siteId])) {
                continue;
            }
            if ($action === 'delete') {
                $this->delete($siteId, $id);
            } elseif ($action === 'update') {
                $this->update($siteId, $id, $payload);
            }
            $count++;
        }
        return $count;
    }

    public function present(array $row): array
    {
        $variants = $row['variants'] ? json_decode($row['variants'], true) : [];
        $metrics = $this->optimizer->metrics((int) $row['original_bytes'], (int) $row['optimised_bytes']);
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'location' => $row['location'],
            'description' => $row['description'],
            'capture_method' => $row['capture_method'],
            'tags' => $row['tags'] ? json_decode($row['tags'], true) : [],
            'width' => (int) $row['width'],
            'height' => (int) $row['height'],
            'original_filename' => $row['original_filename'],
            'mime' => $row['mime'],
            'quality' => (int) $row['quality'],
            'status' => $row['status'],
            'sort' => (int) $row['sort'],
            'exif' => [
                'camera_make' => $row['camera_make'],
                'camera_model' => $row['camera_model'],
                'lens' => $row['lens'],
                'focal_length' => $row['focal_length'],
                'aperture' => $row['aperture'],
                'shutter' => $row['shutter'],
                'iso' => $row['iso'],
                'captured_at' => $row['captured_at'],
                'gps_lat' => $row['gps_lat'] !== null ? (float) $row['gps_lat'] : null,
                'gps_lng' => $row['gps_lng'] !== null ? (float) $row['gps_lng'] : null,
            ],
            'variants' => $variants,
            'metrics' => $metrics,
            'created_at' => $row['created_at'],
        ];
    }

    // ---- internals ---------------------------------------------------------

    private function row(int $id): array
    {
        $row = Database::fetch('SELECT * FROM images WHERE id = :id', ['id' => $id]);
        if (!$row) {
            throw HttpException::notFound('Image not found.');
        }
        return $row;
    }

    private function siteRow(int $siteId, int $id): array
    {
        $row = Database::fetch('SELECT * FROM images WHERE id = :id AND site_id = :s', ['id' => $id, 's' => $siteId]);
        if (!$row) {
            throw HttpException::notFound('Image not found.');
        }
        return $row;
    }

    private function ownedRow(int $userId, int $id): array
    {
        $row = Database::fetch('SELECT * FROM images WHERE id = :id AND user_id = :u', ['id' => $id, 'u' => $userId]);
        if (!$row) {
            throw HttpException::notFound('Image not found.');
        }
        return $row;
    }

    private function nextSort(int $siteId): int
    {
        return (int) Database::column('SELECT COALESCE(MAX(sort), 0) + 1 FROM images WHERE site_id = :s', ['s' => $siteId]);
    }

    private function detectMime(string $path): string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        return $finfo->file($path) ?: 'application/octet-stream';
    }

    private function extensionFor(string $mime): string
    {
        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'image/bmp' => 'bmp',
            default => 'img',
        };
    }

    private function titleFromFilename(string $name): string
    {
        $base = pathinfo($name, PATHINFO_FILENAME);
        $base = preg_replace('/[_-]+/', ' ', $base) ?? $base;
        return trim(ucwords(strtolower($base))) ?: 'Untitled';
    }

    private function guessCaptureMethod(string $name, array $exif): ?string
    {
        $upper = strtoupper($name);
        if (str_starts_with($upper, 'DJI') || str_contains($upper, 'DRONE')) {
            return 'drone';
        }
        $model = strtoupper((string) ($exif['camera_model'] ?? ''));
        if (str_contains($model, 'FC') || str_contains($model, 'MAVIC') || str_contains($model, 'PHANTOM')) {
            return 'drone';
        }
        return $exif['camera_model'] ? 'camera' : null;
    }
}
