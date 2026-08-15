<?php

namespace Fotolio\Core;

use PDO;
use PDOException;

/**
 * Thin PDO wrapper. Supports SQLite (zero-config local dev) and MySQL/MariaDB
 * (production) through the same prepared-statement API.
 */
final class Database
{
    private static ?PDO $pdo = null;
    private static string $driver = 'sqlite';

    public static function connect(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $driver = (string) config('db.driver', 'sqlite');
        self::$driver = $driver;

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            if ($driver === 'sqlite') {
                $path = (string) config('db.sqlite_path', 'storage/fotolio.sqlite');
                if ($path[0] !== '/') {
                    $path = base_path($path);
                }
                @mkdir(dirname($path), 0775, true);
                self::$pdo = new PDO('sqlite:' . $path, null, null, $options);
                self::$pdo->exec('PRAGMA foreign_keys = ON');
                self::$pdo->exec('PRAGMA journal_mode = WAL');
            } else {
                $dsn = sprintf(
                    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                    config('db.host'),
                    config('db.port'),
                    config('db.name')
                );
                self::$pdo = new PDO($dsn, config('db.user'), config('db.pass'), $options);
            }
        } catch (PDOException $e) {
            throw new \RuntimeException('Database connection failed: ' . $e->getMessage(), 0, $e);
        }

        return self::$pdo;
    }

    public static function driver(): string
    {
        return self::$driver;
    }

    public static function isMysql(): bool
    {
        return self::$driver === 'mysql';
    }

    /** @return \PDOStatement */
    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::connect()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function fetch(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function column(string $sql, array $params = []): mixed
    {
        $val = self::run($sql, $params)->fetchColumn();
        return $val === false ? null : $val;
    }

    /** Insert a row and return the new id. */
    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $place = array_map(static fn ($c) => ':' . $c, $cols);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $cols),
            implode(', ', $place)
        );
        self::run($sql, $data);
        return (int) self::connect()->lastInsertId();
    }

    public static function update(string $table, array $data, string $where, array $whereParams = []): int
    {
        $sets = array_map(static fn ($c) => "$c = :set_$c", array_keys($data));
        $params = [];
        foreach ($data as $k => $v) {
            $params['set_' . $k] = $v;
        }
        $params = array_merge($params, $whereParams);
        $sql = sprintf('UPDATE %s SET %s WHERE %s', $table, implode(', ', $sets), $where);
        return self::run($sql, $params)->rowCount();
    }

    public static function delete(string $table, string $where, array $params = []): int
    {
        return self::run("DELETE FROM $table WHERE $where", $params)->rowCount();
    }

    public static function transaction(callable $fn): mixed
    {
        $pdo = self::connect();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** Current timestamp string in a portable format. */
    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }
}
