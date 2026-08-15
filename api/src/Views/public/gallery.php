<?php
/** @var array $site @var ?array $current @var array $images @var string $view @var \Fotolio\Services\PublicRenderer $r */
$heading = $view === 'gallery' && $current ? $current['name'] : 'Selected work';
$desc = $view === 'gallery' && $current ? ($current['description'] ?? '') : ($site['tagline'] ?? '');
?>
<div class="section">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <div class="eyebrow"><?= $view === 'home' ? 'Portfolio' : 'Gallery' ?></div>
      <h2><?= $r->e($heading) ?></h2>
      <?php if ($desc): ?><p><?= $r->e($desc) ?></p><?php endif ?>
    </div>

    <?php if (empty($images)): ?>
      <div class="empty">
        <h3>No photographs here yet</h3>
        <p>This gallery is still being curated. Check back soon.</p>
      </div>
    <?php else: ?>
      <div class="grid">
        <?php foreach ($images as $img):
            $full = $img['variants']['large']['jpg'] ?? '';
            $loc = $img['location'] ?: '';
            $method = $img['capture_method']; ?>
          <figure class="tile" data-lightbox
            data-full="<?= $r->e($full) ?>"
            data-title="<?= $r->e($img['title']) ?>"
            data-loc="<?= $r->e($loc) ?>"
            data-alt="<?= $r->e($img['title'] ?: $loc ?: 'Photograph') ?>">
            <?php if ($method === 'drone'): ?><span class="badge">Aerial</span><?php endif ?>
            <?= $r->picture($img, '(max-width:560px) 100vw, (max-width:900px) 50vw, 33vw') ?>
            <figcaption class="cap">
              <div><?= $r->e($img['title']) ?></div>
              <?php if ($loc): ?><div class="loc"><?= $r->e($loc) ?></div><?php endif ?>
            </figcaption>
          </figure>
        <?php endforeach ?>
      </div>
    <?php endif ?>
  </div>
</div>
