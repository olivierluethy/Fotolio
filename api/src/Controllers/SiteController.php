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

    /** All the user's sites, with the active one flagged. */
    public function index(Request $request): Response
    {
        return Response::json(['sites' => $this->sites->listForUser($this->user($request)->id)]);
    }

    /** Create an additional site and make it active. */
    public function store(Request $request): Response
    {
        $data = $this->validated($request, ['title' => 'required|string|min:1|max:160']);
        $site = $this->sites->createSite($this->user($request)->id, $data['title']);
        return Response::json(['site' => $site], 201);
    }

    /** Switch the active site. */
    public function activate(Request $request, array $params): Response
    {
        $site = $this->sites->activate($this->user($request)->id, (int) $params['id']);
        return Response::json(['site' => $site]);
    }

    public function destroy(Request $request, array $params): Response
    {
        $this->sites->deleteSite($this->user($request)->id, (int) $params['id']);
        return Response::json(['message' => 'Site deleted.']);
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
