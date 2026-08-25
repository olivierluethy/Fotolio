<?php

use Fotolio\Core\Schema;

/**
 * User-defined analytics goals.
 *
 * A goal describes a conversion the site owner cares about — e.g. "a visitor
 * opens at least 5 images (lightbox) on /gallery/aerial". It is evaluated
 * per-session against the event log: a session converts when it accumulates at
 * least `threshold` matching events (or, for the `visit` metric, pageviews).
 * `path` optionally scopes it to one page; `match` optionally scopes it to a
 * label substring (an image / element identifier). Both empty = site-wide.
 */
return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'analytics_goals', function (Schema $t) {
            $t->id();
            $t->foreignId('site_id', 'sites');
            $t->string('name', 120);
            $t->string('metric', 24);                  // pageview | click | lightbox | nav | visit
            $t->string('path', 400)->nullable();       // target page path, or null = any page
            $t->string('label_match', 200)->nullable(); // label substring, or null = any element
            $t->integer('threshold')->default(1);      // matching events per session to convert
            $t->timestamps();
            $t->index('site_id');
        });
    },
];
