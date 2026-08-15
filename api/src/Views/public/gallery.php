<?php
/** @var array $site @var ?array $current @var array $images @var string $view @var bool $editable @var \Fotolio\Services\PublicRenderer $r */
$editable = $editable ?? false;
$isGallery = $view === 'gallery' && $current;
$heading = $isGallery ? $current['name'] : 'Selected work';
$desc = $isGallery ? ($current['description'] ?? '') : ($site['tagline'] ?? '');
$region = $isGallery ? 'data-edit-region="gallery" data-gallery-id="' . (int) $current['id'] . '"' : 'data-edit-region="home-grid"';
?>
<div class="section" <?= $editable ? $region : '' ?>>
  <div class="wrap">
    <div class="section-head"<?= $editable ? '' : ' data-reveal' ?>>
      <div class="eyebrow"><?= $view === 'home' ? 'Portfolio' : 'Gallery' ?></div>
      <?php if ($editable && $isGallery): ?>
        <h2 data-editable="gallery.name" contenteditable="true" spellcheck="false"><?= $r->e($heading) ?></h2>
        <p class="<?= $desc ? '' : 'is-empty' ?>" data-editable="gallery.description" contenteditable="true" spellcheck="false" data-placeholder="Add a short description shown on the gallery page…"><?= $r->e($desc) ?></p>
      <?php else: ?>
        <h2><?= $r->e($heading) ?></h2>
        <?php if ($desc): ?><p><?= $r->e($desc) ?></p><?php endif ?>
      <?php endif ?>
    </div>

    <?php if (empty($images)): ?>
      <div class="empty">
        <h3>No photographs here yet</h3>
        <p><?= $editable ? 'Add photos to this gallery from the panel on the left.' : 'This gallery is still being curated. Check back soon.' ?></p>
      </div>
    <?php else: ?>
      <div class="grid" <?= $editable ? 'data-photo-grid' : '' ?>>
        <?php foreach ($images as $img):
            $full = $img['variants']['large']['jpg'] ?? '';
            $loc = $img['location'] ?: '';
            $method = $img['capture_method']; ?>
          <figure class="tile<?= $editable ? ' is-editable' : '' ?>"
            <?php if (!$editable): ?>data-lightbox<?php else: ?>data-image-id="<?= (int) $img['id'] ?>"<?php endif ?>
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
