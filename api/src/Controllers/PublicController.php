<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Database;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\PublicRenderer;

/**
 * Resolves a published site by Host (custom domain / subdomain) or by /@slug,
 * then hands off to the server-side PHP theme renderer.
 */
final class PublicController
{
    public function __construct(private PublicRenderer $renderer)
    {
    }

    public function renderByHost(Request $request): Response
    {
        $host = $request->hostname();
        $base = (string) config('app.base_domain');

        $site = Database::fetch(
            'SELECT * FROM sites WHERE custom_domain = :h AND domain_verified = 1 AND published = 1',
            ['h' => $host]
        );

        if (!$site && str_ends_with($host, '.' . $base)) {
            $sub = substr($host, 0, -strlen('.' . $base));
            $site = Database::fetch(
                'SELECT * FROM sites WHERE subdomain = :s AND subdomain_enabled = 1 AND published = 1',
                ['s' => $sub]
            );
        }

        if (!$site) {
            return $this->renderer->notFound();
        }
        return $this->renderer->render($site, $this->pagePath($request, ''));
    }

    public function renderBySlug(Request $request, string $slug): Response
    {
        $site = Database::fetch('SELECT * FROM sites WHERE slug = :s AND published = 1', ['s' => $slug]);
        if (!$site) {
            return $this->renderer->notFound();
        }
        $rest = preg_replace('#^/@' . preg_quote($slug, '#') . '#', '', $request->path) ?: '';
        return $this->renderer->render($site, trim($rest, '/'));
    }

    private function pagePath(Request $request, string $prefix): string
    {
        return trim($request->path, '/');
    }
}
