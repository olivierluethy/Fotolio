<?php

namespace Fotolio\Core;

/**
 * Runs driver-aware migration files from /migrations. Each file returns an
 * array: ['up' => fn(PDO $db, string $driver), optional 'down' => fn(...)].
 * Applied migrations are tracked in the `migrations` table.
 */
final class Migrator
{
    public function __construct(private string $path)
    {
    }

    public function migrate(): array
    {
        $db = Database::connect();
        $this->ensureTable($db);

        $applied = array_column(
            Database::all('SELECT name FROM migrations'),
            'name'
        );

        $ran = [];
        foreach ($this->files() as $file) {
            $name = basename($file, '.php');
            if (in_array($name, $applied, true)) {
                continue;
            }
            $migration = require $file;
            Database::transaction(function () use ($migration, $db, $name) {
                ($migration['up'])($db, Database::driver());
                Database::insert('migrations', [
                    'name' => $name,
                    'applied_at' => Database::now(),
                ]);
            });
            $ran[] = $name;
        }
        return $ran;
    }

    public function fresh(): array
    {
        $db = Database::connect();
        // Drop all known tables (reverse dependency order handled by FK off).
        if (Database::isMysql()) {
            $db->exec('SET FOREIGN_KEY_CHECKS=0');
            foreach (Database::all('SHOW TABLES') as $row) {
                $name = reset($row);
                $db->exec("DROP TABLE IF EXISTS `$name`");
            }
            $db->exec('SET FOREIGN_KEY_CHECKS=1');
        } else {
            $db->exec('PRAGMA foreign_keys = OFF');
            $tables = Database::all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            foreach ($tables as $t) {
                $db->exec('DROP TABLE IF EXISTS "' . $t['name'] . '"');
            }
            $db->exec('PRAGMA foreign_keys = ON');
        }
        return $this->migrate();
    }

    private function ensureTable(\PDO $db): void
    {
        if (Database::isMysql()) {
            $db->exec('CREATE TABLE IF NOT EXISTS migrations (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(191) NOT NULL UNIQUE,
                applied_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        } else {
            $db->exec('CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL
            )');
        }
    }

    private function files(): array
    {
        $files = glob($this->path . '/*.php') ?: [];
        sort($files);
        return $files;
    }
}
