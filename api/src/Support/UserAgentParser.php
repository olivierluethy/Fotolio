<?php

namespace Fotolio\Support;

/**
 * Lightweight, dependency-free user-agent classifier — enough to bucket
 * visitors by device, browser and OS for the analytics Overview. Not a full
 * UA database; unknowns fall back to sensible defaults.
 */
final class UserAgentParser
{
    /** @return array{device:string,browser:string,os:string} */
    public static function parse(?string $ua): array
    {
        $ua = trim((string) $ua);
        if ($ua === '') {
            return ['device' => 'unknown', 'browser' => 'Unknown', 'os' => 'Unknown'];
        }

        return [
            'device' => self::device($ua),
            'browser' => self::browser($ua),
            'os' => self::os($ua),
        ];
    }

    private static function device(string $ua): string
    {
        if (preg_match('/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless/i', $ua)) {
            return 'bot';
        }
        if (preg_match('/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i', $ua)) {
            return 'tablet';
        }
        if (preg_match('/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile/i', $ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    private static function browser(string $ua): string
    {
        return match (true) {
            (bool) preg_match('/Edg(e|A|iOS)?\//i', $ua) => 'Edge',
            (bool) preg_match('/OPR\/|Opera/i', $ua) => 'Opera',
            (bool) preg_match('/SamsungBrowser/i', $ua) => 'Samsung Internet',
            (bool) preg_match('/Firefox\/|FxiOS/i', $ua) => 'Firefox',
            (bool) preg_match('/CriOS/i', $ua) => 'Chrome',
            (bool) preg_match('/Chrome\//i', $ua) => 'Chrome',
            (bool) preg_match('/Version\/.*Safari/i', $ua) => 'Safari',
            (bool) preg_match('/Safari/i', $ua) => 'Safari',
            default => 'Other',
        };
    }

    private static function os(string $ua): string
    {
        return match (true) {
            (bool) preg_match('/Windows NT 10/i', $ua) => 'Windows',
            (bool) preg_match('/Windows/i', $ua) => 'Windows',
            (bool) preg_match('/iPhone|iPad|iPod/i', $ua) => 'iOS',
            (bool) preg_match('/Mac OS X|Macintosh/i', $ua) => 'macOS',
            (bool) preg_match('/Android/i', $ua) => 'Android',
            (bool) preg_match('/CrOS/i', $ua) => 'ChromeOS',
            (bool) preg_match('/Linux/i', $ua) => 'Linux',
            default => 'Other',
        };
    }
}
