<?php

namespace Fotolio\Services;

use Fotolio\Core\Database;

/**
 * The draft / published state model for the live Site Editor.
 *
 * Each site owns two JSON documents: `draft_state` (what the editor and Preview
 * render from) and `published_state` (what the public site renders from).
 * Galleries and pages remain table-backed entities (id, slug, is_home, type);
 * the state document references them by id and layers the things the editor
 * manipulates: order, nav visibility, names, hero config, page blocks and
 * gallery photo membership/order. Image assets stay in the `images` table.
 *
 * See docs/EDITOR.md for the full shape and rationale.
 */
final class SiteStateService
{
    public function __construct(private ?ImageService $images = null)
    {
    }

    // ---- Reads ------------------------------------------------------------

    /** The draft document, reconciled against current entities. */
    public function getDraft(int $siteId): array
    {
        $row = Database::fetch('SELECT draft_state FROM sites WHERE id = :id', ['id' => $siteId]);
        $doc = $row && $row['draft_state'] ? json_decode($row['draft_state'], true) : null;
        if (!is_array($doc)) {
            $doc = $this->composeFromTables($siteId);
            $this->writeDraft($siteId, $doc);
        }
        return $this->reconcile($siteId, $doc);
    }

    /** The published document — falls back to composing from tables (legacy sites). */
    public function getPublished(int $siteId): array
    {
        $row = Database::fetch('SELECT published_state FROM sites WHERE id = :id', ['id' => $siteId]);
        $doc = $row && $row['published_state'] ? json_decode($row['published_state'], true) : null;
        if (!is_array($doc)) {
            $doc = $this->composeFromTables($siteId);
        }
        return $this->reconcile($siteId, $doc);
    }

    // ---- Writes -----------------------------------------------------------

    /** Autosave: replace the draft document (small; single-user site). */
    public function saveDraft(int $siteId, array $state): array
    {
        $doc = $this->normalize($state);
        $this->writeDraft($siteId, $doc);
        return $this->reconcile($siteId, $doc);
    }

    /** Promote draft → published and mark the site live. */
    public function publish(int $siteId): array
    {
        $doc = $this->getDraft($siteId);
        Database::update('sites', [
            'published_state' => json_encode($doc),
            'draft_state' => json_encode($doc),
            'published' => 1,
            'last_published_at' => Database::now(),
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $siteId]);
        return $doc;
    }

    /** Discard: reset draft ← published. */
    public function discard(int $siteId): array
    {
        $doc = $this->getPublished($siteId);
        $this->writeDraft($siteId, $doc);
        return $doc;
    }

    private function writeDraft(int $siteId, array $doc): void
    {
        Database::update('sites', [
            'draft_state' => json_encode($doc),
            'updated_at' => Database::now(),
        ], 'id = :id', ['id' => $siteId]);
    }

    /** True when the draft differs from what's published. */
    public function isDirty(int $siteId): bool
    {
        $row = Database::fetch('SELECT draft_state, published_state FROM sites WHERE id = :id', ['id' => $siteId]);
        if (!$row) {
            return false;
        }
        $draft = $row['draft_state'] ? json_decode($row['draft_state'], true) : null;
        $published = $row['published_state'] ? json_decode($row['published_state'], true) : null;
        return json_encode($this->normalize($draft ?? [])) !== json_encode($this->normalize($published ?? []));
    }

    // ---- Compose from the normalized tables (backfill + self-heal) --------

    public function composeFromTables(int $siteId): array
    {
        $site = Database::fetch('SELECT * FROM sites WHERE id = :id', ['id' => $siteId]) ?: [];
        $galleries = Database::all('SELECT * FROM galleries WHERE site_id = :s ORDER BY sort ASC, id ASC', ['s' => $siteId]);
        $pages = Database::all('SELECT * FROM pages WHERE site_id = :s ORDER BY sort ASC, id ASC', ['s' => $siteId]);

        $gEntries = [];
        foreach ($galleries as $g) {
            $ids = Database::all(
                'SELECT image_id FROM image_gallery WHERE gallery_id = :g ORDER BY sort ASC, id ASC',
                ['g' => $g['id']]
            );
            $gEntries[] = [
                'id' => (int) $g['id'],
                'name' => $g['name'],
                'description' => $g['description'],
                'show_in_nav' => (bool) $g['show_in_nav'],
                'header_config' => $g['header_config'] ? json_decode($g['header_config'], true) : null,
                'image_ids' => array_map(fn ($r) => (int) $r['image_id'], $ids),
            ];
        }

        $pEntries = [];
        foreach ($pages as $p) {
            $pEntries[] = [
                'id' => (int) $p['id'],
                'title' => $p['title'],
                'show_in_nav' => (bool) $p['show_in_nav'],
                'published' => (bool) $p['published'],
                'header_config' => $p['header_config'] ? json_decode($p['header_config'], true) : null,
                'content' => $p['content'] ? json_decode($p['content'], true) : [],
            ];
        }

        return $this->normalize([
            'version' => 1,
            'site' => [
                'title' => $site['title'] ?? '',
                'tagline' => $site['tagline'] ?? null,
                'settings' => isset($site['settings']) && $site['settings'] ? json_decode($site['settings'], true) : ['social' => new \stdClass(), 'footer' => null],
                'home_header' => isset($site['home_header']) && $site['home_header'] ? json_decode($site['home_header'], true) : SiteService::defaultHeader(),
            ],
            'galleries' => $gEntries,
            'pages' => $pEntries,
        ]);
    }

    // ---- Reconcile the stored doc with current entities -------------------

