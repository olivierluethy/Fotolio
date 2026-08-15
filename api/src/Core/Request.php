<?php

namespace Fotolio\Core;

/**
 * Immutable-ish view over the incoming HTTP request.
 */
final class Request
{
    private array $json;
    public array $attributes = [];

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly string $host,
        public readonly array $query,
        public readonly array $server,
        public readonly array $cookies,
        public readonly array $files,
        private readonly string $rawBody,
    ) {
        $this->json = $this->decodeJson();
    }

    public static function capture(): self
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $path = rtrim($path, '/') ?: '/';
        $host = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost');

        return new self(
            method: strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            path: $path,
            host: strtolower($host),
            query: $_GET,
            server: $_SERVER,
            cookies: $_COOKIE,
            files: $_FILES,
            rawBody: file_get_contents('php://input') ?: '',
        );
    }

    private function decodeJson(): array
    {
        $ct = $this->server['CONTENT_TYPE'] ?? '';
        if (str_contains($ct, 'application/json') && $this->rawBody !== '') {
            $decoded = json_decode($this->rawBody, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    /** Body input (JSON or form-encoded POST). */
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->json[$key] ?? $_POST[$key] ?? $default;
    }

    public function all(): array
    {
        return array_merge($_POST, $this->json);
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function cookie(string $key, mixed $default = null): mixed
    {
        return $this->cookies[$key] ?? $default;
    }

    public function bearerToken(): ?string
    {
        $header = $this->server['HTTP_AUTHORIZATION']
            ?? $this->server['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if (preg_match('/Bearer\s+(.+)$/i', $header, $m)) {
            return trim($m[1]);
        }
        return null;
    }

    public function header(string $name, ?string $default = null): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $this->server[$key] ?? $default;
    }

    public function ip(): string
    {
        return $this->server['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /** Host without port. */
    public function hostname(): string
    {
        return explode(':', $this->host)[0];
    }
}
