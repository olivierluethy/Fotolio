<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'image_gallery', function (Schema $t) {
            $t->id();
            $t->foreignId('gallery_id', 'galleries');
            $t->foreignId('image_id', 'images');
            $t->integer('sort')->default(0);
            $t->index('gallery_id');
            $t->index('image_id');
            $t->uniqueIndex('gallery_id', 'image_id');
        });
    },
];
