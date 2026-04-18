/**
 * Grilles Universal LPC (feuille complète) : 64×64 par frame.
 * Fichiers : `garcon.png` (Gentleman), `fille.png` (Lady), `queen.png` (Reine de la nuit), `king.png` (Duc de la scène).
 * Largeur standard 832 px → **13 colonnes** par ligne.
 * Ordre vertical : spellcast (4 lignes) → thrust (4) → walk (4) → …
 * @see https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/
 */
import type { PlayerArchetype } from '../core/game-state';

const FRAME_W = 64;
const FRAME_H = 64;

/** Chemins relatifs à `assets/game/` (Angular sert `src/assets/` sous `/assets/`). */
export const LPC_PLAYER_SHEET_LOADS: ReadonlyArray<{ key: string; path: string }> = [
  { key: 'lpc-gentleman', path: 'sprites/garcon.png' },
  { key: 'lpc-lady', path: 'sprites/fille.png' },
  { key: 'lpc-queen', path: 'sprites/queen.png' },
  { key: 'lpc-king', path: 'sprites/king.png' },
];

export const LPC_TEXTURE_KEY_BY_ARCHETYPE: Record<PlayerArchetype, string> = {
  Gentleman: 'lpc-gentleman',
  Lady: 'lpc-lady',
  'Reine de la nuit': 'lpc-queen',
  'Duc de la scene': 'lpc-king',
};

export function resolveLpcPlayerTextureKey(player?: PlayerArchetype): string {
  return player ? LPC_TEXTURE_KEY_BY_ARCHETYPE[player] : LPC_TEXTURE_KEY_BY_ARCHETYPE.Gentleman;
}

export type LpcFacing = 'up' | 'left' | 'down' | 'right';

/** Colonnes par ligne sur une feuille « universal » 832 px de large. */
const COLS = 13;

const SPELL_ROWS = 4;
const THRUST_ROWS = 4;
const WALK_FRAMES_PER_ROW = 9;
const WALK_LOOP_COL_FIRST = 0;

const WALK_FIRST_ROW_INDEX = SPELL_ROWS + THRUST_ROWS;

const IDLE_FRAMES_PER_ROW = 2;
const IDLE_FPS = 5;

function sheetFrameAt(row: number, col: number): number {
  return row * COLS + col;
}

function walkRowStartFrame(directionRow: number): number {
  return sheetFrameAt(WALK_FIRST_ROW_INDEX + directionRow, 0);
}

export const LPC_PLAYER_WALK_FIRST_FRAMES = {
  walkUp: walkRowStartFrame(0),
  walkLeft: walkRowStartFrame(1),
  walkDown: walkRowStartFrame(2),
  walkRight: walkRowStartFrame(3),
};

/**
 * Première frame **utile** du cycle walk par direction (colonne `WALK_LOOP_COL_FIRST`),
 * alignée sur l’anim `walk` — pour afficher le PNJ en « pose marche » sans idle.
 */
export const LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES: Record<LpcFacing, number> = {
  up: sheetFrameAt(WALK_FIRST_ROW_INDEX + 0, WALK_LOOP_COL_FIRST),
  left: sheetFrameAt(WALK_FIRST_ROW_INDEX + 1, WALK_LOOP_COL_FIRST),
  down: sheetFrameAt(WALK_FIRST_ROW_INDEX + 2, WALK_LOOP_COL_FIRST),
  right: sheetFrameAt(WALK_FIRST_ROW_INDEX + 3, WALK_LOOP_COL_FIRST),
};

/** @deprecated Utiliser `LPC_PLAYER_WALK_FIRST_FRAMES`. */
export const LPC_GARCON_FRAMES = LPC_PLAYER_WALK_FIRST_FRAMES;

/**
 * Lignes idle (0-based), alignées sur le visage comme la marche.
 * Même permutation que pour `garcon.png` si toutes les feuilles viennent du même générateur.
 */
const IDLE_ROW: Record<'up' | 'left' | 'down' | 'right', number> = {
  up: 22,
  left: 23,
  down: 24,
  right: 25,
};

export const LPC_PLAYER_IDLE_FIRST_FRAMES = {
  up: sheetFrameAt(IDLE_ROW.up, 0),
  left: sheetFrameAt(IDLE_ROW.left, 0),
  down: sheetFrameAt(IDLE_ROW.down, 0),
  right: sheetFrameAt(IDLE_ROW.right, 0),
};

/** @deprecated Utiliser `LPC_PLAYER_IDLE_FIRST_FRAMES`. */
export const LPC_GARCON_IDLE_FIRST_FRAMES = LPC_PLAYER_IDLE_FIRST_FRAMES;

/** @deprecated Utiliser `resolveLpcPlayerTextureKey('Gentleman')`. */
export const LPC_GARCON_SHEET_KEY = LPC_TEXTURE_KEY_BY_ARCHETYPE.Gentleman;

function walkAnimKey(textureKey: string, facing: LpcFacing): string {
  return `${textureKey}-walk-${facing}`;
}

function idleAnimKey(textureKey: string, facing: LpcFacing): string {
  return `${textureKey}-idle-${facing}`;
}

