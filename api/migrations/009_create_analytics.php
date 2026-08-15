<?php

use Fotolio\Core\Schema;

/**
 * First-party site analytics.
 *
 * Two tables: one row per visitor session (rolled up for fast "active now" and
 * unique-visitor counts) and one row per event (pageview / nav / lightbox /
 * tracked click). Both are scoped by site_id and indexed for the aggregate and
 * real-time queries the Overview dashboard runs. See docs/ANALYTICS.md.
 */
return [
    'up' => function (PDO $db, string $driver) {
        Schema::create($db, $driver, 'analytics_sessions', function (Schema $t) {
            $t->id();
            $t->foreignId('site_id', 'sites');
            $t->string('session_id', 64);
            $t->string('visitor_id', 64)->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('country', 80)->nullable();
            $t->string('country_code', 2)->nullable();
            $t->string('device', 20)->nullable();       // desktop | mobile | tablet | bot
            $t->string('browser', 60)->nullable();
            $t->string('os', 60)->nullable();
            $t->text('user_agent')->nullable();
            $t->text('referrer')->nullable();
            $t->string('landing_path', 400)->nullable();
            $t->string('current_path', 400)->nullable();
            $t->integer('pageviews')->default(0);
            $t->integer('events')->default(0);
            $t->datetime('first_seen');
            $t->datetime('last_seen');
            $t->uniqueIndex('site_id', 'session_id');
            $t->index('site_id', 'last_seen');
        });

        Schema::create($db, $driver, 'analytics_events', function (Schema $t) {
            $t->id();
            $t->foreignId('site_id', 'sites');
            $t->string('session_id', 64);
            $t->string('type', 24);                      // pageview | nav | lightbox | click | event
            $t->string('path', 400)->nullable();
            $t->string('label', 200)->nullable();        // element / gallery / target label
            $t->text('referrer')->nullable();
            $t->datetime('created_at');
            $t->index('site_id', 'created_at');
            $t->index('site_id', 'type');
            $t->index('session_id');
        });
    },
];
