<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'sites', function (Schema $t) {
            $t->id();
            $t->foreignId('user_id', 'users');
            $t->string('title', 160);
            $t->string('tagline', 240)->nullable();
            $t->string('slug', 60)->unique();
            $t->string('subdomain', 60)->nullable()->unique();
            $t->boolean('subdomain_enabled')->default(false);
            $t->string('custom_domain', 191)->nullable()->unique();
            $t->boolean('domain_verified')->default(false);
            $t->string('domain_verify_token', 80)->nullable();
            $t->boolean('published')->default(false);
            $t->string('theme', 40)->default('default');
            $t->string('accent', 20)->nullable();          // optional per-site accent override
            $t->json('home_header')->nullable();           // hero config for the site home
            $t->json('settings')->nullable();              // social links, meta, footer
            $t->timestamps();
            $t->index('user_id');
        });
    },
];
