<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Database;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Core\Token;
use Fotolio\Services\PublicRenderer;
use Fotolio\Services\SiteService;
use Fotolio\Services\SiteStateService;

/**
 * Backs the live Site Editor: draft reads/writes (autosave), publish, discard,
 * signed preview tokens, and the token-gated edit/preview HTML that the iframe
 * canvas renders. See docs/EDITOR.md.
 */
final class SiteEditorController extends Controller
{
    private const EDIT_TTL = 28800;     // 8h — comfortably spans an editing session
    private const PREVIEW_TTL = 86400;  // 24h shareable clean preview

    public function __construct(
        private SiteService $sites,
        private SiteStateService $state,
        private PublicRenderer $renderer,
    ) {
    }

    // ---- Authenticated editor API ----------------------------------------

    public function show(Request $request): Response
    {
        $site = $this->sites->forUser($this->user($request)->id);
        $siteId = (int) $site['id'];
        return Response::json([
            'draft' => $this->state->getDraft($siteId),
            'published' => $this->state->getPublished($siteId),
            'dirty' => $this->state->isDirty($siteId),
            'published_live' => (bool) $site['published'],
            'last_published_at' => $site['last_published_at'] ?? null,
            'public_url' => $site['public_url'],
            'edit_token' => Token::issueScoped('site-edit', $siteId, self::EDIT_TTL),
        ]);
    }

    public function saveDraft(Request $request): Response
    {
        $site = $this->sites->forUser($this->user($request)->id);
        $state = $request->input('state');
        if (!is_array($state)) {
            return Response::json(['message' => 'A draft state object is required.'], 422);
        }
        $draft = $this->state->saveDraft((int) $site['id'], $state);
        return Response::json(['draft' => $draft, 'dirty' => $this->state->isDirty((int) $site['id'])]);
    }

    public function publish(Request $request): Response
    {
        $site = $this->sites->forUser($this->user($request)->id);
        $this->state->publish((int) $site['id']);
        $fresh = $this->sites->forUser($this->user($request)->id);
        return Response::json([
            'dirty' => false,
            'published_live' => true,
            'last_published_at' => $fresh['last_published_at'] ?? null,
            'public_url' => $fresh['public_url'],
            'message' => 'Site published.',
        ]);
    }

    public function discard(Request $request): Response
    {
        $site = $this->sites->forUser($this->user($request)->id);
        $draft = $this->state->discard((int) $site['id']);
        return Response::json(['draft' => $draft, 'dirty' => false, 'message' => 'Unpublished changes discarded.']);
    }

    public function previewToken(Request $request): Response
    {
        $site = $this->sites->forUser($this->user($request)->id);
        $token = Token::issueScoped('site-preview', (int) $site['id'], self::PREVIEW_TTL);
        return Response::json([
            'token' => $token,
            'url' => '/api/site/preview?token=' . rawurlencode($token),
        ]);
    }

    // ---- Token-gated HTML (iframe canvas + preview) ----------------------

    public function render(Request $request): Response
    {
        return $this->renderScoped($request, 'site-edit', 'edit');
    }

    public function preview(Request $request): Response
    {
        return $this->renderScoped($request, 'site-preview', 'preview');
    }

    private function renderScoped(Request $request, string $type, string $mode): Response
    {
        $token = (string) $request->query('token', '');
        $siteId = $this->verifyToken($token, $type);
        if (!$siteId) {
            return Response::html($this->tokenError(), 401);
        }
        $siteRow = Database::fetch('SELECT * FROM sites WHERE id = :id', ['id' => $siteId]);
        if (!$siteRow) {
            return $this->renderer->notFound();
        }
        $path = trim((string) $request->query('path', ''), '/');
        $fragment = $mode === 'edit' ? ($request->query('fragment') ?: null) : null;
        return $this->renderer->render($siteRow, $path, $mode, null, $token, $fragment);
    }

    private function verifyToken(string $token, string $type): ?int
    {
        if ($token === '') {
            return null;
        }
        try {
            $claims = Token::decode($token);
        } catch (\Throwable) {
            return null;
        }
        if (($claims['type'] ?? '') !== $type) {
            return null;
        }
        return isset($claims['sub']) ? (int) $claims['sub'] : null;
    }

    private function tokenError(): string
    {
        return '<!doctype html><meta charset="utf-8"><title>Preview link expired</title>'
            . '<body style="font-family:system-ui;background:#0E0F12;color:#F2F3F4;display:grid;place-items:center;height:100vh;margin:0">'
            . '<div style="text-align:center;max-width:32ch"><h1 style="color:#22B8C4;font-size:20px">This preview link has expired</h1>'
            . '<p style="color:#A0A6B0">Open the editor and start a fresh preview.</p></div>';
    }
}
