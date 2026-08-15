<?php

namespace Fotolio\Core;

class HttpException extends \RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message = '',
        public readonly array $errors = [],
    ) {
        parent::__construct($message ?: self::defaultMessage($status));
    }

    public static function badRequest(string $m = 'Bad request', array $errors = []): self
    {
        return new self(400, $m, $errors);
    }

    public static function unauthorized(string $m = 'Not authenticated'): self
    {
        return new self(401, $m);
    }

    public static function forbidden(string $m = 'Not allowed'): self
    {
        return new self(403, $m);
    }

    public static function notFound(string $m = 'Not found'): self
    {
        return new self(404, $m);
    }

    public static function unprocessable(string $m, array $errors = []): self
    {
        return new self(422, $m, $errors);
    }

    public static function conflict(string $m): self
    {
        return new self(409, $m);
    }

    private static function defaultMessage(int $status): string
    {
        return match ($status) {
            400 => 'Bad request',
            401 => 'Not authenticated',
            403 => 'Not allowed',
            404 => 'Not found',
            409 => 'Conflict',
            422 => 'Validation failed',
            default => 'Error',
        };
    }
}
