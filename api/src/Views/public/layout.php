<?php
/** @var array $site @var array $navGalleries @var array $navPages @var string $view @var \Fotolio\Services\PublicRenderer $r */
$mode = $mode ?? 'live';
$editable = ($mode === 'edit');
$settings = $site['settings'] ?? [];
$pageTitle = $site['title'];
$metaDesc = $site['tagline'] ?? '';
if ($view === 'gallery' && $current) {
    $pageTitle = $current['name'] . ' · ' . $site['title'];
    $metaDesc = $current['description'] ?: $metaDesc;
} elseif ($view === 'page' && $current) {
    $pageTitle = $current['title'] . ' · ' . $site['title'];
}
$ogImage = '';
if (!empty($headerImages)) {
    $ogImage = $headerImages[0]['variants']['large']['jpg'] ?? '';
} elseif (!empty($images)) {
    $ogImage = $images[0]['variants']['large']['jpg'] ?? '';
}
$origin = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$overHero = in_array($view, ['home', 'gallery'], true) && !empty($headerImages);

// Editing context handed to the bridge so the parent panels know what the
// canvas is currently showing (which gallery / page / hero target).
$homeGalleryId = null;
foreach ($galleries as $g) {
    if ($g['is_home']) { $homeGalleryId = $g['id']; break; }
}
$editCtx = [
    'view' => $view,
    'slug' => $current['slug'] ?? '',
    'galleryId' => $view === 'gallery' && $current ? $current['id'] : ($view === 'home' ? $homeGalleryId : null),
    'pageId' => $view === 'page' && $current ? $current['id'] : null,
    'heroTarget' => $view === 'home' ? 'home'
        : ($view === 'gallery' && $current ? 'gallery:' . $current['id']
        : ($view === 'page' && $current ? 'page:' . $current['id'] : 'home')),
    'hasHero' => $overHero,
];
$subviewData = compact('site', 'navGalleries', 'navPages', 'view', 'current', 'images', 'header', 'headerImages', 'mode', 'editable') + ['r' => $r];
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $r->e($pageTitle) ?></title>
<meta name="description" content="<?= $r->e($metaDesc) ?>">
<?php if (!$editable): ?>
<meta property="og:type" content="website">
<meta property="og:title" content="<?= $r->e($pageTitle) ?>">
<meta property="og:description" content="<?= $r->e($metaDesc) ?>">
<?php if ($ogImage): ?><meta property="og:image" content="<?= $r->e($origin . $ogImage) ?>">
<meta name="twitter:card" content="summary_large_image"><?php endif ?>
<?php endif ?>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/theme.css">
<?php if ($editable): ?><link rel="stylesheet" href="/assets/editor.css"><?php endif ?>
<?php if (!empty($site['accent'])): ?><style>:root{--accent:<?= $r->e($site['accent']) ?>;}</style><?php endif ?>
</head>
<body class="<?= $editable ? 'is-editing' : '' ?>" data-fotolio-mode="<?= $r->e($mode) ?>">

<header class="topnav <?= $overHero ? 'over-hero' : 'solid' ?>">
  <div class="wrap">
    <a class="brand" href="<?= $r->e($r->url($site)) ?>"<?= $editable ? ' data-nav-block' : '' ?>>
      <svg class="mark" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="42"/><path d="M67.3 42 L50 32 L32.7 42 L32.7 62 L50 72 L67.3 62 Z"/><path d="M50 32 L58.7 26"/><path d="M67.3 42 L76 47"/><path d="M67.3 62 L76 57"/><path d="M50 72 L41.3 78"/><path d="M32.7 62 L24 67"/><path d="M32.7 42 L24 37"/></svg>
      <?= $r->e($site['title']) ?>
    </a>
    <button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <ul class="nav-links">
      <li><a href="<?= $r->e($r->url($site)) ?>" class="<?= $view === 'home' ? 'active' : '' ?>">Home</a></li>
      <?php foreach ($navPages as $p): ?>
        <li><a href="<?= $r->e($r->url($site, $p['slug'])) ?>" class="<?= ($current['slug'] ?? '') === $p['slug'] && $view === 'page' ? 'active' : '' ?>"<?= $editable ? ' data-nav-page="' . (int) $p['id'] . '"' : '' ?>><?= $r->e($p['title']) ?></a></li>
      <?php endforeach ?>
    </ul>
  </div>
</header>

<?php if (in_array($view, ['home', 'gallery'], true)): ?>
  <?= $r->view('_hero', $subviewData) ?>
<?php endif ?>

<?= $r->view('_subnav', $subviewData) ?>

<main>
  <?php if ($view === 'home' || $view === 'gallery'): ?>
    <?= $r->view('gallery', $subviewData) ?>
  <?php else: ?>
    <?= $r->view('page', $subviewData) ?>
  <?php endif ?>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div>
      <div class="brand" style="font-size:16px"><?= $r->e($site['title']) ?></div>
      <?php if (!empty($settings['footer'])): ?><div class="madeby" style="margin-top:6px"><?= $r->e($settings['footer']) ?></div><?php endif ?>
    </div>
    <div class="socials">
      <?php foreach (($settings['social'] ?? []) as $label => $href): if (!$href) continue; ?>
        <a href="<?= $r->e(str_contains((string)$href, '@') ? 'mailto:' . $href : $href) ?>" target="_blank" rel="noopener"><?= $r->e(ucfirst($label)) ?></a>
      <?php endforeach ?>
    </div>
    <div class="madeby">Made with Fotolio</div>
  </div>
</footer>

<script src="/assets/theme.js" defer></script>
<?php if ($editable): ?>
<script>window.__FOTOLIO_EDIT__ = <?= json_encode($editCtx, JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="/assets/editor-bridge.js" defer></script>
<?php elseif ($mode === 'live'): ?>
<script>window.__FOTOLIO_SITE__ = <?= json_encode(['id' => (int) $site['id']], JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="/assets/analytics.js" defer></script>
<?php endif ?>
</body>
</html>
