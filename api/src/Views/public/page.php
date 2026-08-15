<?php
/** @var array $site @var array $current @var bool $editable @var \Fotolio\Services\PublicRenderer $r */
$editable = $editable ?? false;
$blocks = $current['content'] ?? [];
$ce = fn (string $path) => $editable ? ' data-editable="' . $path . '" contenteditable="true" spellcheck="false"' : '';
?>
<div class="section" <?= $editable ? 'data-edit-region="page" data-page-id="' . (int) $current['id'] . '"' : '' ?>>
  <div class="wrap">
    <div class="prose<?= $editable ? ' is-editable' : '' ?>"<?= $editable ? '' : ' data-reveal' ?>>
      <div class="eyebrow" style="margin-bottom:12px"><?= $r->e($current['type'] === 'about' ? 'About' : 'Page') ?></div>
      <h1 style="font-family:var(--font-display);font-size:clamp(1.9rem,4vw,2.6rem);letter-spacing:-.5px;margin-bottom:.4em"<?= $ce('page.title') ?>><?= $r->e($current['title']) ?></h1>
      <?php foreach ($blocks as $i => $block):
          $type = $block['type'] ?? 'paragraph';
          $wrap = $editable ? '<div class="block-wrap" data-block-index="' . $i . '" data-block-type="' . $r->e($type) . '">' : '';
          echo $wrap;
          switch ($type):
              case 'heading': ?>
                  <h2<?= $ce('block:' . $i) ?>><?= $r->e($block['text'] ?? '') ?></h2>
              <?php break;
              case 'subheading': ?>
                  <h3<?= $ce('block:' . $i) ?>><?= $r->e($block['text'] ?? '') ?></h3>
              <?php break;
              case 'quote': ?>
                  <blockquote style="border-left:3px solid var(--accent);padding-left:18px;color:var(--ink-muted);font-size:1.2rem;margin:1.4em 0"<?= $ce('block:' . $i) ?>><?= $r->e($block['text'] ?? '') ?></blockquote>
              <?php break;
              case 'image':
              case 'figure':
                  $src = $block['src'] ?? '';
                  if ($src): ?>
                    <figure>
                      <img src="<?= $r->e($src) ?>" alt="<?= $r->e($block['caption'] ?? '') ?>" loading="lazy">
                      <?php if (!empty($block['caption']) || $editable): ?><figcaption<?= $editable ? ' data-editable="block:' . $i . ':caption" contenteditable="true" spellcheck="false" data-placeholder="Add a caption…"' : '' ?>><?= $r->e($block['caption'] ?? '') ?></figcaption><?php endif ?>
                    </figure>
                  <?php endif;
              break;
              default: ?>
                  <p style="<?= $editable ? 'white-space:pre-wrap' : '' ?>"<?= $ce('block:' . $i) ?>><?= $editable ? $r->e($block['text'] ?? '') : nl2br($r->e($block['text'] ?? '')) ?></p>
              <?php endswitch;
          if ($editable) {
              echo '<button class="block-remove" type="button" data-block-remove="' . $i . '" aria-label="Remove block">&#10005;</button></div>';
          }
      endforeach ?>
      <?php if (empty($blocks) && !$editable): ?>
        <p>This page is being written.</p>
      <?php endif ?>
      <?php if ($editable && empty($blocks)): ?>
        <p class="prose-empty-hint">This page is empty. Use the panel to add a heading, paragraph, quote or image — they appear right here.</p>
      <?php endif ?>
    </div>
  </div>
</div>
