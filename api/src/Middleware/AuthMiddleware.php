<?php

namespace Fotolio\Middleware;

use Fotolio\Core\HttpException;
use Fotolio\Core\Middleware;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\AuthService;

final class AuthMiddleware implements Middleware
{
    public function __construct(private AuthService $auth)
    {
    }

    public function handle(Request $request, callable $next): Response
    {
        $token = $request->bearerToken();
        if (!$token) {
            throw HttpException::unauthorized();
        }
        $request->attributes['user'] = $this->auth->userFromToken($token);
        return $next($request);
    }
}