function registerWalkAnimsForTexture(scene: Phaser.Scene, tex: string): void {
  if (!scene.textures.exists(tex)) return;

  const ensure = (animKey: string, row: number) => {
    if (scene.anims.exists(animKey)) return;
    const rowBase = sheetFrameAt(WALK_FIRST_ROW_INDEX + row, 0);
    const start = rowBase + WALK_LOOP_COL_FIRST;
    const end = rowBase + WALK_FRAMES_PER_ROW - 1;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(tex, { start, end }),
      frameRate: 10,
      repeat: -1,
    });
  };

  ensure(walkAnimKey(tex, 'up'), 0);
  ensure(walkAnimKey(tex, 'left'), 1);
  ensure(walkAnimKey(tex, 'down'), 2);
  ensure(walkAnimKey(tex, 'right'), 3);
}

function registerIdleAnimsForTexture(scene: Phaser.Scene, tex: string): void {
  if (!scene.textures.exists(tex)) return;

  const ensureIdle = (animKey: string, facing: keyof typeof IDLE_ROW) => {
    if (scene.anims.exists(animKey)) return;
    const start = sheetFrameAt(IDLE_ROW[facing], 0);
    const end = start + IDLE_FRAMES_PER_ROW - 1;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(tex, { start, end }),
      frameRate: IDLE_FPS,
      repeat: -1,
    });
  };

  ensureIdle(idleAnimKey(tex, 'up'), 'up');
  ensureIdle(idleAnimKey(tex, 'left'), 'left');
  ensureIdle(idleAnimKey(tex, 'down'), 'down');
  ensureIdle(idleAnimKey(tex, 'right'), 'right');
}

export function registerLpcPlayerWalkAnimsAll(scene: Phaser.Scene): void {
  for (const { key } of LPC_PLAYER_SHEET_LOADS) {
    registerWalkAnimsForTexture(scene, key);
  }
}

export function registerLpcPlayerIdleAnimsAll(scene: Phaser.Scene): void {
  for (const { key } of LPC_PLAYER_SHEET_LOADS) {
    registerIdleAnimsForTexture(scene, key);
  }
}

/** Feuille Universal LPC (M. de La Plume) — même grille 64×64 que les joueurs. */
export const LPC_DE_LA_PLUME_TEXTURE_KEY = 'lpc-de-la-plume';

/** Marche + idle pour toute feuille « Universal LPC » au même format que les sprites joueur. */
export function registerLpcUniversalSheetWalkAndIdle(scene: Phaser.Scene, textureKey: string): void {
  registerWalkAnimsForTexture(scene, textureKey);
  registerIdleAnimsForTexture(scene, textureKey);
}

/** @deprecated Utiliser `registerLpcPlayerWalkAnimsAll`. */
export function registerLpcGarconWalkAnims(scene: Phaser.Scene): void {
  registerLpcPlayerWalkAnimsAll(scene);
}

/** @deprecated Utiliser `registerLpcPlayerIdleAnimsAll`. */
export function registerLpcGarconIdleAnims(scene: Phaser.Scene): void {
  registerLpcPlayerIdleAnimsAll(scene);
}

export function playLpcPlayerWalk(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  const tex = sprite.texture.key;
  const anim = walkAnimKey(tex, facing);
  if (scene.anims.exists(anim)) {
    sprite.anims.play(anim, true);
  }
}

/** Pose fixe : 1re frame du cycle walk (pas l’idle), pour PNJ ou previews. */
export function setLpcWalkFirstCycleFrame(sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  sprite.anims.stop();
  sprite.setFrame(LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES[facing]);
}

export function playLpcPlayerIdle(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  const tex = sprite.texture.key;
  const anim = idleAnimKey(tex, facing);
  if (!scene.anims.exists(anim)) {
    setLpcPlayerIdleFrame(sprite, facing);
    return;
  }
  // Après `anims.stop()`, `currentAnim.key` peut rester identique : il faut vérifier `isPlaying`.
  if (sprite.anims.currentAnim?.key === anim && sprite.anims.isPlaying) return;
  sprite.anims.play(anim, true);
}

export function setLpcPlayerIdleFrame(sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  sprite.anims.stop();
  sprite.setFrame(LPC_PLAYER_IDLE_FIRST_FRAMES[facing]);
}

/** @deprecated Utiliser `playLpcPlayerWalk`. */
export function playGarconWalk(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  playLpcPlayerWalk(scene, sprite, facing);
}

/** @deprecated Utiliser `playLpcPlayerIdle`. */
export function playGarconIdle(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  playLpcPlayerIdle(scene, sprite, facing);
}

/** @deprecated Utiliser `setLpcPlayerIdleFrame`. */
export function setGarconIdleFrame(sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  setLpcPlayerIdleFrame(sprite, facing);
}

export { FRAME_W as LPC_PLAYER_FRAME_WIDTH, FRAME_H as LPC_PLAYER_FRAME_HEIGHT };
/** @deprecated */
export { FRAME_W as LPC_GARCON_FRAME_WIDTH, FRAME_H as LPC_GARCON_FRAME_HEIGHT };
