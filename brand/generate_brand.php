<?php
/**
 * Fotolio brand asset generator.
 * Produces the aperture mark (SVG), wordmark (SVG) and rasterised favicon/app-icon PNGs.
 * Pure geometry — no external rasteriser required (draws with GD at 4x then downsamples).
 *
 * Run:  php brand/generate_brand.php
 */

$root = dirname(__DIR__);

/* ---- Aperture geometry (viewBox 0 0 100 100, centre 50,50) ---------------- */
function aperture_paths(float $cx, float $cy, float $rO, float $rI, float $rot = 0.0): array {
    $inner = [];
    $blades = [];
    for ($i = 0; $i < 6; $i++) {
        $a  = deg2rad(60 * $i + 30 + $rot);
        $a2 = deg2rad(60 * $i + 90 + $rot); // +60deg -> pinwheel
        $px = $cx + $rI * cos($a);   $py = $cy + $rI * sin($a);
        $qx = $cx + $rO * cos($a2);  $qy = $cy + $rO * sin($a2);
        $inner[] = [$px, $py];
        $blades[] = [[$px, $py], [$qx, $qy]];
    }
    return ['inner' => $inner, 'blades' => $blades];
}

/* ---- SVG mark ------------------------------------------------------------- */
function aperture_svg(bool $withRing = true): string {
    $g = aperture_paths(50, 50, 42, 20);
    $hex = 'M';
    foreach ($g['inner'] as $k => $p) {
        $hex .= ($k ? ' L' : ' ') . round($p[0], 2) . ' ' . round($p[1], 2);
    }
    $hex .= ' Z';
    $blades = '';
    foreach ($g['blades'] as $b) {
        $blades .= sprintf(
            '<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f"/>',
            $b[0][0], $b[0][1], $b[1][0], $b[1][1]
        );
    }
    $ring = $withRing ? '<circle cx="50" cy="50" r="42"/>' : '';
    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"
     stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"
     role="img" aria-label="Fotolio aperture mark">
  {$ring}
  <path d="{$hex}"/>
  {$blades}
</svg>
SVG;
}

/* ---- Wordmark SVG --------------------------------------------------------- */
function wordmark_svg(): string {
    // Aperture mark + "Fotolio" set in Archivo (falls back cleanly if unavailable).
    $mark = aperture_paths(20, 26, 17, 8);
    $hex = 'M';
    foreach ($mark['inner'] as $k => $p) { $hex .= ($k ? ' L' : ' ') . round($p[0], 2) . ' ' . round($p[1], 2); }
    $hex .= ' Z';
    $blades = '';
    foreach ($mark['blades'] as $b) {
        $blades .= sprintf('<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f"/>', $b[0][0], $b[0][1], $b[1][0], $b[1][1]);
    }
    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 52" fill="none" role="img" aria-label="Fotolio">
  <g stroke="var(--accent, #0E7C86)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="20" cy="26" r="17"/>
    <path d="{$hex}"/>
    {$blades}
  </g>
  <text x="48" y="35" font-family="Archivo, 'Segoe UI', system-ui, sans-serif"
        font-size="30" font-weight="800" letter-spacing="0.5" fill="var(--ink, #16181D)">Fotolio</text>
</svg>
SVG;
}

/* ---- GD rasteriser -------------------------------------------------------- */
function render_png(int $size, string $out, array $tile, array $mark, bool $rounded = true): void {
    $ss = 4; $S = $size * $ss;
    $im = imagecreatetruecolor($S, $S);
    imagesavealpha($im, true);
    imagealphablending($im, false);
    imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 0, 0, 127));
    imagealphablending($im, true);
    imageantialias($im, true);

    $bg = imagecolorallocate($im, $tile[0], $tile[1], $tile[2]);
    // rounded-square tile
    $r = $rounded ? (int)($S * 0.22) : 0;
    imagefilledrectangle($im, $r, 0, $S - $r, $S, $bg);
    imagefilledrectangle($im, 0, $r, $S, $S - $r, $bg);
    if ($rounded) {
        foreach ([[$r,$r],[$S-$r,$r],[$r,$S-$r],[$S-$r,$S-$r]] as $c) {
            imagefilledellipse($im, $c[0], $c[1], $r*2, $r*2, $bg);
        }
    }

    $stroke = imagecolorallocate($im, $mark[0], $mark[1], $mark[2]);
    $g = aperture_paths($S/2, $S/2, $S*0.32, $S*0.155);
    imagesetthickness($im, max(2, (int)($S * 0.042)));

    // ring
    imagearc($im, (int)($S/2), (int)($S/2), (int)($S*0.64), (int)($S*0.64), 0, 360, $stroke);
    // hex opening
    $pts = [];
    foreach ($g['inner'] as $p) { $pts[] = $p[0]; $pts[] = $p[1]; }
    imagepolygon($im, $pts, $stroke);
    // blades
    foreach ($g['blades'] as $b) {
        imageline($im, (int)$b[0][0], (int)$b[0][1], (int)$b[1][0], (int)$b[1][1], $stroke);
    }

    $final = imagecreatetruecolor($size, $size);
    imagesavealpha($final, true);
    imagealphablending($final, false);
    imagefill($final, 0, 0, imagecolorallocatealpha($final, 0, 0, 0, 127));
    imagecopyresampled($final, $im, 0, 0, 0, 0, $size, $size, $S, $S);
    imagepng($final, $out);
    imagedestroy($im); imagedestroy($final);
    echo "  wrote $out ($size)\n";
}

/* ---- Emit ----------------------------------------------------------------- */
@mkdir("$root/brand", 0775, true);
file_put_contents("$root/brand/aperture.svg", aperture_svg(true));
file_put_contents("$root/brand/aperture-mark.svg", aperture_svg(false));
file_put_contents("$root/brand/wordmark.svg", wordmark_svg());
echo "wrote SVGs\n";

// Graphite tile, teal mark (matches --bg dark tile + accent).
$tile = [14, 15, 18];      // #0E0F12
$teal = [0x22, 0xB8, 0xC4]; // dark-theme accent

$targets = [
    "$root/dashboard/public",
    "$root/api/public",
];
foreach ($targets as $dir) {
    @mkdir($dir, 0775, true);
    render_png(16,  "$dir/favicon-16.png",  $tile, $teal);
    render_png(32,  "$dir/favicon-32.png",  $tile, $teal);
    render_png(180, "$dir/apple-touch-icon.png", $tile, $teal);
    render_png(192, "$dir/icon-192.png",    $tile, $teal);
    render_png(512, "$dir/icon-512.png",    $tile, $teal);
}
// SVG favicon (source of truth) — teal mark on transparent, theme-adaptive via currentColor set to teal.
$favSvg = str_replace('stroke="currentColor"', 'stroke="#22B8C4"', aperture_svg(true));
foreach ($targets as $dir) { file_put_contents("$dir/favicon.svg", $favSvg); }
echo "done.\n";
