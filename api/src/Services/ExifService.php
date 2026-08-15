<?php

namespace Fotolio\Services;

/**
 * Extracts useful EXIF to prefill image metadata: camera, lens, exposure,
 * capture date, and GPS (converted to decimal → suggested location).
 */
final class ExifService
{
    public function extract(string $path, string $mime): array
    {
        $out = [
            'camera_make' => null, 'camera_model' => null, 'lens' => null,
            'focal_length' => null, 'aperture' => null, 'shutter' => null,
            'iso' => null, 'captured_at' => null, 'gps_lat' => null, 'gps_lng' => null,
        ];

        if (!function_exists('exif_read_data') || !in_array($mime, ['image/jpeg', 'image/tiff'], true)) {
            return $out;
        }

        $exif = @exif_read_data($path, null, true);
        if (!$exif) {
            return $out;
        }

        $ifd0 = $exif['IFD0'] ?? [];
        $sub = $exif['EXIF'] ?? [];

        $out['camera_make'] = $this->clean($ifd0['Make'] ?? null);
        $out['camera_model'] = $this->clean($ifd0['Model'] ?? null);
        $out['lens'] = $this->clean($sub['UndefinedTag:0xA434'] ?? ($sub['LensModel'] ?? null));

        if (!empty($sub['FocalLength'])) {
            $out['focal_length'] = round($this->frac($sub['FocalLength'])) . ' mm';
        }
        if (!empty($sub['FNumber'])) {
            $out['aperture'] = 'f/' . rtrim(rtrim(number_format($this->frac($sub['FNumber']), 1), '0'), '.');
        }
        if (!empty($sub['ExposureTime'])) {
            $out['shutter'] = $this->shutter($sub['ExposureTime']) . ' s';
        }
        if (!empty($sub['ISOSpeedRatings'])) {
            $iso = is_array($sub['ISOSpeedRatings']) ? reset($sub['ISOSpeedRatings']) : $sub['ISOSpeedRatings'];
            $out['iso'] = 'ISO ' . $iso;
        }

        $dt = $sub['DateTimeOriginal'] ?? ($ifd0['DateTime'] ?? null);
        if ($dt && ($ts = strtotime(str_replace(':', '-', substr($dt, 0, 10)) . substr($dt, 10)))) {
            $out['captured_at'] = gmdate('Y-m-d H:i:s', $ts);
        }

        if (!empty($exif['GPS'])) {
            $lat = $this->gps($exif['GPS'], 'GPSLatitude', 'GPSLatitudeRef', 'S');
            $lng = $this->gps($exif['GPS'], 'GPSLongitude', 'GPSLongitudeRef', 'W');
            if ($lat !== null && $lng !== null) {
                $out['gps_lat'] = round($lat, 6);
                $out['gps_lng'] = round($lng, 6);
            }
        }

        return $out;
    }

    private function clean(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $v = trim(preg_replace('/[^\P{C}]+/u', '', $v) ?? '');
        return $v === '' ? null : $v;
    }

    private function frac(string $v): float
    {
        if (str_contains($v, '/')) {
            [$n, $d] = array_pad(explode('/', $v), 2, 1);
            return (float) $d === 0.0 ? 0 : (float) $n / (float) $d;
        }
        return (float) $v;
    }

    private function shutter(string $v): string
    {
        $f = $this->frac($v);
        if ($f <= 0) {
            return '0';
        }
        if ($f >= 1) {
            return rtrim(rtrim(number_format($f, 1), '0'), '.');
        }
        return '1/' . round(1 / $f);
    }

    private function gps(array $gps, string $key, string $refKey, string $negRef): ?float
    {
        if (empty($gps[$key]) || !is_array($gps[$key])) {
            return null;
        }
        $d = $this->frac($gps[$key][0] ?? '0');
        $m = $this->frac($gps[$key][1] ?? '0');
        $s = $this->frac($gps[$key][2] ?? '0');
        $dec = $d + $m / 60 + $s / 3600;
        if (($gps[$refKey] ?? '') === $negRef) {
            $dec = -$dec;
        }
        return $dec;
    }
}
