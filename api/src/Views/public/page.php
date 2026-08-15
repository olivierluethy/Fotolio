<?php
/** @var array $site @var array $current @var \Fotolio\Services\PublicRenderer $r */
$blocks = $current['content'] ?? [];
?>
<div class="section">
  <div class="wrap">
    <div class="prose" data-reveal>
      <div class="eyebrow" style="margin-bottom:12px"><?= $r->e($current['type'] === 'about' ? 'About' : 'Page') ?></div>
      <h1 style="font-family:var(--font-display);font-size:clamp(1.9rem,4vw,2.6rem);letter-spacing:-.5px;margin-bottom:.4em"><?= $r->e($current['title']) ?></h1>
      <?php foreach ($blocks as $block):
          $type = $block['type'] ?? 'paragraph';
          switch ($type):
              case 'heading': ?>
                  <h2><?= $r->e($block['text'] ?? '') ?></h2>
              <?php break;
              case 'subheading': ?>
                  <h3><?= $r->e($block['text'] ?? '') ?></h3>
              <?php break;
              case 'quote': ?>
                  <blockquote style="border-left:3px solid var(--accent);padding-left:18px;color:var(--ink-muted);font-size:1.2rem;margin:1.4em 0"><?= $r->e($block['text'] ?? '') ?></blockquote>
              <?php break;
              case 'image':
              case 'figure':
                  $src = $block['src'] ?? '';
                  if ($src): ?>
                    <figure>
                      <img src="<?= $r->e($src) ?>" alt="<?= $r->e($block['caption'] ?? '') ?>" loading="lazy">
                      <?php if (!empty($block['caption'])): ?><figcaption><?= $r->e($block['caption']) ?></figcaption><?php endif ?>
                    </figure>
                  <?php endif;
              break;
              default: ?>
                  <p><?= nl2br($r->e($block['text'] ?? '')) ?></p>
              <?php endswitch;
      endforeach ?>
      <?php if (empty($blocks)): ?>
        <p>This page is being written.</p>
      <?php endif ?>
    </div>
  </div>
</div>
