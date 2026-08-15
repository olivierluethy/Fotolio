<?php

namespace Fotolio\Core;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/**
 * JWT helper (HS256). Access tokens are stateless; refresh tokens are opaque
 * random strings stored hashed in the DB (see AuthService).
 */
final class Token
{
    public static function issueAccess(int $userId, array $claims = []): string
    {
        $now = time();
        $payload = array_merge([
            'sub' => $userId,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + (int) config('jwt.access_ttl', 900),
            'type' => 'access',
        ], $claims);

        return JWT::encode($payload, (string) config('jwt.secret'), 'HS256');
    }

    public static function decode(string $jwt): array
    {
        $decoded = JWT::decode($jwt, new Key((string) config('jwt.secret'), 'HS256'));
        return (array) $decoded;
    }

    /**
     * A signed, self-contained token scoping a site to an editor render mode
     * (edit | preview). Lets the theme iframe load without an auth header —
     * the token is the credential and carries the site id + mode.
     */
    public static function issueScoped(string $type, int $subject, int $ttl): string
    {
        $now = time();
        return JWT::encode([
            'sub' => $subject,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $ttl,
            'type' => $type,
        ], (string) config('jwt.secret'), 'HS256');
    }

    /** Opaque refresh token (returned to client) + its storable hash. */
    public static function newRefreshToken(): array
    {
        $raw = bin2hex(random_bytes(40));
        return [$raw, hash('sha256', $raw)];
    }

    public static function hashRefresh(string $raw): string
    {
        return hash('sha256', $raw);
    }
}
