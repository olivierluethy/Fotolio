<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'users', function (Schema $t) {
            $t->id();
            $t->string('name', 120);
            $t->string('email', 191)->unique();
            $t->string('password_hash', 255);
            $t->string('avatar_path', 255)->nullable();
            $t->datetime('email_verified_at')->nullable();
            $t->timestamps();
        });
    },
];
