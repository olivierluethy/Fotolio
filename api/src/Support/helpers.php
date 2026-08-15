<?php

use Fotolio\Core\Config;

if (!function_exists('config')) {
    /** Read a dotted config value, e.g. config('jwt.secret'). */
    function config(string $key, mixed $default = null): mixed
    {
        return Config::get($key, $default);
    }
}

if (!function_exists('env')) {
    function env(string $key, mixed $default = null): mixed
    {
        $val = $_ENV[$key] ?? getenv($key);
        if ($val === false || $val === null) {
            return $default;
        }
        return match (strtolower((string) $val)) {
            'true' => true,
            'false' => false,
            'null' => null,
            default => $val,
        };
    }
}

if (!function_exists('base_path')) {
    function base_path(string $path = ''): string
    {
        $root = dirname(__DIR__, 2);
        return $path ? $root . '/' . ltrim($path, '/') : $root;
    }
}

if (!function_exists('storage_path')) {
    function storage_path(string $path = ''): string
    {
        return base_path('storage' . ($path ? '/' . ltrim($path, '/') : ''));
    }
}

if (!function_exists('str_slug')) {
    function str_slug(string $value, string $sep = '-'): string
    {
        $value = strtolower(trim($value));
        // transliterate common accents
        $value = strtr($value, [
            'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss',
            'à' => 'a', 'á' => 'a', 'â' => 'a', 'ã' => 'a',
            'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
            'ì' => 'i', 'í' => 'i', 'ò' => 'o', 'ó' => 'o',
            'ù' => 'u', 'ú' => 'u', 'ñ' => 'n', 'ç' => 'c',
        ]);
        $value = preg_replace('/[^a-z0-9]+/', $sep, $value) ?? '';
        return trim($value, $sep);
    }
}

if (!function_exists('human_bytes')) {
    function human_bytes(int $bytes, int $decimals = 1): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $pow = min((int) floor(log($bytes, 1024)), count($units) - 1);
        $val = $bytes / (1024 ** $pow);
        return round($val, $pow === 0 ? 0 : $decimals) . ' ' . $units[$pow];
    }
}
