import type Phaser from 'phaser';

/** Feuille Universal LPC 64×64, 13 colonnes, 21 lignes (feuille courte sans lignes idle 22+). */
export const ACT6_ECURIE_BG_KEY = 'act6-ecurie' as const;

export const ACT6_MAESTRO_TEXTURE_KEY = 'act6-maestro-chef';

/** Même échelle que l’acte 5 pour les feuilles LPC 64×64. */
export const ACT6_LPC_TILE_SCALE = 1.8;

/** Chef d’orchestre, vers le haut de la scène. */
export const ACT6_MAESTRO_POS_FRAC = { x: 0.5, y: 0.52 } as const;

/** Parler au Maestro quand le joueur est assez proche. */
export const ACT6_MAESTRO_INTERACT_RADIUS = 108;

/**
 * Zone de marche (fractions 0–1, réserve basse pour le texte).
 */
export const ACT6_WALK_ZONE = {
  minXFrac: 0.44,
  maxXFrac: 0.58,
  minYFrac: 0.52,
  bottomReservePx: 78,
} as const;

export function act6WalkBounds(
  width: number,
  height: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const z = ACT6_WALK_ZONE;
  return {
    minX: width * z.minXFrac,
    maxX: width * z.maxXFrac,
    minY: height * z.minYFrac,
    maxY: height - z.bottomReservePx,
  };
}

export function act6DefaultPlayerPos(width: number, height: number): { x: number; y: number } {
  const w = act6WalkBounds(width, height);
  return { x: (w.minX + w.maxX) / 2, y: w.maxY - 36 };
}

const COLS = 13;

/** Grille Universal LPC : spell (4) → thrust (4) → walk (4) → slash (4) → shoot (4) → blessé (1). */
const ROW_SPELL_UP = 0;
const ROW_THRUST_UP = 4;
const ROW_SLASH_UP = 12;
const ROW_SHOOT_UP = 16;

function sheetFrameAt(row: number, col: number): number {
  return row * COLS + col;
}

const MAESTRO_SPELL_FRAMES = 7;
const MAESTRO_THRUST_FRAMES = 8;
const MAESTRO_SLASH_FRAMES = 6;
const MAESTRO_SHOOT_FRAMES = 13;

export const ACT6_MAESTRO_ANIM_SPELL = `${ACT6_MAESTRO_TEXTURE_KEY}-routine-spell-up`;
export const ACT6_MAESTRO_ANIM_THRUST = `${ACT6_MAESTRO_TEXTURE_KEY}-routine-thrust-up`;
export const ACT6_MAESTRO_ANIM_SLASH = `${ACT6_MAESTRO_TEXTURE_KEY}-routine-slash-up`;
export const ACT6_MAESTRO_ANIM_SHOOT = `${ACT6_MAESTRO_TEXTURE_KEY}-routine-shoot-up`;

function registerOneShotRowAnim(
  scene: Phaser.Scene,
  texKey: string,
  animKey: string,
  row: number,
  frameCount: number,
  frameRate: number,
): void {
  if (scene.anims.exists(animKey)) return;
  const start = sheetFrameAt(row, 0);
  const end = sheetFrameAt(row, frameCount - 1);
  scene.anims.create({
    key: animKey,
    frames: scene.anims.generateFrameNumbers(texKey, { start, end }),
    frameRate,
    repeat: 0,
  });
}

/** Incantation, poussée (thrust), sabre, tir à l’arc — direction « haut » (thrust ≠ arc). */
export function registerAct6MaestroRoutineAnims(scene: Phaser.Scene, texKey: string): void {
  registerOneShotRowAnim(scene, texKey, `${texKey}-routine-spell-up`, ROW_SPELL_UP, MAESTRO_SPELL_FRAMES, 9);
  registerOneShotRowAnim(scene, texKey, `${texKey}-routine-thrust-up`, ROW_THRUST_UP, MAESTRO_THRUST_FRAMES, 10);
  registerOneShotRowAnim(scene, texKey, `${texKey}-routine-slash-up`, ROW_SLASH_UP, MAESTRO_SLASH_FRAMES, 10);
  registerOneShotRowAnim(scene, texKey, `${texKey}-routine-shoot-up`, ROW_SHOOT_UP, MAESTRO_SHOOT_FRAMES, 9);
}

export const ACT6_MAESTRO_ROUTINE_KEYS = [
  ACT6_MAESTRO_ANIM_SPELL,
  ACT6_MAESTRO_ANIM_THRUST,
  ACT6_MAESTRO_ANIM_SLASH,
  ACT6_MAESTRO_ANIM_SHOOT,
] as const;
