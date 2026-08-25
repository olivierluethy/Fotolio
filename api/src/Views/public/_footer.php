<?php
/** @var array $site @var array $footer @var bool $editable @var \Fotolio\Services\PublicRenderer $r */

use Fotolio\Services\FooterService;

$editable = $editable ?? false;
$f = $footer ?? FooterService::resolve(is_array($site['settings'] ?? null) ? $site['settings'] : []);
$st = $f['style'];
$cols = $f['columns'];

$fam = ['ui' => 'var(--font-ui)', 'display' => 'var(--font-display)', 'mono' => 'var(--font-mono)'][$st['font_family']] ?? 'var(--font-ui)';
$style = 'font-family:' . $fam . ';';
$style .= 'text-align:' . $st['align'] . ';';
if (!empty($st['bg'])) { $style .= 'background-color:' . $r->e($st['bg']) . ';'; }
if (!empty($st['color'])) { $style .= 'color:' . $r->e($st['color']) . ';'; }
if (!empty($st['link_color'])) { $style .= '--footer-link:' . $r->e($st['link_color']) . ';'; }
if ((int) $st['font_size']) { $style .= 'font-size:' . (int) $st['font_size'] . 'px;'; }
if ((int) $st['font_weight']) { $style .= 'font-weight:' . (int) $st['font_weight'] . ';'; }
$py = (int) $st['padding_y'];
$style .= 'padding-top:' . $py . 'px;padding-bottom:' . $py . 'px;';
$bw = max(0, (int) $st['border_top_width']);
$style .= 'border-top:' . $bw . 'px solid ' . ($st['border_top_color'] !== '' ? $r->e($st['border_top_color']) : 'var(--border)') . ';';

$n = max(1, count($cols));
$grid = 'grid-template-columns:repeat(' . $n . ',minmax(0,1fr));';

$blockEmpty = true;
foreach ($cols as $c) { if (!empty($c['blocks'])) { $blockEmpty = false; break; } }
?>
<footer class="site-footer" data-align="<?= $r->e($st['align']) ?>" style="<?= $style ?>"<?= $editable ? ' data-edit-region="footer"' : '' ?>>
  <div class="wrap">
    <div class="footer-cols" style="<?= $grid ?>">
      <?php foreach ($cols as $ci => $col): ?>
        <div class="footer-col" <?= $editable ? 'data-fcol="' . $ci . '"' : '' ?>>
          <?php foreach (($col['blocks'] ?? []) as $bi => $block):
              $type = $block['type'] ?? 'text';
              if ($editable) {
                  echo '<div class="footer-block footer-block-wrap" data-fcol="' . $ci . '" data-fblock="' . $bi . '" data-block-type="footer-' . $r->e($type) . '">';
              }
              switch ($type):
                  case 'heading':
                      $text = $block['text'] !== '' ? $block['text'] : (($block['role'] ?? '') === 'sitename' ? ($site['title'] ?? '') : '');
                      ?>
                      <div class="footer-block footer-heading"<?= $editable ? ' data-editable="footer:' . $ci . ':' . $bi . '" contenteditable="true" spellcheck="false" data-placeholder="Heading"' : '' ?>><?= $r->e($text) ?></div>
                      <?php break;
                  case 'text':
                      $text = $block['text'] !== '' ? $block['text'] : (($block['role'] ?? '') === 'note' && !$editable ? '' : $block['text']);
                      if ($editable || $text !== ''): ?>
                      <div class="footer-block footer-text<?= ($editable && $text === '') ? ' is-empty' : '' ?>"<?= $editable ? ' data-editable="footer:' . $ci . ':' . $bi . '" contenteditable="true" spellcheck="false" data-placeholder="Add a line of text…"' : '' ?>><?= $editable ? $r->e($text) : nl2br($r->e($text)) ?></div>
                      <?php endif; break;
                  case 'links': ?>
                      <div class="footer-block footer-links<?= !empty($block['inline']) ? ' inline' : '' ?>">
                        <?php foreach (($block['items'] ?? []) as $it): if (($it['label'] ?? '') === '') continue; ?>
                          <a href="<?= $r->e($it['href'] ?: '#') ?>"<?= $editable ? '' : ' target="_blank" rel="noopener"' ?>><?= $r->e($it['label']) ?></a>
                        <?php endforeach ?>
                      </div>
                      <?php break;
                  case 'social': ?>
                      <div class="footer-block footer-social">
                        <?php foreach (($block['items'] ?? []) as $net => $val): if ($val === '') continue; ?>
                          <a href="<?= $r->e(FooterService::socialHref((string) $net, (string) $val)) ?>"<?= $editable ? '' : ' target="_blank" rel="noopener"' ?>><?= $r->e(FooterService::networkLabel((string) $net)) ?></a>
                        <?php endforeach ?>
                      </div>
                      <?php break;
                  case 'image':
                      $src = $block['src'] ?? '';
                      if ($src):
                          $img = '<img src="' . $r->e($src) . '" alt="' . $r->e($block['alt'] ?? '') . '" style="width:' . (int) $block['width'] . 'px" loading="lazy">';
                          echo '<div class="footer-block footer-image">';
                          echo !empty($block['href']) ? '<a href="' . $r->e($block['href']) . '"' . ($editable ? '' : ' target="_blank" rel="noopener"') . '>' . $img . '</a>' : $img;
                          echo '</div>';
                      endif;
                      break;
                  case 'divider': ?>
                      <hr class="footer-block footer-divider">
                      <?php break;
                  case 'spacer': ?>
                      <div class="footer-block footer-spacer" style="height:<?= (int) ($block['size'] ?? 16) ?>px"></div>
                      <?php break;
              endswitch;
              if ($editable) {
                  echo '<button class="block-remove" type="button" data-footer-remove="' . $ci . ':' . $bi . '" aria-label="Remove block">&#10005;</button></div>';
              }
          endforeach ?>
          <?php if ($editable && empty($col['blocks'])): ?>
            <div class="footer-block footer-text is-empty" style="opacity:.6">Empty column — add a block from the Footer panel.</div>
          <?php endif ?>
        </div>
      <?php endforeach ?>
    </div>
    <?php if (!empty($f['show_credit'])): ?>
      <div class="footer-credit">Made with Fotolio</div>
    <?php endif ?>
    <?php if ($editable && $blockEmpty): ?>
      <div class="footer-credit" style="opacity:.7">Your footer is empty — use the Footer panel to add columns and blocks.</div>
    <?php endif ?>
  </div>
</footer>
