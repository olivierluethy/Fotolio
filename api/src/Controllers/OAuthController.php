<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\HttpException;
use Fotolio\Core\Request;
use Fotolio\Core\Response;

/**
 * Real placeholder endpoints for Google / Facebook / Apple. The buttons in the
 * SPA are live and hit these; until credentials are configured they return a
 * clear "not configured" response rather than failing silently.
 */
final class OAuthController extends Controller
{
    private const PROVIDERS = ['google', 'facebook', 'apple'];

    public function redirect(Request $request, array $params): Response
    {
        return $this->notConfigured($params['provider'] ?? '');
    }

    public function callback(Request $request, array $params): Response
    {
        return $this->notConfigured($params['provider'] ?? '');
    }

    private function notConfigured(string $provider): Response
    {
        $provider = strtolower($provider);
        if (!in_array($provider, self::PROVIDERS, true)) {
            throw HttpException::notFound('Unknown sign-in provider.');
        }
        $label = ucfirst($provider);
        return Response::json([
            'configured' => false,
            'provider' => $provider,
            'message' => "$label sign-in isn’t set up yet. Use email and password for now.",
        ], 501);
    }
}
