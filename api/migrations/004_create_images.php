<?php

use Fotolio\Core\Schema;

return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'images', function (Schema $t) {
            $t->id();
            $t->foreignId('user_id', 'users');
            $t->foreignId('site_id', 'sites');

            // Editable metadata
            $t->string('title', 200)->nullable();
            $t->string('location', 200)->nullable();
            $t->text('description')->nullable();
            $t->string('capture_method', 20)->nullable();   // drone | camera | other
            $t->json('tags')->nullable();

            // EXIF (prefilled, editable)
            $t->string('camera_make', 120)->nullable();
            $t->string('camera_model', 120)->nullable();
            $t->string('lens', 160)->nullable();
            $t->string('focal_length', 40)->nullable();
            $t->string('aperture', 40)->nullable();
            $t->string('shutter', 40)->nullable();
            $t->string('iso', 40)->nullable();
            $t->datetime('captured_at')->nullable();
            $t->decimal('gps_lat', 10, 6)->nullable();
            $t->decimal('gps_lng', 10, 6)->nullable();

            // Dimensions + files
            $t->integer('width')->default(0);
            $t->integer('height')->default(0);
            $t->string('original_filename', 255);
            $t->string('original_path', 255);               // private
            $t->bigint('original_bytes')->default(0);
            $t->string('mime', 100)->nullable();

            // Optimisation results
            $t->json('variants')->nullable();               // {thumb,medium,large}{webp,jpg}, lqip
            $t->bigint('optimised_bytes')->default(0);
            $t->decimal('reduction_pct', 5, 2)->default(0);
            $t->integer('quality')->default(82);

            $t->string('status', 20)->default('ready');     // processing | ready | failed
            $t->integer('sort')->default(0);
            $t->timestamps();
            $t->index('site_id');
            $t->index('user_id');
        });
    },
];
