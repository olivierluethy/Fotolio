<?php

namespace Fotolio\Database;

use Fotolio\Core\Database;
use Fotolio\Services\GalleryService;
use Fotolio\Services\ImageOptimizationService;
use Fotolio\Services\ImageService;
use Fotolio\Services\PageService;
use Fotolio\Services\SiteService;

/**
 * Seeds a demo account with real, optimised photos mined from the old site so
 * the running app is immediately inspectable.
 */
final class Seeder
{
    private ImageService $images;
    private GalleryService $galleries;
    private SiteService $sites;
    private PageService $pages;

    public function __construct()
    {
        $this->images = new ImageService(new ImageOptimizationService());
        $this->galleries = new GalleryService($this->images);
        $this->sites = new SiteService();
        $this->pages = new PageService();
    }

    public function run(): void
    {
        $email = 'demo@fotolio.app';
        if (Database::fetch('SELECT id FROM users WHERE email = :e', ['e' => $email])) {
            echo "  demo account already exists — skipping.\n";
            return;
        }

        $userId = Database::insert('users', [
            'name' => 'Meggen Studio',
            'email' => $email,
            'password_hash' => password_hash('password', PASSWORD_ARGON2ID),
            'created_at' => Database::now(),
            'updated_at' => Database::now(),
        ]);
        $siteId = $this->sites->createForUser($userId, 'Meggen Studio');

        // Curate the demo site.
        Database::update('sites', [
            'title' => 'Meggen Studio',
            'tagline' => 'Aerial & landscape photography from Lake Lucerne',
            'slug' => 'meggen-studio',
            'settings' => json_encode([
                'social' => ['instagram' => 'https://instagram.com', 'email' => $email],
                'footer' => 'Photographs from Meggen, Lucerne — Switzerland.',
            ]),
        ], 'id = :id', ['id' => $siteId]);

        // Extra galleries beyond the default Home.
        $aerial = $this->galleries->create($siteId, ['name' => 'Aerial', 'description' => 'Views from above the lake.']);
        $land = $this->galleries->create($siteId, ['name' => 'Landscapes', 'description' => 'Meggenhorn, Pilatus and the shoreline.']);
        $home = Database::fetch('SELECT * FROM galleries WHERE site_id = :s AND is_home = 1', ['s' => $siteId]);

        $sources = $this->pickSources();
        echo '  optimising ' . count($sources) . " demo photos...\n";

        $droneIds = [];
        $cameraIds = [];
        $featured = [];
        foreach ($sources as $i => $src) {
            try {
                $img = $this->images->ingest($userId, $siteId, $src, basename($src), 82);
            } catch (\Throwable $e) {
                echo '    skipped ' . basename($src) . ': ' . $e->getMessage() . "\n";
                continue;
            }
            if ($img['capture_method'] === 'drone') {
                $droneIds[] = $img['id'];
            } else {
                $cameraIds[] = $img['id'];
            }
            if ($i < 6) {
                $featured[] = $img['id'];
            }
        }

        if ($droneIds) {
            $this->galleries->assignImages($siteId, $aerial['id'], $droneIds);
        }
        if ($cameraIds) {
            $this->galleries->assignImages($siteId, $land['id'], $cameraIds);
        }
        if ($featured && $home) {
            $this->galleries->assignImages($siteId, (int) $home['id'], $featured);
        }

        // Site home hero: slideshow of the first few featured images + reveal words.
        $header = SiteService::defaultHeader();
        $header['mode'] = 'slideshow';
        $header['image_ids'] = array_slice($featured, 0, 4);
        $header['overlay']['title'] = 'Meggen Studio';
        $header['overlay']['subtitle'] = 'Aerial & landscape photography from Lake Lucerne';
        $header['rotating_words'] = ['Above the lake', 'Golden hour', 'Alpine light'];
        Database::update('sites', ['home_header' => json_encode($header), 'published' => 1], 'id = :id', ['id' => $siteId]);

        // About page (opt-in content, created explicitly).
        $this->pages->create($siteId, [
            'type' => 'about',
            'title' => 'About',
            'content' => [
                ['type' => 'heading', 'text' => 'From a hill above Lake Lucerne'],
                ['type' => 'paragraph', 'text' => 'Meggen Studio is a small photography practice working between the shoreline of Meggen and the peaks that ring the lake. The work moves between two vantage points: the drone, high enough to read the water as a single surface, and the camera on the ground at the hour when the light turns.'],
                ['type' => 'paragraph', 'text' => 'Every frame here is delivered web-optimised — sharp on screen, quick to load, wherever you are.'],
            ],
        ]);

        echo "  demo login:  demo@fotolio.app  /  password\n";
    }

    /** @return string[] absolute paths to seed source images */
    private function pickSources(): array
    {
        $root = dirname(__DIR__, 3); // repo root
        $dir = $root . '/bigImages';
        $preferred = [
            'DJI_0553.jpg', 'DJI_0560.jpg', 'DJI_0566.jpg', 'DJI_0568.jpg',
            'DJI_0198.jpg', 'DJI_0220.jpg',
            'IMG_7411.JPG', 'IMG_7418.JPG', 'IMG_7420.JPG', 'IMG_7424.JPG',
            'SAM_3434.jpg', 'SAM_3449.jpg',
        ];
        $paths = [];
        foreach ($preferred as $name) {
            $p = "$dir/$name";
            if (is_file($p)) {
                $paths[] = $p;
            }
        }
        // Fallback: whatever is available.
        if (count($paths) < 6) {
            foreach (glob("$dir/*.{jpg,JPG,jpeg}", GLOB_BRACE) ?: [] as $p) {
                if (!in_array($p, $paths, true)) {
                    $paths[] = $p;
                }
                if (count($paths) >= 12) {
                    break;
                }
            }
        }
        return $paths;
    }
}
