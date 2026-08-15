<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\GalleryService;
use Fotolio\Services\SiteService;

final class GalleryController extends Controller
{
    public function __construct(
        private GalleryService $galleries,
        private SiteService $sites,
    ) {
    }

    private function siteId(Request $request): int
    {
        return (int) $this->sites->forUser($this->user($request)->id)['id'];
    }

    public function index(Request $request): Response
    {
        $withImages = filter_var($request->query('with_images', false), FILTER_VALIDATE_BOOLEAN);
        return Response::json(['galleries' => $this->galleries->list($this->siteId($request), $withImages)]);
    }

    public function store(Request $request): Response
    {
        $data = $this->validated($request, [
            'name' => 'required|string|min:1|max:120',
            'description' => 'nullable|string|max:2000',
        ]);
        return Response::json(['gallery' => $this->galleries->create($this->siteId($request), $data)], 201);
    }

    public function update(Request $request, array $params): Response
    {
        $data = $request->all();
        $gallery = $this->galleries->update($this->siteId($request), (int) $params['id'], $data);
        return Response::json(['gallery' => $gallery]);
    }

    public function destroy(Request $request, array $params): Response
    {
        $this->galleries->delete($this->siteId($request), (int) $params['id']);
        return Response::json(['message' => 'Gallery deleted.']);
    }

    public function reorder(Request $request): Response
    {
        $order = (array) $request->input('order', []);
        return Response::json(['galleries' => $this->galleries->reorder($this->siteId($request), $order)]);
    }

    public function assignImages(Request $request, array $params): Response
    {
        $ids = (array) $request->input('image_ids', []);
        $gallery = $this->galleries->assignImages($this->siteId($request), (int) $params['id'], $ids);
        return Response::json(['gallery' => $gallery, 'message' => 'Images added to gallery.']);
    }

    public function removeImage(Request $request, array $params): Response
    {
        $gallery = $this->galleries->removeImage($this->siteId($request), (int) $params['id'], (int) $params['imageId']);
        return Response::json(['gallery' => $gallery]);
    }

    public function reorderImages(Request $request, array $params): Response
    {
        $ids = (array) $request->input('image_ids', []);
        $gallery = $this->galleries->reorderImages($this->siteId($request), (int) $params['id'], $ids);
        return Response::json(['gallery' => $gallery]);
    }
}
