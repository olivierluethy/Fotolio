<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Services\AuthService;
use Fotolio\Services\SiteService;

final class AuthController extends Controller
{
    public function __construct(
        private AuthService $auth,
        private SiteService $sites,
    ) {
    }

    public function register(Request $request): Response
    {
        $data = $this->validated($request, [
            'name' => 'required|string|min:2|max:120',
            'email' => 'required|email|max:191',
            'password' => 'required|string|min:8|max:200',
        ]);
        $tokens = $this->auth->register($data['name'], $data['email'], $data['password']);
        return $this->respondWithTokens($tokens, 201);
    }

    public function login(Request $request): Response
    {
        $data = $this->validated($request, [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);
        $tokens = $this->auth->login($data['email'], $data['password']);
        return $this->respondWithTokens($tokens, 200);
    }

    public function refresh(Request $request): Response
    {
        $raw = $request->cookie((string) config('jwt.refresh_cookie'))
            ?? $request->input('refresh_token');
        $tokens = $this->auth->refresh($raw);
        return $this->respondWithTokens($tokens, 200);
    }

    public function logout(Request $request): Response
    {
        $raw = $request->cookie((string) config('jwt.refresh_cookie'))
            ?? $request->input('refresh_token');
        $this->auth->logout($raw);
        return Response::json(['message' => 'Signed out.'])
            ->withCookie((string) config('jwt.refresh_cookie'), '', time() - 3600, true, config('jwt.refresh_secure'));
    }

    public function me(Request $request): Response
    {
        $user = $this->user($request);
        return Response::json([
            'user' => $user->toArray(),
            'site' => $this->sites->forUser($user->id),
        ]);
    }

    private function respondWithTokens(array $tokens, int $status): Response
    {
        $refresh = $tokens['refresh_token'];
        unset($tokens['refresh_token']);
        return Response::json($tokens, $status)->withCookie(
            (string) config('jwt.refresh_cookie'),
            $refresh,
            time() + (int) config('jwt.refresh_ttl'),
            httpOnly: true,
            secure: (bool) config('jwt.refresh_secure'),
            sameSite: 'Lax',
        );
    }
}
