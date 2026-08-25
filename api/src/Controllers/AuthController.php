<?php

namespace Fotolio\Controllers;

use Fotolio\Core\Controller;
use Fotolio\Core\Database;
use Fotolio\Core\HttpException;
use Fotolio\Core\Request;
use Fotolio\Core\Response;
use Fotolio\Models\User;
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

    /** Update the signed-in user's profile (display name and/or avatar). */
    public function updateProfile(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validated($request, [
            'name' => 'nullable|string|min:2|max:120',
            'avatar_path' => 'nullable|string|max:1000',
        ]);
        $body = $request->all();
        $fields = [];
        if (array_key_exists('name', $body) && is_string($data['name'] ?? null) && trim((string) $data['name']) !== '') {
            $fields['name'] = trim((string) $data['name']);
        }
        if (array_key_exists('avatar_path', $body)) {
            $fields['avatar_path'] = ($data['avatar_path'] ?? '') === '' ? null : $data['avatar_path'];
        }
        if ($fields) {
            $fields['updated_at'] = Database::now();
            Database::update('users', $fields, 'id = :id', ['id' => $user->id]);
        }
        $row = Database::fetch('SELECT * FROM users WHERE id = :id', ['id' => $user->id]);
        return Response::json(['user' => User::fromRow($row)->toArray()]);
    }

    /** Upload an avatar image (drag & drop / file picker) → stored + set. */
    public function uploadAvatar(Request $request): Response
    {
        $user = $this->user($request);
        $file = $request->files['file'] ?? null;
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
            throw HttpException::unprocessable('No image was received. Drop a JPG, PNG or WebP.');
        }
        $path = $this->saveAvatar($user->id, (string) $file['tmp_name']);
        Database::update('users', ['avatar_path' => $path, 'updated_at' => Database::now()], 'id = :id', ['id' => $user->id]);
        return Response::json(['avatar_path' => $path]);
    }

    /** Cover-crop an uploaded image to a 512px square WebP under /media/avatars. */
    private function saveAvatar(int $userId, string $tmpPath): string
    {
        $raw = @file_get_contents($tmpPath);
        $src = $raw ? @imagecreatefromstring($raw) : false;
        if (!$src) {
            throw HttpException::unprocessable('That file isn’t a supported image.');
        }
        $w = imagesx($src);
        $h = imagesy($src);
        $side = min($w, $h);
        $sx = (int) (($w - $side) / 2);
        $sy = (int) (($h - $side) / 2);
        $size = 512;
        $dst = imagecreatetruecolor($size, $size);
        imagecopyresampled($dst, $src, 0, 0, $sx, $sy, $size, $size, $side, $side);

        $dir = base_path('public/media/avatars');
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $file = $dir . '/' . $userId . '.webp';
        if (function_exists('imagewebp')) {
            imagewebp($dst, $file, 82);
        } else {
            $file = $dir . '/' . $userId . '.jpg';
            imagejpeg($dst, $file, 86);
        }
        imagedestroy($src);
        imagedestroy($dst);

        return '/media/avatars/' . basename($file) . '?v=' . time();
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
