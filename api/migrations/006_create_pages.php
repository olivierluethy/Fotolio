<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'pages', function (Schema $t) {
            $t->id();
            $t->foreignId('site_id', 'sites');
            $t->string('type', 20)->default('custom');      // about | custom
            $t->string('title', 160);
            $t->string('slug', 80);
            $t->json('content')->nullable();                // ordered rich blocks
            $t->json('header_config')->nullable();
            $t->integer('sort')->default(0);
            $t->boolean('published')->default(true);
            $t->boolean('show_in_nav')->default(true);
            $t->timestamps();
            $t->index('site_id');
            $t->uniqueIndex('site_id', 'slug');
        });
    },
];
