/**
 * Génère des PNG placeholder (palette GAME_DA_SPEC.md) dans src/assets/game/.
 * Usage: node tools/generate-game-placeholders.js
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..', 'src', 'assets', 'game');

const C = {
  ink: [44, 36, 51, 255],
  cream: [250, 246, 241, 255],
  creamSol: [232, 221, 208, 255],
  gold: [201, 165, 92, 255],
  sage: [171, 188, 166, 255],
  brick: [156, 76, 76, 255],
  stone: [107, 101, 96, 255],
  wood: [92, 64, 51, 255],
  skin: [232, 196, 168, 255],
  coat: [75, 134, 197, 255],
  shadow: [27, 24, 33, 255],
  trans: [0, 0, 0, 0],
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writePng(filePath, w, h, pixel) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const [r, g, b, a] = pixel(x, y);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function main() {
  ensureDir(ROOT);

  // --- Tile 32x32 : cour pavée (tileable) ---
  writePng(path.join(ROOT, 'tilesets', 'tile-courtyard.png'), 32, 32, (x, y) => {
    const a = ((x >> 3) + (y >> 3)) % 2;
    return a ? C.stone : C.creamSol;
  });

  // --- Tile 32x32 : bordure / accent or ---
  writePng(path.join(ROOT, 'tilesets', 'tile-border.png'), 32, 32, (x, y) => {
    const edge = x < 2 || y < 2 || x > 29 || y > 29;
    if (edge) return C.gold;
    return C.creamSol;
  });

  // --- Joueur top-down 28x32 ---
  const pw = 28;
  const ph = 32;
  writePng(path.join(ROOT, 'sprites', 'player-top.png'), pw, ph, (x, y) => {
    const cx = pw / 2;
    const cy = ph / 2 + 2;
    const r = dist(x, y, cx, cy);
    if (r < 5 && y < cy) return C.skin; // tête
    if (r < 11 && y >= cy - 2) return C.gold; // robe / manteau
    if (r < 12 && y >= cy - 2) return C.ink; // contour léger
    return C.trans;
  });

  // --- PNJ majordome top 28x36 ---
  const nw = 28;
  const nh = 36;
  writePng(path.join(ROOT, 'sprites', 'npc-majordome-top.png'), nw, nh, (x, y) => {
    const cx = nw / 2;
    const cy = nh / 2 + 2;
    const r = dist(x, y, cx, cy);
    if (r < 5 && y < cy - 2) return C.skin;
    if (r < 13) return C.coat;
    if (r < 14) return C.ink;
    return C.trans;
  });

  // --- Portrait générique (silhouette blanche pour tint) 48x48 ---
  writePng(path.join(ROOT, 'portraits', 'portrait-generic.png'), 48, 48, (x, y) => {
    const cx = 24;
    const cy = 26;
    const r = dist(x, y, cx, cy);
    if (r < 14 && y < 30) return [255, 255, 255, 255];
    if (r < 22 && y >= 22) return [255, 255, 255, 220];
    return C.trans;
  });

  // --- Portrait majordome 48x48 ---
  writePng(path.join(ROOT, 'portraits', 'portrait-majordome.png'), 48, 48, (x, y) => {
    const cx = 24;
    const cy = 22;
    const r = dist(x, y, cx, cy);
    if (r < 10) return C.skin;
    if (x > 14 && x < 34 && y > 28 && y < 44) return C.coat;
    if (r < 20 && y > 18) return C.coat;
    return C.trans;
  });

  // --- Archétypes 24x38 (silhouettes) ---
  const arch = [
    { name: 'archetype-lady', dress: [201, 120, 140, 255] },
    { name: 'archetype-gentleman', dress: [75, 134, 197, 255] },
    { name: 'archetype-reine', dress: [160, 80, 200, 255] },
    { name: 'archetype-duc', dress: [120, 90, 70, 255] },
  ];
  const aw = 24;
  const ah = 38;
  for (const a of arch) {
    writePng(path.join(ROOT, 'sprites', `${a.name}.png`), aw, ah, (x, y) => {
      const cx = aw / 2;
      const cy = ah / 2 + 2;
      const r = dist(x, y, cx, cy);
      if (r < 4 && y < cy) return C.skin;
      if (r < 9 && y >= cy - 2) return a.dress;
      if (r < 10 && y >= cy - 2) return C.ink;
      return C.trans;
    });
  }

  // --- Acte 0 : fonds parallax (larges bandes tileables horizontalement, 512px de large) ---
  const pW = 512;
  const pH = 540;
  writePng(path.join(ROOT, 'backgrounds', 'acte0-parallax-lointain.png'), pW, pH, (x, y) => {
    const u = (x % 256) / 256;
    const a = 55 + Math.sin(u * Math.PI * 2) * 12;
    const b = 70 + Math.cos(u * Math.PI * 2) * 10;
    return [Math.floor(a), Math.floor(b), 110, 255];
  });
  writePng(path.join(ROOT, 'backgrounds', 'acte0-parallax-proche.png'), pW, pH, (x, y) => {
    const u = (x % 256) / 256;
    const a = 130 + Math.sin(u * Math.PI * 4) * 25;
    const b = 95 + Math.cos(u * Math.PI * 4) * 25;
    const c = 70 + Math.sin(u * Math.PI * 2) * 15;
    return [Math.floor(a), Math.floor(b), Math.floor(c), 255];
  });

  const carrossePath = path.join(ROOT, 'backgrounds', 'acte0-carrosse.png');
  if (!fs.existsSync(carrossePath)) {
    writePng(carrossePath, 960, 540, () => C.trans);
  }

  // --- maps / ui : .gitkeep pour structure ---
  for (const sub of ['maps', 'ui']) {
    const d = path.join(ROOT, sub);
    ensureDir(d);
    const gitkeep = path.join(d, '.gitkeep');
    if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, '');
  }

  console.log('Wrote placeholder PNGs to', ROOT);
}

main();
