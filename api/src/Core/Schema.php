<?php

namespace Fotolio\Core;

use PDO;

/**
 * Fluent, driver-aware table builder covering the subset Fotolio needs.
 * Produces portable DDL for SQLite (dev) and MySQL/MariaDB (production).
 */
final class Schema
{
    private array $columns = [];
    private array $constraints = [];
    private array $indexes = [];

    private function __construct(
        private string $table,
        private string $driver,
    ) {
    }

    public static function create(PDO $db, string $driver, string $table, callable $define): void
    {
        $b = new self($table, $driver);
        $define($b);
        foreach ($b->toSql() as $sql) {
            $db->exec($sql);
        }
    }

    public function id(string $name = 'id'): self
    {
        $this->columns[$name] = $this->driver === 'mysql'
            ? "`$name` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY"
            : "\"$name\" INTEGER PRIMARY KEY AUTOINCREMENT";
        return $this;
    }

    public function string(string $name, int $len = 255): self
    {
        return $this->col($name, $this->driver === 'mysql' ? "VARCHAR($len)" : 'TEXT');
    }

    public function text(string $name): self
    {
        return $this->col($name, 'TEXT');
    }

    public function json(string $name): self
    {
        // Stored as TEXT in both drivers; encoded/decoded in PHP for portability.
        return $this->col($name, 'TEXT');
    }

    public function integer(string $name): self
    {
        return $this->col($name, $this->driver === 'mysql' ? 'INT' : 'INTEGER');
    }

    public function bigint(string $name): self
    {
        return $this->col($name, $this->driver === 'mysql' ? 'BIGINT' : 'INTEGER');
    }

    public function boolean(string $name): self
    {
        return $this->col($name, $this->driver === 'mysql' ? 'TINYINT(1)' : 'INTEGER');
    }

    public function decimal(string $name, int $p = 12, int $s = 2): self
    {
        return $this->col($name, $this->driver === 'mysql' ? "DECIMAL($p,$s)" : 'REAL');
    }

    public function datetime(string $name): self
    {
        return $this->col($name, 'DATETIME');
    }

    /** Foreign key column (unsigned bigint / integer) with optional cascade. */
    public function foreignId(string $name, string $refTable, string $refCol = 'id', bool $cascade = true): self
    {
        $this->col($name, $this->driver === 'mysql' ? 'BIGINT UNSIGNED' : 'INTEGER');
        $onDelete = $cascade ? 'ON DELETE CASCADE' : 'ON DELETE SET NULL';
        $q = $this->driver === 'mysql' ? '`' : '"';
        $this->constraints[] = "FOREIGN KEY ($q$name$q) REFERENCES $q$refTable$q ($q$refCol$q) $onDelete";
        return $this;
    }

    public function nullable(): self
    {
        $this->modifyLast(' NULL', true);
        return $this;
    }

    public function default(mixed $value): self
    {
        $literal = is_bool($value) ? ($value ? '1' : '0')
            : (is_int($value) || is_float($value) ? (string) $value
            : "'" . str_replace("'", "''", (string) $value) . "'");
        $this->modifyLast(" DEFAULT $literal");
        return $this;
    }

    public function unique(): self
    {
        $this->modifyLast(' UNIQUE');
        return $this;
    }

    public function index(string ...$cols): self
    {
        $this->indexes[] = ['cols' => $cols, 'unique' => false];
        return $this;
    }

    public function uniqueIndex(string ...$cols): self
    {
        $this->indexes[] = ['cols' => $cols, 'unique' => true];
        return $this;
    }

    public function timestamps(): self
    {
        $this->datetime('created_at')->nullable();
        $this->datetime('updated_at')->nullable();
        return $this;
    }

    private function col(string $name, string $type): self
    {
        $q = $this->driver === 'mysql' ? '`' : '"';
        // default columns are NOT NULL unless nullable() is called
        $this->columns[$name] = "$q$name$q $type NOT NULL";
        $this->lastCol = $name;
        return $this;
    }

    private ?string $lastCol = null;

    private function modifyLast(string $suffix, bool $stripNotNull = false): void
    {
        if ($this->lastCol === null) {
            return;
        }
        $def = $this->columns[$this->lastCol];
        if ($stripNotNull) {
            $def = str_replace(' NOT NULL', '', $def);
        }
        $this->columns[$this->lastCol] = $def . $suffix;
    }

    /** @return string[] */
    private function toSql(): array
    {
        $q = $this->driver === 'mysql' ? '`' : '"';
        $parts = array_values($this->columns);
        $parts = array_merge($parts, $this->constraints);
        $engine = $this->driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
        $sqls = [
            "CREATE TABLE $q{$this->table}$q (\n  " . implode(",\n  ", $parts) . "\n)$engine",
        ];
        foreach ($this->indexes as $ix) {
            $cols = $ix['cols'];
            $prefix = $ix['unique'] ? 'uniq_' : 'idx_';
            $name = $prefix . $this->table . '_' . implode('_', $cols);
            $colList = implode(', ', array_map(fn ($c) => "$q$c$q", $cols));
            $kw = $ix['unique'] ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX';
            $sqls[] = "$kw $q$name$q ON $q{$this->table}$q ($colList)";
        }
        return $sqls;
    }
}
