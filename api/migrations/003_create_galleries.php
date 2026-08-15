<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'galleries', function (Schema $t) {
            $t->id();
            $t->foreignId('site_id', 'sites');
            $t->string('name', 120);
            $t->string('slug', 60);
            $t->text('description')->nullable();
            $t->integer('sort')->default(0);
            $t->boolean('is_home')->default(false);
            $t->boolean('show_in_nav')->default(true);
            $t->json('header_config')->nullable();
            $t->bigint('cover_image_id')->nullable();
            $t->timestamps();
            $t->index('site_id');
            $t->uniqueIndex('site_id', 'slug');
        });
    },
];