    private function reconcile(int $siteId, array $doc): array
    {
        $doc = $this->normalize($doc);
        $composed = $this->composeFromTables($siteId);

        $doc['galleries'] = $this->mergeEntities($doc['galleries'], $composed['galleries']);
        $doc['pages'] = $this->mergeEntities($doc['pages'], $composed['pages']);

        // Site-level identity that isn't editor-owned falls back to composed.
        $doc['site'] = array_merge($composed['site'], array_filter($doc['site'], fn ($v) => $v !== null));

        return $doc;
    }

    /** Keep the doc's order for known ids; drop orphans; append newly-created. */
    private function mergeEntities(array $docEntries, array $composed): array
    {
        $byId = [];
        foreach ($composed as $c) {
            $byId[$c['id']] = $c;
        }
        $seen = [];
        $out = [];
        foreach ($docEntries as $e) {
            $id = $e['id'] ?? null;
            if ($id === null || !isset($byId[$id]) || isset($seen[$id])) {
                continue; // orphan or duplicate
            }
            $seen[$id] = true;
            // Keep composed identity for image_ids sanity but prefer doc's editable fields.
            $out[] = $e;
        }
        foreach ($composed as $c) {
            if (!isset($seen[$c['id']])) {
                $out[] = $c;
            }
        }
        return $out;
    }

    // ---- Resolve a render-ready model ------------------------------------

    /** Turn a state document into everything the theme templates need. */
    public function resolveForRender(int $siteId, array $doc): array
    {
        $doc = $this->reconcile($siteId, $doc);
        $siteRow = Database::fetch('SELECT * FROM sites WHERE id = :id', ['id' => $siteId]) ?: [];

        $galleries = [];
        foreach ($doc['galleries'] as $g) {
            $row = Database::fetch('SELECT * FROM galleries WHERE id = :id AND site_id = :s', ['id' => $g['id'], 's' => $siteId]);
            if (!$row) {
                continue;
            }
            $imgs = $this->presentImages($siteId, $g['image_ids'] ?? []);
            $galleries[] = [
                'id' => (int) $row['id'],
                'name' => $g['name'] ?? $row['name'],
                'slug' => $row['slug'],
                'description' => $g['description'] ?? $row['description'],
                'is_home' => (bool) $row['is_home'],
                'show_in_nav' => (bool) ($g['show_in_nav'] ?? true),
                'header_config' => $g['header_config'] ?? null,
                'images' => $imgs,
                'image_count' => count($imgs),
            ];
        }

        $pages = [];
        foreach ($doc['pages'] as $p) {
            $row = Database::fetch('SELECT * FROM pages WHERE id = :id AND site_id = :s', ['id' => $p['id'], 's' => $siteId]);
            if (!$row) {
                continue;
            }
            $pages[] = [
                'id' => (int) $row['id'],
                'type' => $row['type'],
                'title' => $p['title'] ?? $row['title'],
                'slug' => $row['slug'],
                'content' => $p['content'] ?? [],
                'header_config' => $p['header_config'] ?? null,
                'published' => (bool) ($p['published'] ?? true),
                'show_in_nav' => (bool) ($p['show_in_nav'] ?? true),
            ];
        }

        $site = $siteRow;
        $site['title'] = $doc['site']['title'] ?? ($siteRow['title'] ?? '');
        $site['tagline'] = $doc['site']['tagline'] ?? ($siteRow['tagline'] ?? null);
        $site['settings'] = $doc['site']['settings'] ?? [];
        $site['home_header'] = $doc['site']['home_header'] ?? SiteService::defaultHeader();

        return ['site' => $site, 'galleries' => $galleries, 'pages' => $pages];
    }

    private function presentImages(int $siteId, array $ids): array
    {
        if (!$this->images) {
            return [];
        }
        $out = [];
        foreach ($ids as $id) {
            $row = Database::fetch('SELECT * FROM images WHERE id = :i AND site_id = :s', ['i' => (int) $id, 's' => $siteId]);
            if ($row) {
                $out[] = $this->images->present($row);
            }
        }
        return $out;
    }

    // ---- Normalisation ----------------------------------------------------

    /** Guarantee a well-formed document so downstream code is total. */
    public function normalize(array $doc): array
    {
        $site = $doc['site'] ?? [];
        return [
            'version' => 1,
            'site' => [
                'title' => $site['title'] ?? null,
                'tagline' => $site['tagline'] ?? null,
                'settings' => $site['settings'] ?? null,
                'home_header' => $site['home_header'] ?? null,
            ],
            'galleries' => array_values(array_map([$this, 'normGallery'], $doc['galleries'] ?? [])),
            'pages' => array_values(array_map([$this, 'normPage'], $doc['pages'] ?? [])),
        ];
    }

    private function normGallery(array $g): array
    {
        return [
            'id' => isset($g['id']) ? (int) $g['id'] : null,
            'name' => $g['name'] ?? '',
            'description' => $g['description'] ?? null,
            'show_in_nav' => (bool) ($g['show_in_nav'] ?? true),
            'header_config' => $g['header_config'] ?? null,
            'image_ids' => array_values(array_map('intval', $g['image_ids'] ?? [])),
        ];
    }

    private function normPage(array $p): array
    {
        return [
            'id' => isset($p['id']) ? (int) $p['id'] : null,
            'title' => $p['title'] ?? '',
            'show_in_nav' => (bool) ($p['show_in_nav'] ?? true),
            'published' => (bool) ($p['published'] ?? true),
            'header_config' => $p['header_config'] ?? null,
            'content' => array_values($p['content'] ?? []),
        ];
    }
}
