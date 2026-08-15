<?php

namespace Fotolio\Core;

final class Response
{
    public function __construct(
        private mixed $body = '',
        private int $status = 200,
        private array $headers = [],
    ) {
    }

    public static function json(mixed $data, int $status = 200, array $headers = []): self
    {
        return new self(
            json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $status,
            array_merge(['Content-Type' => 'application/json; charset=utf-8'], $headers)
        );
    }

    public static function html(string $html, int $status = 200, array $headers = []): self
    {
        return new self($html, $status, array_merge(['Content-Type' => 'text/html; charset=utf-8'], $headers));
    }

    public static function noContent(int $status = 204): self
    {
        return new self('', $status);
    }

    public static function redirect(string $to, int $status = 302): self
    {
        return new self('', $status, ['Location' => $to]);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function withCookie(
        string $name,
        string $value,
        int $expires,
        bool $httpOnly = true,
        bool $secure = false,
        string $sameSite = 'Lax',
        string $path = '/'
    ): self {
        $parts = [
            $name . '=' . urlencode($value),
            'Path=' . $path,
            'Expires=' . gmdate('D, d M Y H:i:s T', $expires),
            'Max-Age=' . max(0, $expires - time()),
            'SameSite=' . $sameSite,
        ];
        if ($httpOnly) {
            $parts[] = 'HttpOnly';
        }
        if ($secure) {
            $parts[] = 'Secure';
        }
        // Multiple Set-Cookie headers need distinct keys; store indexed.
        $this->headers['Set-Cookie::' . $name] = implode('; ', $parts);
        return $this;
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            if (str_starts_with($name, 'Set-Cookie::')) {
                header('Set-Cookie: ' . $value, false);
            } else {
                header($name . ': ' . $value);
            }
        }
        if ($this->body !== '' && $this->body !== null) {
            echo $this->body;
        }
    }

    public function getStatus(): int
    {
        return $this->status;
    }
}
