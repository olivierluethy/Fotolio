<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\Response;

/**
 * Server-side renderer for portfolio sites. Photography-first, fast,
 * SEO-friendly. Renders a **state document** (published_state for the live
 * site, draft_state for the editor and preview) through plain PHP templates
 * themed from the Fotolio styleguide.
 *
 * Modes:
 *   live    — the public site (published_state), no edit affordances.
 *   edit    — the Site Editor iframe canvas (draft_state) with data-editable
 *             markers + the postMessage bridge.
 *   preview — a clean, chrome-free render of draft_state (no edit affordances).
 */
final class PublicRenderer
{
    public string $mode = 'live';
    public ?string $token = null;

    public function __construct(
        private SiteStateService $state,
        private ImageService $images,
    ) {
    }

    public function render(array $siteRow, string $path, string $mode = 'live', ?array $doc = null, ?string $token = null, ?string $fragment = null): Response
    {
        $this->mode = $mode;
        $this->token = $token;
        $siteId = (int) $siteRow['id'];

        if ($doc === null) {
            $doc = $mode === 'live' ? $this->state->getPublished($siteId) : $this->state->getDraft($siteId);
        }

        $model = $this->state->resolveForRender($siteId, $doc);
        $site = $model['site'];
        $galleries = $model['galleries'];
        $pages = array_values(array_filter($model['pages'], fn ($p) => $p['published']));

        $navGalleries = array_values(array_filter($galleries, fn ($g) => $g['show_in_nav']));
        $navPages = array_values(array_filter($pages, fn ($p) => $p['show_in_nav']));

        // Resolve the view from the in-site path.
        $view = 'home';
        $current = null;
        $images = [];
        $header = $site['home_header'];

        if ($path !== '') {
            $segments = explode('/', $path);
            $slug = $segments[0] === 'gallery' || $segments[0] === 'page'
                ? ($segments[1] ?? '')
                : $segments[0];

            $gallery = $this->matchGallery($galleries, $slug);
            $page = $this->matchPage($pages, $slug);

            if ($gallery) {
                $view = 'gallery';
                $current = $gallery;
                $images = $gallery['images'];
                $header = $gallery['header_config'] ?: $this->galleryHeader($gallery, $images);
            } elseif ($page) {
                $view = 'page';
                $current = $page;
                $header = $page['header_config'];
            } else {
                return $this->notFound();
            }
        }

        if ($view === 'home') {
            $homeGallery = $this->homeGallery($galleries);
            $images = $homeGallery ? $homeGallery['images'] : [];
        }

        $data = [
            'site' => $site,
            'galleries' => $galleries,
            'navGalleries' => $navGalleries,
            'navPages' => $navPages,
            'view' => $view,
            'current' => $current,
            'images' => $images,
            'header' => $header,
            'headerImages' => $this->resolveHeaderImages($header, $site),
            'mode' => $mode,
            'editable' => $mode === 'edit',
            'renderer' => $this,
        ];

        // Partial re-render for the bridge: swap one region without a full reload.
        if ($fragment !== null) {
            return Response::html($this->fragment($fragment, $data));
        }

        return Response::html($this->view('layout', $data));
    }

    /** Render a single region for a live partial re-render (edit mode). */
    private function fragment(string $name, array $data): string
    {
        $view = $data['view'];
        switch ($name) {
            case 'hero':
                return in_array($view, ['home', 'gallery'], true) && !empty($data['headerImages'])
                    ? $this->view('_hero', $data)
                    : '';
            case 'subnav':
                return $this->view('_subnav', $data);
            case 'main':
                return $view === 'page'
                    ? $this->view('page', $data)
                    : $this->view('gallery', $data);
            default:
                return '';
        }
    }

    public function notFound(): Response
    {
        return Response::html($this->view('not_found', ['mode' => $this->mode]), 404);
    }

    /** Include a template and capture its output. */
    public function view(string $name, array $data): string
    {
        extract($data, EXTR_SKIP);
        $r = $this; // available inside templates for partials/helpers
        $mode = $data['mode'] ?? $this->mode;
        ob_start();
        include dirname(__DIR__) . "/Views/public/$name.php";
        return (string) ob_get_clean();
    }

