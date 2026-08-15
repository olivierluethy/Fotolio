<?php

namespace Fotolio\Core;

/**
 * Minimal path router with `{param}` placeholders and optional per-route
 * middleware. Controllers are resolved from the container lazily.
 */
final class Router
{
    /** @var array<int,array{method:string,regex:string,params:array,handler:mixed,middleware:array}> */
    private array $routes = [];
    private array $groupMiddleware = [];

    public function __construct(private Container $container)
    {
    }

    public function get(string $path, mixed $handler, array $mw = []): void
    {
        $this->add('GET', $path, $handler, $mw);
    }

    public function post(string $path, mixed $handler, array $mw = []): void
    {
        $this->add('POST', $path, $handler, $mw);
    }

    public function put(string $path, mixed $handler, array $mw = []): void
    {
        $this->add('PUT', $path, $handler, $mw);
    }

    public function patch(string $path, mixed $handler, array $mw = []): void
    {
        $this->add('PATCH', $path, $handler, $mw);
    }

    public function delete(string $path, mixed $handler, array $mw = []): void
    {
        $this->add('DELETE', $path, $handler, $mw);
    }

    /** Apply middleware to every route registered inside the callback. */
    public function group(array $middleware, callable $fn): void
    {
        $previous = $this->groupMiddleware;
        $this->groupMiddleware = array_merge($previous, $middleware);
        $fn($this);
        $this->groupMiddleware = $previous;
    }

    private function add(string $method, string $path, mixed $handler, array $mw): void
    {
        $params = [];
        $regex = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $path);
        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'handler' => $handler,
            'middleware' => array_merge($this->groupMiddleware, $mw),
        ];
    }

    public function dispatch(Request $request): Response
    {
        $pathMatched = false;
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $matches)) {
                continue;
            }
            $pathMatched = true;
            if ($route['method'] !== $request->method) {
                continue;
            }
            array_shift($matches);
            $params = array_combine($route['params'], $matches) ?: [];

            $core = function (Request $req) use ($route, $params): Response {
                return $this->callHandler($route['handler'], $req, $params);
            };
            // Wrap middleware (outermost first).
            $pipeline = array_reduce(
                array_reverse($route['middleware']),
                function (callable $next, string $mwClass) {
                    return function (Request $req) use ($next, $mwClass): Response {
                        /** @var Middleware $mw */
                        $mw = $this->container->make($mwClass);
                        return $mw->handle($req, $next);
                    };
                },
                $core
            );
            return $pipeline($request);
        }

        if ($pathMatched) {
            throw new HttpException(405, 'Method not allowed');
        }
        throw HttpException::notFound();
    }

    private function callHandler(mixed $handler, Request $request, array $params): Response
    {
        if (is_callable($handler)) {
            return $handler($request, $params);
        }
        [$class, $method] = $handler;
        $controller = $this->container->make($class);
        return $controller->{$method}($request, $params);
    }
}
