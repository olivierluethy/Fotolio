<?php
/** @var array $site @var array $navGalleries @var string $view @var bool $editable @var \Fotolio\Services\PublicRenderer $r */
$editable = $editable ?? false;
// Live: only render when there is at least one gallery in the nav.
// Edit: always render the container so items can animate in/out as the
// "Show in site navigation" toggle is flipped.
if (!$editable && count($navGalleries) === 0) {
    return;
}
?>
<nav class="subnav<?= $editable ? ' is-editable' : '' ?>" aria-label="Galleries" data-edit-region="subnav">
  <div class="wrap">
    <a href="<?= $r->e($r->url($site)) ?>" class="<?= $view === 'home' ? 'active' : '' ?>" data-nav-home>Home</a>
    <?php foreach ($navGalleries as $g): if ($g['is_home']) continue; ?>
      <a href="<?= $r->e($r->url($site, $g['slug'])) ?>"
         class="<?= ($current['slug'] ?? '') === $g['slug'] && $view === 'gallery' ? 'active' : '' ?>"
         <?= $editable ? 'data-nav-item data-gallery-id="' . (int) $g['id'] . '"' : '' ?>><?= $r->e($g['name']) ?></a>
    <?php endforeach ?>
  </div>
</nav>