    /** Resolve header image records from a header config's image_ids. */
    public function resolveHeaderImages(?array $header, array $site): array
    {
        if (!$header) {
            return [];
        }
        $ids = $header['image_ids'] ?? [];
        if (!$ids) {
            return [];
        }
        $out = [];
        foreach ($ids as $id) {
            $row = Database::fetch('SELECT * FROM images WHERE id = :id AND site_id = :s', ['id' => (int) $id, 's' => $site['id']]);
            if ($row) {
                $out[] = $this->images->present($row);
            }
        }
        return $out;
    }

    public function galleryHeader(array $gallery, array $images): array
    {
        $header = SiteService::defaultHeader();
        $header['mode'] = 'single';
        $header['height'] = 'medium';
        $header['image_ids'] = $images ? [$images[0]['id']] : [];
        $header['overlay']['title'] = $gallery['name'];
        $header['overlay']['subtitle'] = $gallery['description'] ?? '';
        $header['animate_text'] = false;
        return $header;
    }

    private function matchGallery(array $galleries, string $slug): ?array
    {
        foreach ($galleries as $g) {
            if ($g['slug'] === $slug && !$g['is_home']) {
                return $g;
            }
        }
        return null;
    }

    private function matchPage(array $pages, string $slug): ?array
    {
        foreach ($pages as $p) {
            if ($p['slug'] === $slug) {
                return $p;
            }
        }
        return null;
    }

    private function homeGallery(array $galleries): ?array
    {
        foreach ($galleries as $g) {
            if ($g['is_home']) {
                return $g;
            }
        }
        return $galleries[0] ?? null;
    }

    // ---- template helpers --------------------------------------------------

    public function e(?string $v): string
    {
        return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
    }

    public function url(array $site, string $to = ''): string
    {
        $to = ltrim($to, '/');

        // In editor/preview the canvas navigates within the token-gated route
        // so the mode (and the draft it renders) is preserved across links.
        if ($this->mode === 'edit' || $this->mode === 'preview') {
            $base = $this->mode === 'edit' ? '/api/site/editor/render' : '/api/site/preview';
            $q = 'token=' . rawurlencode((string) $this->token);
            if ($to !== '') {
                $q .= '&path=' . rawurlencode($to);
            }
            return $base . '?' . $q;
        }

        // Live: build in-site links that work under /@slug, subdomain or custom domain.
        $isSlugMode = str_contains($_SERVER['REQUEST_URI'] ?? '', '/@');
        $prefix = $isSlugMode ? '/@' . $site['slug'] : '';
        return ($prefix ?: '') . ($to ? '/' . $to : ($prefix ? '' : '/'));
    }

    /** Build a <picture> element with WebP + JPEG srcset and LQIP background. */
    public function picture(array $image, string $sizes = '100vw', string $class = '', bool $lazy = true): string
    {
        $v = $image['variants'] ?? [];
        if (!$v) {
            return '';
        }
        $webp = [];
        $jpg = [];
        foreach (['thumb', 'medium', 'large'] as $name) {
            if (isset($v[$name])) {
                $webp[] = $v[$name]['webp'] . ' ' . $v[$name]['width'] . 'w';
                $jpg[] = $v[$name]['jpg'] . ' ' . $v[$name]['width'] . 'w';
            }
        }
        $lqip = $v['lqip'] ?? '';
        $alt = $this->e($image['title'] ?: ($image['location'] ?: 'Photograph'));
        $fallback = $v['medium']['jpg'] ?? ($v['large']['jpg'] ?? '');
        $loading = $lazy ? 'lazy' : 'eager';
        $aspect = $v['aspect'] ?? 1.5;

        return '<picture class="' . $this->e($class) . '">'
            . '<source type="image/webp" srcset="' . $this->e(implode(', ', $webp)) . '" sizes="' . $this->e($sizes) . '">'
            . '<img src="' . $this->e($fallback) . '" srcset="' . $this->e(implode(', ', $jpg)) . '" sizes="' . $this->e($sizes) . '"'
            . ' alt="' . $alt . '" loading="' . $loading . '" decoding="async"'
            . ' style="background-image:url(' . $this->e($lqip) . ');background-size:cover;aspect-ratio:' . $this->e((string) $aspect) . '">'
            . '</picture>';
    }
}
