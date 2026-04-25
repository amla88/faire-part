import Phaser from 'phaser';

/**
 * Moutons / poules (LPC — Daniel Eddeland, OpenGameArt « LPC style farm animals ») :
 * @see https://opengameart.org/content/lpc-style-farm-animals
 * Licence CC-BY 3.0 / GPL 2.0+ — conserver l’attribution en crédits.
 */

export const ACT4_SHEEP_WALK_KEY = 'act4-sheep-walk';
export const ACT4_SHEEP_EAT_KEY = 'act4-sheep-eat';
export const ACT4_CHICKEN_WALK_KEY = 'act4-chicken-walk';
export const ACT4_CHICKEN_EAT_KEY = 'act4-chicken-eat';

export const ACT4_SHEEP_FRAME = { w: 128, h: 128 };
export const ACT4_CHICKEN_FRAME = { w: 32, h: 32 };

/** 3 moutons, 5 poules. */
export const ACT4_SHEEP_COUNT = 3;
export const ACT4_CHICKEN_COUNT = 5;

/**
 * Pâture (rectangle en **fractions du canvas** 0–1).
 * Modifiez `left` / `top` / `width` / `height` pour placer la zone.
 */
export const ACT4_FARM_PADDOCK_FRAC = {
  left: 0.11,
  top: 0.18,
  width: 0.29,
  height: 0.21,
} as const;

/**
 * Marge intérieure (px) : les animaux restent un peu loin des bords du rect.
 */
export const ACT4_FARM_PADDOCK_INSET = 6;

/**
 * Affichage. Source : 128px/f mouton, 32px/f poule — pour un rendu comparable ~55–64px
 * mouton un peu imposant, poule nettement plus petite.
 */
export const ACT4_SHEEP_SCALE = 0.8;
export const ACT4_CHICKEN_SCALE = 0.8;

/**
 * Aperçu de la pâture : rectangle rouge translucide.
 */
export const ACT4_FARM_PADDOCK_SHOW_OVERLAY = false;

const WALK_FPS = 6.5;
const EAT_FPS = 3.2;

/**
 * Mappage direction logique (déplacement) → **index de ligne** sur le spritesheet
 * 4×4 (lignes = 0..3, chacune 4 frames).
 *
 * Logique : 0=vers le haut (Y−), 1=gauche (X−), 2=vers le bas (Y+), 3=droite (X+).
 * Le pack « LPC style farm animals » daneeklu (OpenGameArt) indique, du haut vers
 * le bas : **Haut, Gauche, Bas, Droite** : par défaut c’est l’ordre 0,1,2,3 = identité.
 * Si toutes les animations semblent montrer la même orientation, ajustez ce tableau.
 */
export const ACT4_PADDOCK_SHEET_ROW_FOR_LOGICAL: readonly [number, number, number, number] = [
  0, 1, 2, 3,
];

const ROW_UP = 0;
const _ROW_LEFT = 1;
const ROW_DOWN = 2;
const _ROW_RIGHT = 3;

/** P(eat) après une période de marche, ou enchaînement « encore grignoter ». */
const P_EAT_AFTER_WALK = 0.78;
const P_EAT_STREAK = 0.72;
/** P(marcher) après le grignotage. */
const P_WALK_AFTER_EAT = 0.18;

export type Act4PaddockKind = 'sheep' | 'chicken';

export type Act4PaddockState = {
  kind: Act4PaddockKind;
  sprite: Phaser.GameObjects.Sprite;
  mode: 'eat' | 'walk';
  /**
   * Direction **logique** 0=vers le haut, 1=gauche, 2=vers le bas, 3=droite.
   * (converti en index de ligne du pack via `ACT4_PADDOCK_SHEET_ROW_FOR_LOGICAL`.)
   */
  dir: number;
  tRemain: number;
  targetX: number;
  targetY: number;
  lastAnimKey: string;
};

export function act4PaddockBuildRect(
  width: number,
  height: number,
  inset: number
): Phaser.Geom.Rectangle {
  const c = ACT4_FARM_PADDOCK_FRAC;
  const outerW = c.width * width;
  const outerH = c.height * height;
  const x0 = c.left * width;
  const y0 = c.top * height;
  const w = Math.max(4, outerW - 2 * inset);
  const h = Math.max(4, outerH - 2 * inset);
  return new Phaser.Geom.Rectangle(x0 + inset, y0 + inset, w, h);
}

export function act4PaddockSheetRowForLogicalDir(logical: number): number {
  const i = Phaser.Math.Clamp(Math.floor(logical), 0, 3) as 0 | 1 | 2 | 3;
  return ACT4_PADDOCK_SHEET_ROW_FOR_LOGICAL[i] ?? i;
}

