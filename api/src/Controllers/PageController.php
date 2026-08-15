<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\PageService;
use Fotolio\Services\SiteService;

final class PageController extends Controller
{
    public function __construct(
        private PageService $pages,
        private SiteService $sites,
    ) {
    }

    private function siteId(Request $request): int
    {
        return (int) $this->sites->forUser($this->user($request)->id)['id'];
    }

    public function index(Request $request): Response
    {
        return Response::json(['pages' => $this->pages->list($this->siteId($request))]);
    }

    public function store(Request $request): Response
    {
        $data = $this->validated($request, [
            'title' => 'nullable|string|max:160',
            'type' => 'nullable|in:about,custom',
        ]);
        if ($request->input('content') !== null) {
            $data['content'] = $request->input('content');
        }
        if ($request->input('header_config') !== null) {
            $data['header_config'] = $request->input('header_config');
        }
        return Response::json(['page' => $this->pages->create($this->siteId($request), $data)], 201);
    }

    public function update(Request $request, array $params): Response
    {
        return Response::json(['page' => $this->pages->update($this->siteId($request), (int) $params['id'], $request->all())]);
    }

    public function destroy(Request $request, array $params): Response
    {
        $this->pages->delete($this->siteId($request), (int) $params['id']);
        return Response::json(['message' => 'Page deleted.']);
    }

    public function reorder(Request $request): Response
    {
        $order = (array) $request->input('order', []);
        return Response::json(['pages' => $this->pages->reorder($this->siteId($request), $order)]);
    }
}
