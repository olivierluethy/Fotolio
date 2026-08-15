<?php
/** @var array $header @var array $headerImages @var array $site @var bool $editable @var \Fotolio\Services\PublicRenderer $r */
$editable = $editable ?? false;
if (empty($header) || empty($headerImages)) {
    return;
}
$overlay = $header['overlay'] ?? [];
$mode = $header['mode'] ?? 'single';
$slideshow = $header['slideshow'] ?? ['autoplay' => true, 'interval' => 5000, 'controls' => true];
$height = $header['height'] ?? 'tall';
$parallax = !empty($header['parallax']);
$animate = !empty($header['animate_text']);
$words = $header['rotating_words'] ?? [];
$pos = $overlay['position'] ?? 'center';
$align = $overlay['align'] ?? 'center';
$title = $overlay['title'] ?: $site['title'];
$subtitle = $overlay['subtitle'] ?? '';
$isShow = $mode === 'slideshow' && count($headerImages) > 1;
$ed = fn (string $attrs) => $editable ? $attrs : '';
?>
<section class="hero h-<?= $r->e($height) ?>" <?= $ed('data-edit-region="hero"') ?>
  <?= $isShow ? 'data-slideshow data-interval="' . (int)($slideshow['interval'] ?? 5000) . '" data-autoplay="' . (!empty($slideshow['autoplay']) ? '1' : '0') . '"' : '' ?>
  <?= $parallax ? 'data-parallax' : '' ?>>
  <div class="hero-slides">
    <?php foreach ($headerImages as $idx => $img):
        $src = $img['variants']['large']['jpg'] ?? '';
        $webp = $img['variants']['large']['webp'] ?? $src; ?>
      <div class="hero-slide <?= $idx === 0 ? 'active' : '' ?>" style="background-image:url('<?= $r->e($webp) ?>')"></div>
    <?php endforeach ?>
  </div>

  <div class="hero-inner pos-<?= $r->e($pos) ?>">
    <div class="hero-content align-<?= $r->e($align) ?><?= !empty($overlay['panel']) ? ' has-panel' : '' ?>">
      <h1 <?= $ed('data-editable="hero.title" contenteditable="true" spellcheck="false"') ?>><?= $r->e($title) ?></h1>
      <?php if ($subtitle || $editable): ?>
        <p class="subtitle<?= $subtitle ? '' : ' is-empty' ?>" <?= $ed('data-editable="hero.subtitle" contenteditable="true" spellcheck="false" data-placeholder="Add a subtitle…"') ?>><?= $r->e($subtitle) ?></p>
      <?php endif ?>
      <?php if ($animate && $words): ?>
        <div class="rotator" data-rotator>
          <?php foreach ($words as $w): ?><span class="word"><?= $r->e($w) ?></span><?php endforeach ?>
        </div>
      <?php endif ?>
    </div>
  </div>

  <?php if ($isShow && !empty($slideshow['controls'])): ?>
    <div class="hero-dots">
      <?php foreach ($headerImages as $idx => $_): ?><button class="<?= $idx === 0 ? 'active' : '' ?>" aria-label="Slide <?= $idx + 1 ?>"></button><?php endforeach ?>
    </div>
    <div class="hero-controls">
      <button data-prev aria-label="Previous slide">&#8249;</button>
      <button data-next aria-label="Next slide">&#8250;</button>
    </div>
  <?php endif ?>

  <?php if ($editable): ?><button class="fx-edit-hint" data-edit-open="hero" type="button"><span class="fx-dot"></span> Edit hero</button><?php endif ?>
</section>
