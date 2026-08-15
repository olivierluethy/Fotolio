<?php

namespace Fotolio\Services;

use Fotolio\Core\HttpException;

/**
 * Every ingestion route — drag & drop, file picker, whole-folder
 * (webkitdirectory), URL import and ZIP — funnels through the same
 * optimisation pipeline (ImageService::ingest) and returns per-file results
 * for the before/after review UI.
 */
final class UploadService
{
    public function __construct(private ImageService $images)
    {
    }

    /** @param array $files normalised list of ['tmp' => path, 'name' => filename] */
    public function ingestMany(int $userId, int $siteId, array $files, int $quality): array
    {
        $results = [];
        $failed = [];
        foreach ($files as $file) {
            try {
                $results[] = $this->images->ingest($userId, $siteId, $file['tmp'], $file['name'], $quality);
            } catch (HttpException $e) {
                $failed[] = ['filename' => $file['name'], 'message' => $e->getMessage()];
            } catch (\Throwable $e) {
                $failed[] = ['filename' => $file['name'], 'message' => 'Could not process this file.'];
            }
        }
        return [
            'accepted' => $results,
            'failed' => $failed,
            'summary' => $this->summarise($results),
        ];
    }

    /** Normalise PHP's awkward $_FILES structure into a flat list. */
    public function normaliseFiles(array $files): array
    {
        $flat = [];
        foreach ($files as $field) {
            if (is_array($field['name'])) {
                foreach ($field['name'] as $i => $name) {
                    if (($field['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                        continue;
                    }
                    $flat[] = ['tmp' => $field['tmp_name'][$i], 'name' => basename($name)];
                }
            } elseif (($field['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
                $flat[] = ['tmp' => $field['tmp_name'], 'name' => basename($field['name'])];
            }
        }
        return $flat;
    }

    public function fromUrl(int $userId, int $siteId, string $url, int $quality): array
    {
        if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
            throw HttpException::unprocessable('Enter a valid image URL starting with http:// or https://.');
        }
        $tmp = tempnam(sys_get_temp_dir(), 'fotolio_url_');
        $ctx = stream_context_create(['http' => ['timeout' => 20, 'follow_location' => 1, 'user_agent' => 'FotolioBot/1.0']]);
        $data = @file_get_contents($url, false, $ctx);
        if ($data === false || strlen($data) === 0) {
            @unlink($tmp);
            throw HttpException::unprocessable('Could not download that image. Check the URL and try again.');
        }
        file_put_contents($tmp, $data);
        $name = basename(parse_url($url, PHP_URL_PATH) ?: 'image');
        $name = $name !== '' ? $name : 'imported-image';

        $out = $this->ingestMany($userId, $siteId, [['tmp' => $tmp, 'name' => $name]], $quality);
        @unlink($tmp);
        return $out;
    }

    public function fromZip(int $userId, int $siteId, string $zipPath, int $quality): array
    {
        if (!class_exists(\ZipArchive::class)) {
            throw HttpException::unprocessable('ZIP support is not available on this server.');
        }
        $zip = new \ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw HttpException::unprocessable('That file could not be opened as a ZIP archive.');
        }
        $extractDir = storage_path('tmp/zip_' . bin2hex(random_bytes(6)));
        @mkdir($extractDir, 0775, true);
        $files = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entry = $zip->getNameIndex($i);
            if ($entry === false || str_ends_with($entry, '/') || str_starts_with(basename($entry), '.')) {
                continue;
            }
            $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'], true)) {
                continue;
            }
            $dest = $extractDir . '/' . bin2hex(random_bytes(4)) . '_' . basename($entry);
            $stream = $zip->getStream($entry);
            if ($stream) {
                file_put_contents($dest, stream_get_contents($stream));
                fclose($stream);
                $files[] = ['tmp' => $dest, 'name' => basename($entry)];
            }
        }
        $zip->close();

        if (!$files) {
            $this->cleanup($extractDir);
            throw HttpException::unprocessable('No supported images were found in that ZIP.');
        }
        $out = $this->ingestMany($userId, $siteId, $files, $quality);
        $this->cleanup($extractDir);
        return $out;
    }

    private function summarise(array $results): array
    {
        $originalTotal = 0;
        $optimisedTotal = 0;
        foreach ($results as $r) {
            $originalTotal += $r['metrics']['original_bytes'];
            $optimisedTotal += $r['metrics']['optimised_bytes'];
        }
        $reduction = $originalTotal > 0 ? round((1 - $optimisedTotal / $originalTotal) * 100, 1) : 0;
        return [
            'count' => count($results),
            'original_bytes' => $originalTotal,
            'optimised_bytes' => $optimisedTotal,
            'original_human' => human_bytes($originalTotal),
            'optimised_human' => human_bytes($optimisedTotal),
            'reduction_pct' => $reduction,
        ];
    }

    private function cleanup(string $dir): void
    {
        foreach (glob($dir . '/*') ?: [] as $f) {
            @unlink($f);
        }
        @rmdir($dir);
    }
}
