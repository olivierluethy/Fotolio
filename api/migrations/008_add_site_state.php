<?php

use Fotolio\Core\Database;
use Fotolio\Services\SiteStateService;

/**
 * Draft / published state documents for the live Site Editor.
 *
 * Adds sites.draft_state, sites.published_state and sites.last_published_at,
 * then seeds both documents for every existing site by composing the current
 * normalized data (galleries, pages, photo membership, header + settings).
 */
return [
    'up' => function (PDO $db, string $driver) {
        $textType = $driver === 'mysql' ? 'LONGTEXT' : 'TEXT';
        $db->exec("ALTER TABLE sites ADD COLUMN draft_state $textType NULL");
        $db->exec("ALTER TABLE sites ADD COLUMN published_state $textType NULL");
        $db->exec('ALTER TABLE sites ADD COLUMN last_published_at DATETIME NULL');

        // Backfill: seed both documents from existing data so the editor and
        // the public site work immediately with no empty state.
        $state = new SiteStateService();
        $sites = Database::all('SELECT id, published FROM sites');
        foreach ($sites as $site) {
            $doc = json_encode($state->composeFromTables((int) $site['id']));
            Database::update('sites', [
                'draft_state' => $doc,
                'published_state' => $doc,
                'last_published_at' => $site['published'] ? Database::now() : null,
            ], 'id = :id', ['id' => $site['id']]);
        }
    },
];
