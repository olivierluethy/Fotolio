<?php

namespace Fotolio\Core;

use Fotolio\Models\User;

abstract class Controller
{
    /** The authenticated user, set by AuthMiddleware. */
    protected function user(Request $request): User
    {
        $user = $request->attributes['user'] ?? null;
        if (!$user instanceof User) {
            throw HttpException::unauthorized();
        }
        return $user;
    }

    protected function validated(Request $request, array $rules): array
    {
        return Validator::make($request->all(), $rules);
    }
}