function rowFromVector(vx: number, vy: number, fallback: number): number {
  if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return fallback;
  if (Math.abs(vx) > Math.abs(vy)) {
    return vx > 0 ? _ROW_RIGHT : _ROW_LEFT;
  }
  return vy > 0 ? ROW_DOWN : ROW_UP;
}

function speedForKind(kind: Act4PaddockKind): number {
  return kind === 'sheep' ? 26 : 40;
}

export function act4PaddockCreateEntry(
  scene: Phaser.Scene,
  r: Phaser.Geom.Rectangle,
  kind: Act4PaddockKind
): Act4PaddockState {
  const sc = kind === 'sheep' ? ACT4_SHEEP_SCALE : ACT4_CHICKEN_SCALE;
  const tex = kind === 'sheep' ? ACT4_SHEEP_EAT_KEY : ACT4_CHICKEN_EAT_KEY;
  const x = Phaser.Math.Between(r.x + 2, Math.max(r.x + 2, r.right - 2));
  const y = Phaser.Math.Between(r.y + 2, Math.max(r.y + 2, r.bottom - 2));
  const sprite = scene.add.sprite(x, y, tex, 0).setOrigin(0.5, 1).setScale(sc);
  const dir = Phaser.Math.Between(0, 3);
  const mode: 'eat' | 'walk' = Phaser.Math.FloatBetween(0, 1) < 0.65 ? 'eat' : 'walk';
  const walkTex = kind === 'sheep' ? ACT4_SHEEP_WALK_KEY : ACT4_CHICKEN_WALK_KEY;
  const eatTex = kind === 'sheep' ? ACT4_SHEEP_EAT_KEY : ACT4_CHICKEN_EAT_KEY;

  if (mode === 'walk') {
    sprite.setTexture(walkTex);
    const tx = Phaser.Math.Between(r.x + 2, Math.max(r.x + 2, r.right - 2));
    const ty = Phaser.Math.Between(r.y + 2, Math.max(r.y + 2, r.bottom - 2));
    const row0 = rowFromVector(tx - x, ty - y, dir);
    return {
      kind,
      sprite,
      mode: 'walk',
      dir: row0,
      tRemain: Phaser.Math.FloatBetween(3.0, 7.0),
      targetX: tx,
      targetY: ty,
      lastAnimKey: '',
    };
  }
  sprite.setTexture(eatTex);
  return {
    kind,
    sprite,
    mode: 'eat',
    dir,
    tRemain: Phaser.Math.FloatBetween(1.4, 3.8),
    targetX: x,
    targetY: y,
    lastAnimKey: '',
  };
}

function pickWalkTargetInRect(r: Phaser.Geom.Rectangle, cx: number, cy: number): { tx: number; ty: number } {
  for (let i = 0; i < 10; i++) {
    const tx = Phaser.Math.Between(r.x + 1, Math.max(r.x + 1, r.right - 1));
    const ty = Phaser.Math.Between(r.y + 1, Math.max(r.y + 1, r.bottom - 1));
    if (Math.hypot(tx - cx, ty - cy) > 20) {
      return { tx, ty };
    }
  }
  return { tx: (r.x + r.right) / 2, ty: (r.y + r.bottom) / 2 };
}

/**
 * Joue l’anim (sans la redémarrer inutilement 60×/s).
 * Ne jamais appeler `setTexture` sur chaque frame : cela remet l’index à 0 et casse l’anim.
 */
function playPaddockAnim(s: Act4PaddockState, key: string): void {
  const sp = s.sprite;
  if (!sp || !sp.active) return;
  const st = sp.anims;
  if (!st) return;
  const scene = sp.scene;
  if (scene && !scene.anims.exists(key)) return;

  if (s.lastAnimKey === key) {
    if (st.isPlaying) return;
    sp.play(key, false);
    return;
  }
  s.lastAnimKey = key;
  st.stop();
  sp.play(key, false);
}

function ensurePaddockTexture(s: Act4PaddockState, textureKey: string, resetAnim: boolean): void {
  if (!s.sprite?.active) return;
  if (s.sprite.texture.key === textureKey) return;
  s.sprite.setTexture(textureKey);
  if (resetAnim) s.lastAnimKey = '';
}

/**
 * Anims 4 directions × marche + mange (4 frames / ligne) — mêmes clés d’ordre
 * que le pack LPC (ligne 0 haut → 3 bas…).
 */
