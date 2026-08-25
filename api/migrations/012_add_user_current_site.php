<?php

/**
 * Multi-site support: remember which of a user's sites is the active one in the
 * dashboard. Nullable — {@see Fotolio\Services\SiteService::forUser} falls back
 * to the user's first site when it is unset, so existing single-site users keep
 * working with no backfill.
 */
return [
    'up' => function (PDO $db, string $driver) {
        $db->exec('ALTER TABLE users ADD COLUMN current_site_id INTEGER NULL');
    },
];
