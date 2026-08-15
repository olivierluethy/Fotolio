<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\SiteService;

final class SiteController extends Controller
{
    public function __construct(private SiteService $sites)
    {
    }

    public function show(Request $request): Response
    {
        return Response::json(['site' => $this->sites->forUser($this->user($request)->id)]);
    }

    public function update(Request $request): Response
    {
        $validated = $this->validated($request, [
            'title' => 'nullable|string|max:160',
            'tagline' => 'nullable|string|max:240',
            'slug' => 'nullable|slug',
            'theme' => 'nullable|string|max:40',
            'accent' => 'nullable|string|max:20',
        ]);
        // Only forward fields the client actually sent (the validator fills
        // absent nullable fields with null, which we must not treat as edits).
        $body = $request->all();
        $data = [];
        foreach (['title', 'tagline', 'slug', 'theme', 'accent', 'home_header', 'settings'] as $k) {
            if (array_key_exists($k, $body)) {
                $data[$k] = $validated[$k] ?? $body[$k];
            }
        }
        return Response::json(['site' => $this->sites->update($this->user($request)->id, $data)]);
    }

    public function publish(Request $request): Response
    {
        $published = filter_var($request->input('published', true), FILTER_VALIDATE_BOOLEAN);
        $site = $this->sites->setPublished($this->user($request)->id, $published);
        return Response::json([
            'site' => $site,
            'message' => $published ? 'Site published.' : 'Site unpublished.',
        ]);
    }
}
