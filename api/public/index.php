<?php

use Fotolio\Controllers\PublicController;
use Fotolio\Core\Kernel;
use Fotolio\Core\Request;
use Fotolio\Core\Response;

// Serve existing static files directly when running under the PHP dev server.
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (is_file($file) && basename($file) !== 'index.php') {
        return false;
    }
}

require __DIR__ . '/../bootstrap.php';

$request = Request::capture();
$kernel = new Kernel();

// ---- API --------------------------------------------------------------------
if (str_starts_with($request->path, '/api')) {
    $kernel->handle($request)->send();
    exit;
}

// ---- Public sites + platform root ------------------------------------------
$platformHosts = config('app.platform_hosts', []);
$isPlatformHost = in_array($request->host, $platformHosts, true)
    || in_array($request->hostname(), $platformHosts, true);

/** @var PublicController $public */
$public = $kernel->container()->make(PublicController::class);

// Custom domain or subdomain → resolve the site by Host.
if (!$isPlatformHost) {
    $public->renderByHost($request)->send();
    exit;
}

// Platform host: /@slug → public site; everything else → SPA / landing.
if (preg_match('#^/@([a-z0-9-]+)#', $request->path, $m)) {
    $public->renderBySlug($request, $m[1])->send();
    exit;
}

// Platform root: serve the built dashboard SPA if present, else point to dev.
$spaIndex = __DIR__ . '/app/index.html';
if (is_file($spaIndex)) {
    Response::html(file_get_contents($spaIndex))->send();
    exit;
}

Response::html(
    '<!doctype html><meta charset="utf-8"><title>Fotolio API</title>'
    . '<body style="font-family:system-ui;background:#0E0F12;color:#F2F3F4;display:grid;place-items:center;height:100vh;margin:0">'
    . '<div style="text-align:center"><h1 style="color:#22B8C4">Fotolio API</h1>'
    . '<p>The API is running. The dashboard runs separately in dev at '
    . '<a style="color:#22B8C4" href="' . htmlspecialchars(config('app.dashboard_url')) . '">'
    . htmlspecialchars(config('app.dashboard_url')) . '</a>.</p></div>'
)->send();
