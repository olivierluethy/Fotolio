<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\Response;

/**
 * Server-side renderer for published portfolio sites. Photography-first, fast,
 * SEO-friendly. Uses plain PHP templates in src/Views/public themed from the
 * Fotolio styleguide tokens.
 */
final class PublicRenderer
{
    public function __construct(
        private SiteService $sites,
        private GalleryService $galleries,
        private PageService $pages,
        private ImageService $images,
    ) {
    }

    public function render(array $siteRow, string $path): Response
    {
        $site = $this->sites->find((int) $siteRow['id']);
        $galleries = $this->galleries->list((int) $site['id']);
        $pages = array_values(array_filter(
            $this->pages->list((int) $site['id']),
            fn ($p) => $p['published']
        ));

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
                $images = $this->galleries->imagesFor((int) $gallery['id']);
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
            $images = $homeGallery ? $this->galleries->imagesFor((int) $homeGallery['id']) : [];
        }

        $model = [
            'site' => $site,
            'galleries' => $galleries,
            'navGalleries' => $navGalleries,
            'navPages' => $navPages,
            'view' => $view,
            'current' => $current,
            'images' => $images,
            'header' => $header,
            'headerImages' => $this->resolveHeaderImages($header, $site),
            'renderer' => $this,
        ];

        return Response::html($this->view('layout', $model));
    }

    public function notFound(): Response
    {
        return Response::html($this->view('not_found', []), 404);
    }

    /** Include a template and capture its output. */
    public function view(string $name, array $data): string
    {
        extract($data, EXTR_SKIP);
        $r = $this; // available inside templates for partials/helpers
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
        // Build in-site links that work under /@slug, subdomain or custom domain.
        $isSlugMode = str_contains($_SERVER['REQUEST_URI'] ?? '', '/@');
        $prefix = $isSlugMode ? '/@' . $site['slug'] : '';
        $to = ltrim($to, '/');
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