export function registerAct4PaddockAnims(scene: Phaser.Scene): void {
  const def = (walkTex: string, eatTex: string, prefix: string): void => {
    for (let row = 0; row < 4; row++) {
      const start = row * 4;
      const wKey = `act4-pk-${prefix}-walk-r${row}`;
      if (!scene.anims.exists(wKey)) {
        scene.anims.create({
          key: wKey,
          frames: scene.anims.generateFrameNumbers(walkTex, { start, end: start + 3 }),
          frameRate: WALK_FPS,
          repeat: -1,
        });
      }
      const eKey = `act4-pk-${prefix}-eat-r${row}`;
      if (!scene.anims.exists(eKey)) {
        scene.anims.create({
          key: eKey,
          frames: scene.anims.generateFrameNumbers(eatTex, { start, end: start + 3 }),
          frameRate: EAT_FPS,
          repeat: -1,
        });
      }
    }
  };
  def(ACT4_SHEEP_WALK_KEY, ACT4_SHEEP_EAT_KEY, 'sh');
  def(ACT4_CHICKEN_WALK_KEY, ACT4_CHICKEN_EAT_KEY, 'ch');
}

export function act4PaddockUpdateOne(
  a: Act4PaddockState,
  r: Phaser.Geom.Rectangle,
  dt: number
): void {
  if (!a.sprite?.active) return;

  const walkTex = a.kind === 'sheep' ? ACT4_SHEEP_WALK_KEY : ACT4_CHICKEN_WALK_KEY;
  const eatTex = a.kind === 'sheep' ? ACT4_SHEEP_EAT_KEY : ACT4_CHICKEN_EAT_KEY;
  const wKeyS = (logicalDir: number) => {
    const row = act4PaddockSheetRowForLogicalDir(logicalDir);
    return a.kind === 'sheep' ? `act4-pk-sh-walk-r${row}` : `act4-pk-ch-walk-r${row}`;
  };
  const eKeyS = (logicalDir: number) => {
    const row = act4PaddockSheetRowForLogicalDir(logicalDir);
    return a.kind === 'sheep' ? `act4-pk-sh-eat-r${row}` : `act4-pk-ch-eat-r${row}`;
  };

  a.tRemain -= dt;

  if (a.mode === 'eat') {
    ensurePaddockTexture(a, eatTex, true);
    a.dir = Phaser.Math.Clamp(a.dir, 0, 3);
    playPaddockAnim(a, eKeyS(a.dir));

    if (a.tRemain > 0) return;
    a.tRemain = 0;
    if (Phaser.Math.FloatBetween(0, 1) < P_WALK_AFTER_EAT) {
      const p = pickWalkTargetInRect(r, a.sprite.x, a.sprite.y);
      a.targetX = p.tx;
      a.targetY = p.ty;
      a.dir = rowFromVector(a.targetX - a.sprite.x, a.targetY - a.sprite.y, a.dir);
      a.mode = 'walk';
      ensurePaddockTexture(a, walkTex, true);
      a.tRemain = Phaser.Math.FloatBetween(2.2, 6.5);
      playPaddockAnim(a, wKeyS(a.dir));
    } else {
      a.tRemain = Phaser.Math.FloatBetween(1.0, 3.2);
    }
    return;
  }

  ensurePaddockTexture(a, walkTex, true);
  const dx = a.targetX - a.sprite.x;
  const dy = a.targetY - a.sprite.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const sp = speedForKind(a.kind);

  a.dir = rowFromVector(dx, dy, a.dir);
  if (dist < 4.5) {
    a.mode = 'eat';
    ensurePaddockTexture(a, eatTex, true);
    if (Phaser.Math.FloatBetween(0, 1) < P_EAT_STREAK) {
      a.tRemain = Phaser.Math.FloatBetween(0.6, 2.4);
    } else {
      a.tRemain = Phaser.Math.FloatBetween(0.1, 0.2);
    }
    playPaddockAnim(a, eKeyS(a.dir));
    a.sprite.setPosition(Phaser.Math.Clamp(a.sprite.x, r.x, r.right), Phaser.Math.Clamp(a.sprite.y, r.y, r.bottom));
    return;
  }

  const m = (sp * dt) / dist;
  const nx = a.sprite.x + dx * m;
  const ny = a.sprite.y + dy * m;
  a.sprite.setPosition(
    Phaser.Math.Clamp(nx, r.x, r.right),
    Phaser.Math.Clamp(ny, r.y, r.bottom)
  );
  playPaddockAnim(a, wKeyS(a.dir));

  if (a.tRemain <= 0) {
    if (Phaser.Math.FloatBetween(0, 1) < P_EAT_AFTER_WALK) {
      a.mode = 'eat';
      ensurePaddockTexture(a, eatTex, true);
      a.tRemain = Phaser.Math.FloatBetween(1.2, 3.4);
      playPaddockAnim(a, eKeyS(a.dir));
    } else {
      const p2 = pickWalkTargetInRect(r, a.sprite.x, a.sprite.y);
      a.targetX = p2.tx;
      a.targetY = p2.ty;
      a.dir = rowFromVector(a.targetX - a.sprite.x, a.targetY - a.sprite.y, a.dir);
      a.tRemain = Phaser.Math.FloatBetween(2, 5.5);
    }
  }
}
