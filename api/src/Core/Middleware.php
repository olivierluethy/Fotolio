<?php

namespace Fotolio\Core;

interface Middleware
{
    /**
     * @param callable(Request):Response $next
     */
    public function handle(Request $request, callable $next): Response;
}
