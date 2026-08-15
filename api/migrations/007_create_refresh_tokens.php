<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'refresh_tokens', function (Schema $t) {
            $t->id();
            $t->foreignId('user_id', 'users');
            $t->string('token_hash', 64)->unique();
            $t->string('user_agent', 255)->nullable();
            $t->string('ip', 64)->nullable();
            $t->datetime('expires_at');
            $t->boolean('revoked')->default(false);
            $t->datetime('created_at')->nullable();
            $t->index('user_id');
        });
    },
];
