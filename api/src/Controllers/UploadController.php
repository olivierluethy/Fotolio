<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\HttpException;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\SiteService;
use Fotolio\Services\UploadService;

final class UploadController extends Controller
{
    public function __construct(
        private UploadService $uploads,
        private SiteService $sites,
    ) {
    }

    private function context(Request $request): array
    {
        $user = $this->user($request);
        $siteId = (int) $this->sites->forUser($user->id)['id'];
        $quality = (int) $request->input('quality', 82);
        return [$user->id, $siteId, max(30, min(95, $quality))];
    }

    public function upload(Request $request): Response
    {
        [$userId, $siteId, $quality] = $this->context($request);
        $files = $this->uploads->normaliseFiles($request->files);
        if (!$files) {
            throw HttpException::unprocessable('No files were received. Choose at least one image.');
        }
        return Response::json($this->uploads->ingestMany($userId, $siteId, $files, $quality), 201);
    }

    public function fromUrl(Request $request): Response
    {
        [$userId, $siteId, $quality] = $this->context($request);
        $url = (string) $request->input('url', '');
        return Response::json($this->uploads->fromUrl($userId, $siteId, $url, $quality), 201);
    }

    public function fromZip(Request $request): Response
    {
        [$userId, $siteId, $quality] = $this->context($request);
        $zip = $request->files['zip'] ?? ($request->files['file'] ?? null);
        if (!$zip || ($zip['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw HttpException::unprocessable('No ZIP file was received.');
        }
        return Response::json($this->uploads->fromZip($userId, $siteId, $zip['tmp_name'], $quality), 201);
    }
}
