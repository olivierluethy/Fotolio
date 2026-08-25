<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\ImageService;
use Fotolio\Services\SiteService;

final class ImageController extends Controller
{
    public function __construct(
        private ImageService $images,
        private SiteService $sites,
    ) {
    }

    private function siteId(Request $request): int
    {
        return (int) $this->sites->forUser($this->user($request)->id)['id'];
    }

    public function index(Request $request): Response
    {
        $filters = [
            'capture_method' => $request->query('capture_method'),
            'search' => $request->query('search'),
            'gallery_id' => $request->query('gallery_id'),
        ];
        return Response::json(['images' => $this->images->list($this->siteId($request), array_filter($filters))]);
    }

    public function show(Request $request, array $params): Response
    {
        return Response::json(['image' => $this->images->show($this->siteId($request), (int) $params['id'])]);
    }

    public function update(Request $request, array $params): Response
    {
        $data = $this->validated($request, [
            'title' => 'nullable|string|max:200',
            'location' => 'nullable|string|max:200',
            'description' => 'nullable|string|max:5000',
            'capture_method' => 'nullable|in:drone,camera,other',
        ]);
        foreach (['tags', 'camera_make', 'camera_model', 'lens', 'focal_length', 'aperture', 'shutter', 'iso', 'gps_lat', 'gps_lng'] as $k) {
            if ($request->input($k) !== null) {
                $data[$k] = $request->input($k);
            }
        }
        return Response::json(['image' => $this->images->update($this->siteId($request), (int) $params['id'], $data)]);
    }

    public function destroy(Request $request, array $params): Response
    {
        $this->images->delete($this->siteId($request), (int) $params['id']);
        return Response::json(['message' => 'Image deleted.']);
    }

    public function reoptimize(Request $request, array $params): Response
    {
        $quality = (int) $request->input('quality', 82);
        $image = $this->images->reoptimize($this->user($request)->id, (int) $params['id'], $quality);
        return Response::json(['image' => $image, 'message' => 'Re-optimised at quality ' . $image['quality'] . '.']);
    }

    /** Signature-gated stream of a private original for the before/after loupe. */
    public function original(Request $request, array $params): Response
    {
        $id = (int) $params['id'];
        $sig = (string) $request->query('sig', '');
        if (!\Fotolio\Services\ImageService::verifyOriginalSig($id, $sig)) {
            throw \Fotolio\Core\HttpException::forbidden('Invalid signature.');
        }
        $file = $this->images->originalFile($id);
        // Stream directly; this is the owner's own private original.
        header('Content-Type: ' . $file['mime']);
        header('Content-Length: ' . filesize($file['path']));
        header('Cache-Control: private, max-age=3600');
        readfile($file['path']);
        exit;
    }

    public function bulk(Request $request): Response
    {
        $ids = (array) $request->input('ids', []);
        $action = (string) $request->input('action', 'update');
        $payload = (array) $request->input('data', []);
        $count = $this->images->bulk($this->siteId($request), $ids, $action, $payload);
        return Response::json(['updated' => $count, 'message' => "$count image(s) updated."]);
    }
}
