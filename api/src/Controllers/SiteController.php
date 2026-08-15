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
        $data = $this->validated($request, [
            'title' => 'nullable|string|max:160',
            'tagline' => 'nullable|string|max:240',
            'slug' => 'nullable|slug',
            'theme' => 'nullable|string|max:40',
            'accent' => 'nullable|string|max:20',
        ]);
        // Pass through JSON blobs untouched by the validator.
        foreach (['home_header', 'settings'] as $k) {
            if ($request->input($k) !== null) {
                $data[$k] = $request->input($k);
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
