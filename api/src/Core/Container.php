<?php

namespace Fotolio\Core;

/**
 * Tiny auto-wiring container. Constructor dependencies are resolved
 * recursively; singletons are cached.
 */
final class Container
{
    private array $instances = [];
    private array $bindings = [];

    public function bind(string $abstract, callable $factory): void
    {
        $this->bindings[$abstract] = $factory;
    }

    public function instance(string $abstract, object $instance): void
    {
        $this->instances[$abstract] = $instance;
    }

    public function make(string $abstract): object
    {
        if (isset($this->instances[$abstract])) {
            return $this->instances[$abstract];
        }
        if (isset($this->bindings[$abstract])) {
            return $this->instances[$abstract] = ($this->bindings[$abstract])($this);
        }
        $object = $this->build($abstract);
        return $this->instances[$abstract] = $object;
    }

    private function build(string $class): object
    {
        if (!class_exists($class)) {
            throw new \RuntimeException("Cannot resolve [$class].");
        }
        $ref = new \ReflectionClass($class);
        $ctor = $ref->getConstructor();
        if (!$ctor) {
            return new $class();
        }
        $args = [];
        foreach ($ctor->getParameters() as $param) {
            $type = $param->getType();
            if ($type instanceof \ReflectionNamedType && !$type->isBuiltin()) {
                $args[] = $this->make($type->getName());
            } elseif ($param->isDefaultValueAvailable()) {
                $args[] = $param->getDefaultValue();
            } else {
                throw new \RuntimeException("Cannot resolve parameter \${$param->getName()} of [$class].");
            }
        }
        return $ref->newInstanceArgs($args);
    }
}
