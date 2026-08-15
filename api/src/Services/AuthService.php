<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;
use Fotolio\Core\HttpException;
use Fotolio\Core\Token;
use Fotolio\Models\User;

final class AuthService
{
    public function __construct(private SiteService $sites)
    {
    }

    public function register(string $name, string $email, string $password): array
    {
        $email = strtolower(trim($email));
        if (Database::fetch('SELECT id FROM users WHERE email = :e', ['e' => $email])) {
            throw HttpException::conflict('An account with this email already exists.');
        }

        return Database::transaction(function () use ($name, $email, $password) {
            $userId = Database::insert('users', [
                'name' => trim($name),
                'email' => $email,
                'password_hash' => $this->hash($password),
                'created_at' => Database::now(),
                'updated_at' => Database::now(),
            ]);
            // Every user gets exactly one site in v1.
            $this->sites->createForUser($userId, $name);
            return $this->issueTokens($userId);
        });
    }

    public function login(string $email, string $password): array
    {
        $email = strtolower(trim($email));
        $row = Database::fetch('SELECT * FROM users WHERE email = :e', ['e' => $email]);
        if (!$row || !password_verify($password, $row['password_hash'])) {
            throw HttpException::unauthorized('Email or password is incorrect.');
        }
        if (password_needs_rehash($row['password_hash'], PASSWORD_ARGON2ID)) {
            Database::update('users', ['password_hash' => $this->hash($password)], 'id = :id', ['id' => $row['id']]);
        }
        return $this->issueTokens((int) $row['id']);
    }

    /** Rotate a refresh token: verify, revoke old, issue new pair. */
    public function refresh(?string $rawRefresh): array
    {
        if (!$rawRefresh) {
            throw HttpException::unauthorized('Missing refresh token.');
        }
        $hash = Token::hashRefresh($rawRefresh);
        $row = Database::fetch(
            'SELECT * FROM refresh_tokens WHERE token_hash = :h AND revoked = 0',
            ['h' => $hash]
        );
        if (!$row || strtotime($row['expires_at']) < time()) {
            throw HttpException::unauthorized('Session expired. Please sign in again.');
        }
        Database::update('refresh_tokens', ['revoked' => 1], 'id = :id', ['id' => $row['id']]);
        return $this->issueTokens((int) $row['user_id']);
    }

    public function logout(?string $rawRefresh): void
    {
        if (!$rawRefresh) {
            return;
        }
        Database::update(
            'refresh_tokens',
            ['revoked' => 1],
            'token_hash = :h',
            ['h' => Token::hashRefresh($rawRefresh)]
        );
    }

    public function userFromToken(string $jwt): User
    {
        try {
            $claims = Token::decode($jwt);
        } catch (\Throwable) {
            throw HttpException::unauthorized('Invalid or expired session.');
        }
        $row = Database::fetch('SELECT * FROM users WHERE id = :id', ['id' => $claims['sub'] ?? 0]);
        if (!$row) {
            throw HttpException::unauthorized();
        }
        return User::fromRow($row);
    }

    private function issueTokens(int $userId): array
    {
        $access = Token::issueAccess($userId);
        [$rawRefresh, $refreshHash] = Token::newRefreshToken();

        Database::insert('refresh_tokens', [
            'user_id' => $userId,
            'token_hash' => $refreshHash,
            'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + (int) config('jwt.refresh_ttl')),
            'revoked' => 0,
            'created_at' => Database::now(),
        ]);

        $row = Database::fetch('SELECT * FROM users WHERE id = :id', ['id' => $userId]);

        return [
            'access_token' => $access,
            'refresh_token' => $rawRefresh,
            'expires_in' => (int) config('jwt.access_ttl'),
            'user' => User::fromRow($row)->toArray(),
        ];
    }

    private function hash(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID);
    }
}
