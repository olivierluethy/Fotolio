<?php

namespace Fotolio\Core;

use Fotolio\Controllers\AuthController;
use Fotolio\Controllers\DomainController;
use Fotolio\Controllers\GalleryController;
use Fotolio\Controllers\ImageController;
use Fotolio\Controllers\OAuthController;
use Fotolio\Controllers\PageController;
use Fotolio\Controllers\SiteController;
use Fotolio\Controllers\SiteEditorController;
use Fotolio\Controllers\UploadController;
use Fotolio\Middleware\AuthMiddleware;

/**
 * Wires the container + router and turns a Request into a Response for API
 * calls. Host/path resolution for public sites happens in the front controller.
 */
final class Kernel
{
    private Container $container;
    private Router $router;

    public function __construct()
    {
        $this->container = new Container();
        $this->container->instance(Container::class, $this->container);
        $this->router = new Router($this->container);
        $this->registerRoutes();
    }

    public function container(): Container
    {
        return $this->container;
    }

    public function handle(Request $request): Response
    {
        try {
            if ($request->method === 'OPTIONS') {
                return $this->cors(Response::noContent(204), $request);
            }
            return $this->cors($this->router->dispatch($request), $request);
        } catch (HttpException $e) {
            return $this->cors(Response::json([
                'message' => $e->getMessage(),
                'errors' => $e->errors,
            ], $e->status), $request);
        } catch (\Throwable $e) {
            $payload = ['message' => 'Something went wrong on our side.'];
            if (config('app.debug')) {
                $payload['debug'] = $e->getMessage();
                $payload['trace'] = explode("\n", $e->getTraceAsString());
            }
            return $this->cors(Response::json($payload, 500), $request);
        }
    }

    private function cors(Response $response, Request $request): Response
    {
        $origin = $request->header('Origin');
        $allowed = [config('app.dashboard_url'), config('app.url')];
        if ($origin && (in_array($origin, $allowed, true) || config('app.env') === 'local')) {
            $response->withHeader('Access-Control-Allow-Origin', $origin)
                ->withHeader('Vary', 'Origin')
                ->withHeader('Access-Control-Allow-Credentials', 'true')
                ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->withHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With')
                ->withHeader('Access-Control-Max-Age', '86400');
        }
        return $response;
    }

    private function registerRoutes(): void
    {
        $r = $this->router;
        $auth = [AuthMiddleware::class];

        // ---- Auth ---------------------------------------------------------
        $r->post('/api/auth/register', [AuthController::class, 'register']);
        $r->post('/api/auth/login', [AuthController::class, 'login']);
        $r->post('/api/auth/refresh', [AuthController::class, 'refresh']);
        $r->post('/api/auth/logout', [AuthController::class, 'logout']);
        $r->get('/api/auth/me', [AuthController::class, 'me'], $auth);
        $r->get('/api/auth/oauth/{provider}', [OAuthController::class, 'redirect']);
        $r->post('/api/auth/oauth/{provider}', [OAuthController::class, 'callback']);

        // ---- Health -------------------------------------------------------
        $r->get('/api/health', fn () => Response::json(['status' => 'ok', 'app' => config('app.name')]));

        // Signature-gated original stream (image tag src can't send bearer headers).
        $r->get('/api/images/{id}/original', [ImageController::class, 'original']);

        // Token-gated Site Editor canvas + Preview (the iframe loads these
        // without an auth header — the signed token is the credential).
        $r->get('/api/site/editor/render', [SiteEditorController::class, 'render']);
        $r->get('/api/site/preview', [SiteEditorController::class, 'preview']);

        $r->group($auth, function (Router $r) {
            // ---- Site + publishing ---------------------------------------
            $r->get('/api/site', [SiteController::class, 'show']);
            $r->patch('/api/site', [SiteController::class, 'update']);
            $r->post('/api/site/publish', [SiteController::class, 'publish']);

            // ---- Live Site Editor: draft / publish / discard / preview ----
            $r->get('/api/site/editor', [SiteEditorController::class, 'show']);
            $r->patch('/api/site/editor/draft', [SiteEditorController::class, 'saveDraft']);
            $r->post('/api/site/editor/publish', [SiteEditorController::class, 'publish']);
            $r->post('/api/site/editor/discard', [SiteEditorController::class, 'discard']);
            $r->post('/api/site/editor/preview-token', [SiteEditorController::class, 'previewToken']);
            $r->put('/api/site/subdomain', [DomainController::class, 'setSubdomain']);
            $r->put('/api/site/domain', [DomainController::class, 'setDomain']);
            $r->post('/api/site/domain/verify', [DomainController::class, 'verify']);
            $r->delete('/api/site/domain', [DomainController::class, 'removeDomain']);

            // ---- Galleries -----------------------------------------------
            $r->get('/api/galleries', [GalleryController::class, 'index']);
            $r->post('/api/galleries', [GalleryController::class, 'store']);
            $r->post('/api/galleries/reorder', [GalleryController::class, 'reorder']);
            $r->patch('/api/galleries/{id}', [GalleryController::class, 'update']);
            $r->delete('/api/galleries/{id}', [GalleryController::class, 'destroy']);
            $r->post('/api/galleries/{id}/images', [GalleryController::class, 'assignImages']);
            $r->post('/api/galleries/{id}/images/reorder', [GalleryController::class, 'reorderImages']);
            $r->delete('/api/galleries/{id}/images/{imageId}', [GalleryController::class, 'removeImage']);

            // ---- Images + metadata ---------------------------------------
            $r->get('/api/images', [ImageController::class, 'index']);
            $r->post('/api/images/bulk', [ImageController::class, 'bulk']);
            $r->get('/api/images/{id}', [ImageController::class, 'show']);
            $r->patch('/api/images/{id}', [ImageController::class, 'update']);
            $r->delete('/api/images/{id}', [ImageController::class, 'destroy']);
            $r->post('/api/images/{id}/reoptimize', [ImageController::class, 'reoptimize']);

            // ---- Uploads (all funnel through the optimisation pipeline) ---
            $r->post('/api/uploads', [UploadController::class, 'upload']);
            $r->post('/api/uploads/url', [UploadController::class, 'fromUrl']);
            $r->post('/api/uploads/zip', [UploadController::class, 'fromZip']);

            // ---- Pages ---------------------------------------------------
            $r->get('/api/pages', [PageController::class, 'index']);
            $r->post('/api/pages', [PageController::class, 'store']);
            $r->post('/api/pages/reorder', [PageController::class, 'reorder']);
            $r->patch('/api/pages/{id}', [PageController::class, 'update']);
            $r->delete('/api/pages/{id}', [PageController::class, 'destroy']);
        });
    }
}
