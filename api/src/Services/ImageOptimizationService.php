<?php

namespace Fotolio\Services;

use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

/**
 * The core differentiator: turn any supported source image into responsive,
 * web-optimised variants (WebP + JPEG fallback) plus an LQIP placeholder, and
 * measure the before/after saving for the review UI.
 *
 * Backend: GD (default here). Imagick unlocks HEIC/HEIF + TIFF — see DEPLOYMENT.md.
 */
final class ImageOptimizationService
{
    /** width in px for each responsive variant */
    private const SIZES = ['thumb' => 400, 'medium' => 1200, 'large' => 2000];

    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver());
    }

    public static function supportedMimes(): array
    {
        // GD-decodable. TIFF/HEIC require the Imagick backend.
        return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    }

    public function isSupported(string $mime): bool
    {
        return in_array($mime, self::supportedMimes(), true);
    }

    /**
     * Generate all variants for a source file.
     *
     * @return array{variants:array,optimised_bytes:int,width:int,height:int}
     */
    public function generate(string $sourcePath, string $destDir, string $urlBase, int $quality = 82): array
    {
        @mkdir($destDir, 0775, true);
        $quality = max(30, min(95, $quality));

        $probe = $this->manager->read($sourcePath);
        $srcW = $probe->width();
        $srcH = $probe->height();

        $variants = ['sources' => []];
        $largeWebpBytes = 0;

        foreach (self::SIZES as $name => $targetW) {
            $img = $this->manager->read($sourcePath);
            $img->scaleDown(width: $targetW);
            $w = $img->width();
            $h = $img->height();

            $webpBytes = $this->write($img->toWebp($quality), "$destDir/$name.webp");
            $jpgBytes = $this->write($img->toJpeg($quality), "$destDir/$name.jpg");

            $variants[$name] = [
                'width' => $w,
                'height' => $h,
                'webp' => "$urlBase/$name.webp",
                'jpg' => "$urlBase/$name.jpg",
                'webp_bytes' => $webpBytes,
                'jpg_bytes' => $jpgBytes,
            ];
            if ($name === 'large') {
                $largeWebpBytes = $webpBytes;
            }
        }

        // LQIP: tiny blurred inline placeholder (data URI) for instant paint.
        $lqip = $this->manager->read($sourcePath);
        $lqip->scaleDown(width: 24);
        $lqip->blur(6);
        $variants['lqip'] = 'data:image/webp;base64,' . base64_encode((string) $lqip->toWebp(40));
        $variants['aspect'] = $srcH > 0 ? round($srcW / $srcH, 4) : 1.5;

        return [
            'variants' => $variants,
            'optimised_bytes' => $largeWebpBytes,
            'width' => $srcW,
            'height' => $srcH,
        ];
    }

    /**
     * Before/after metrics for the review UI.
     *
     * @return array{original_bytes:int,optimised_bytes:int,reduction_pct:float,
     *   original_human:string,optimised_human:string,load_original_s:float,
     *   load_optimised_s:float,saved_s:float,reference_mbps:float}
     */
    public function metrics(int $originalBytes, int $optimisedBytes): array
    {
        $mbps = (float) config('media.reference_mbps', 5);
        $reduction = $originalBytes > 0
            ? max(0, round((1 - $optimisedBytes / $originalBytes) * 100, 1))
            : 0.0;

        $loadOriginal = $this->loadSeconds($originalBytes, $mbps);
        $loadOptimised = $this->loadSeconds($optimisedBytes, $mbps);

        return [
            'original_bytes' => $originalBytes,
            'optimised_bytes' => $optimisedBytes,
            'reduction_pct' => $reduction,
            'original_human' => human_bytes($originalBytes),
            'optimised_human' => human_bytes($optimisedBytes),
            'load_original_s' => $loadOriginal,
            'load_optimised_s' => $loadOptimised,
            'saved_s' => round(max(0, $loadOriginal - $loadOptimised), 2),
            'reference_mbps' => $mbps,
        ];
    }

    private function loadSeconds(int $bytes, float $mbps): float
    {
        if ($mbps <= 0) {
            return 0.0;
        }
        return round(($bytes * 8) / ($mbps * 1_000_000), 2);
    }

    private function write(object $encoded, string $path): int
    {
        $encoded->save($path);
        return (int) filesize($path);
    }

    /** Remove all generated files for an image. */
    public function purge(string $destDir): void
    {
        if (!is_dir($destDir)) {
            return;
        }
        foreach (glob($destDir . '/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($destDir);
    }
}
