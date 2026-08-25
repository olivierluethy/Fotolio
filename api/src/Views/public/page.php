<?php
/** @var array $site @var array $current @var bool $editable @var \Fotolio\Services\PublicRenderer $r */
$editable = $editable ?? false;
$blocks = $current['content'] ?? [];
$ce = fn (string $path) => $editable ? ' data-editable="' . $path . '" contenteditable="true" spellcheck="false"' : '';
// Text alignment shared by heading/subheading/paragraph/quote blocks.
$align = function (array $b): string {
    $a = $b['align'] ?? '';
    return in_array($a, ['left', 'center', 'right'], true) ? 'text-align:' . $a . ';' : '';
};
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
              case 'heading':
                  $lvl = max(1, min(6, (int) ($block['level'] ?? 2)));
                  $htag = 'h' . $lvl; ?>
                  <<?= $htag ?> style="<?= $align($block) ?>"<?= $ce('block:' . $i) ?>><?= $r->e($block['text'] ?? '') ?></<?= $htag ?>>
              <?php break;
              case 'subheading': ?>
                  <h3 style="<?= $align($block) ?>"<?= $ce('block:' . $i) ?>><?= $r->e($block['text'] ?? '') ?></h3>
              <?php break;
              case 'quote': ?>
                  <blockquote style="border-left:3px solid var(--accent);padding-left:18px;color:var(--ink-muted);font-size:1.2rem;margin:1.4em 0;<?= $align($block) ?>"<?= $ce('block:' . $i) ?>><?= $r->e($block['text'] ?? '') ?></blockquote>
              <?php break;
              case 'table':
                  $rows = is_array($block['rows'] ?? null) ? $block['rows'] : [];
                  $hasHeader = !empty($block['header']);
                  if ($rows || $editable): ?>
                    <div class="table-wrap">
                      <table class="prose-table">
                        <?php foreach ($rows as $ri => $row): $cellTag = ($hasHeader && $ri === 0) ? 'th' : 'td'; ?>
                          <tr>
                            <?php foreach ((array) $row as $cell): ?>
                              <<?= $cellTag ?>><?= $r->e((string) $cell) ?></<?= $cellTag ?>>
                            <?php endforeach ?>
                          </tr>
                        <?php endforeach ?>
                      </table>
                    </div>
                  <?php endif;
              break;
              case 'image':
              case 'figure':
                  $src = $block['src'] ?? '';
                  if ($src):
                      $a = $block['align'] ?? 'center';
                      $figStyle = 'display:block;';
                      if ($a === 'left') { $figStyle .= 'margin-right:auto;margin-left:0;'; }
                      elseif ($a === 'right') { $figStyle .= 'margin-left:auto;margin-right:0;'; }
                      elseif ($a === 'full') { $figStyle .= 'width:100%;max-width:none;'; }
                      else { $figStyle .= 'margin-left:auto;margin-right:auto;'; }
                      $w = (int) ($block['width'] ?? 100);
                      if ($a !== 'full' && $w > 0 && $w < 100) { $figStyle .= 'max-width:' . $w . '%;'; }
                      $bd = is_array($block['border'] ?? null) ? $block['border'] : [];
                      $imgStyle = '';
                      $bw = max(0, (int) ($bd['width'] ?? 0));
                      if ($bw > 0) { $imgStyle .= 'border:' . $bw . 'px solid ' . ($bd['color'] ?? '' ?: 'var(--border)') . ';'; }
                      $br = max(0, (int) ($bd['radius'] ?? 0));
                      if ($br > 0) { $imgStyle .= 'border-radius:' . $br . 'px;' . 'overflow:hidden;'; }
                      ?>
                    <figure class="fig-align-<?= $r->e($a) ?>" style="<?= $figStyle ?>">
                      <img src="<?= $r->e($src) ?>" alt="<?= $r->e($block['caption'] ?? '') ?>" loading="lazy"<?= $imgStyle ? ' style="' . $imgStyle . '"' : '' ?>>
                      <?php if (!empty($block['caption']) || $editable): ?><figcaption<?= $editable ? ' data-editable="block:' . $i . ':caption" contenteditable="true" spellcheck="false" data-placeholder="Add a caption…"' : '' ?>><?= $r->e($block['caption'] ?? '') ?></figcaption><?php endif ?>
                    </figure>
                  <?php endif;
              break;
              default: ?>
                  <p style="<?= $editable ? 'white-space:pre-wrap;' : '' ?><?= $align($block) ?>"<?= $ce('block:' . $i) ?>><?= $editable ? $r->e($block['text'] ?? '') : nl2br($r->e($block['text'] ?? '')) ?></p>
              <?php endswitch;
          if ($editable) {
              echo '<button class="block-remove" type="button" data-block-remove="' . $i . '" aria-label="Remove block">&#10005;</button></div>';
          }
      endforeach ?>
      <?php if (empty($blocks) && !$editable): ?>
        <p>This page is being written.</p>
      <?php endif ?>
      <?php if ($editable && empty($blocks)): ?>
        <p class="prose-empty-hint">This page is empty. Use the panel to add a heading, paragraph, quote, table or image — they appear right here.</p>
      <?php endif ?>
    </div>
  </div>
</div>
