<?php

namespace Fotolio\Models;

final class User
{
    public function __construct(
        public int $id,
        public string $name,
        public string $email,
        public ?string $avatarPath = null,
        public ?string $createdAt = null,
    ) {
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) $row['id'],
            name: $row['name'],
            email: $row['email'],
            avatarPath: $row['avatar_path'] ?? null,
            createdAt: $row['created_at'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_path' => $this->avatarPath,
            'created_at' => $this->createdAt,
        ];
    }
}
