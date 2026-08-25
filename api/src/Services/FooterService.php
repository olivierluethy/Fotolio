<?php

namespace Fotolio\Services;

/**
 * The customizable site footer model.
 *
 * The footer is a free, block-based region: a grid of 1–4 columns, each holding
 * an ordered list of blocks (heading, text, links, social, image, divider,
 * spacer), plus a style bag and a "Made with Fotolio" credit toggle. It lives in
 * `settings.footer` in the draft/published state document, so footer edits flow
 * through draft → preview → publish like every other change.
 *
 * `resolve()` is the single seam that turns whatever is stored into a normalized,
 * render-ready footer. It transparently migrates the **legacy** footer (a plain
 * `settings.footer` note string + `settings.social` map + the site name) into the
 * block model, so nothing is lost and sites that never opened the footer editor
 * still render correctly. The dashboard materialises the same default shape
 * (draftUtils.ensureFooter) so both edit the one source of truth.
 */
final class FooterService
{
    /** Networks the social block understands: key => [label, href-builder]. */
    private const NETWORKS = [
        'instagram' => 'Instagram',
        'email' => 'Email',
        'twitter' => 'Twitter',
        'facebook' => 'Facebook',
        'youtube' => 'YouTube',
        'tiktok' => 'TikTok',
        'linkedin' => 'LinkedIn',
        'pinterest' => 'Pinterest',
        'behance' => 'Behance',
        'website' => 'Website',
        'phone' => 'Phone',
    ];

    /** Turn stored settings into a normalized footer, migrating legacy data. */
    public static function resolve(array $settings): array
    {
        $raw = $settings['footer'] ?? null;
        if (is_array($raw) && isset($raw['columns'])) {
            return self::normalize($raw);
        }
        $note = is_string($raw) ? $raw : '';
        $social = (isset($settings['social']) && is_array($settings['social'])) ? $settings['social'] : [];
        return self::normalize(self::defaultFooter($note, $social));
    }

    /** The default footer seeded from the legacy note + social + site name. */
    public static function defaultFooter(string $note, array $social): array
    {
        return [
            'columns' => [
                ['blocks' => [
                    ['type' => 'heading', 'role' => 'sitename', 'text' => ''],
                    ['type' => 'text', 'role' => 'note', 'text' => $note],
                ]],
                ['blocks' => [
                    ['type' => 'social', 'items' => self::cleanSocial($social)],
                ]],
            ],
            'style' => self::defaultStyle(),
            'show_credit' => true,
        ];
    }

    public static function defaultStyle(): array
    {
        return [
            'bg' => '',
            'color' => '',
            'link_color' => '',
            'align' => 'left',
            'font_family' => 'ui',
            'font_size' => 14,
            'font_weight' => 400,
            'padding_y' => 40,
            'border_top_width' => 1,
            'border_top_color' => '',
        ];
    }

    public static function normalize(array $f): array
    {
        $cols = [];
        foreach (($f['columns'] ?? []) as $c) {
            $blocks = [];
            foreach (($c['blocks'] ?? []) as $b) {
                $nb = self::normBlock(is_array($b) ? $b : []);
                if ($nb) {
                    $blocks[] = $nb;
                }
            }
            $cols[] = ['blocks' => $blocks];
        }
        if (!$cols) {
            $cols = [['blocks' => []]];
        }
        $cols = array_slice($cols, 0, 4);

        $style = array_merge(self::defaultStyle(), is_array($f['style'] ?? null) ? $f['style'] : []);
        $style['align'] = in_array($style['align'] ?? 'left', ['left', 'center', 'right'], true) ? $style['align'] : 'left';
        $style['font_family'] = in_array($style['font_family'] ?? 'ui', ['ui', 'display', 'mono'], true) ? $style['font_family'] : 'ui';

        return [
            'columns' => $cols,
            'style' => $style,
            'show_credit' => (bool) ($f['show_credit'] ?? true),
        ];
    }

    private static function normBlock(array $b): ?array
    {
        $type = $b['type'] ?? 'text';
        switch ($type) {
            case 'heading':
            case 'text':
                return ['type' => $type, 'role' => $b['role'] ?? null, 'text' => (string) ($b['text'] ?? '')];
            case 'links':
                $items = [];
                foreach (($b['items'] ?? []) as $it) {
                    $items[] = ['label' => (string) ($it['label'] ?? ''), 'href' => (string) ($it['href'] ?? '')];
                }
                return ['type' => 'links', 'inline' => (bool) ($b['inline'] ?? false), 'items' => $items];
            case 'social':
                return ['type' => 'social', 'items' => self::cleanSocial($b['items'] ?? [])];
            case 'image':
                return [
                    'type' => 'image',
                    'src' => (string) ($b['src'] ?? ''),
                    'alt' => (string) ($b['alt'] ?? ''),
                    'width' => max(24, min(600, (int) ($b['width'] ?? 120))),
                    'href' => (string) ($b['href'] ?? ''),
                ];
            case 'divider':
                return ['type' => 'divider'];
            case 'spacer':
                return ['type' => 'spacer', 'size' => max(4, min(120, (int) ($b['size'] ?? 16)))];
            default:
                return null;
        }
    }

    /** @return array<string,string> ordered network => value, blanks dropped. */
    public static function cleanSocial(mixed $items): array
    {
        if (!is_array($items)) {
            return [];
        }
        $out = [];
        foreach ($items as $k => $v) {
            if (!is_string($k) || !is_scalar($v)) {
                continue;
            }
            $v = trim((string) $v);
            if ($v !== '') {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    /** Human label for a social network key. */
    public static function networkLabel(string $key): string
    {
        return self::NETWORKS[$key] ?? ucfirst($key);
    }

    /** Resolve a social value to a real href (mailto/tel where sensible). */
    public static function socialHref(string $key, string $value): string
    {
        if ($key === 'email' || (str_contains($value, '@') && !str_contains($value, '/'))) {
            return 'mailto:' . $value;
        }
        if ($key === 'phone') {
            return 'tel:' . preg_replace('/[^0-9+]/', '', $value);
        }
        if (preg_match('#^https?://#i', $value) || str_starts_with($value, '/')) {
            return $value;
        }
        return 'https://' . ltrim($value, '/');
    }
}
