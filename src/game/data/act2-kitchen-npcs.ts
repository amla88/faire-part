/**
 * Sprites cuisine (Universal LPC 64×64, 13 colonnes) — `cuisinier_chef.png` / `cuisinier.png`.
 * Aligné sur ANIMATION_OFFSETS / ANIMATION_CONFIGS du générateur LPC officiel.
 */
import type { LpcFacing } from './lpc-garcon';

export const ACT2_CHEF_TEXTURE_KEY = 'act2-chef';
export const ACT2_CUISINIER_TEXTURE_KEY = 'act2-cuisinier';

const COLS = 13;

const WALK_FIRST_ROW = 8;
/** Colonne 0 sur la ligne de marche = pose debout (avant cols 1–8 = boucle marche). */
const WALK_STAND_COL = 0;
const WALK_FRAMES_PER_ROW = 9;
const WALK_LOOP_COL_FIRST = 1;
const WALK_FPS = 10;

/** Ligne « dos » / haut : arrosage (cycle générateur LPC). */
const WATER_UP_ROW = 4;
const WATER_UP_COLS = [0, 1, 4, 4, 4, 4, 5] as const;
const WATER_FPS = 8;

function sheetFrameAt(row: number, col: number): number {
  return row * COLS + col;
}

const WALK_ROW_OFFSET: Record<LpcFacing, number> = {
  up: 0,
  left: 1,
  down: 2,
  right: 3,
};

/** Pose figée : 1ʳᵉ image de la marche (col. 0) pour l’orientation donnée. */
export function act2KitchenIdleFirstFrame(facing: LpcFacing): number {
  return sheetFrameAt(WALK_FIRST_ROW + WALK_ROW_OFFSET[facing], WALK_STAND_COL);
}

const TEXTURE_KEYS = [ACT2_CHEF_TEXTURE_KEY, ACT2_CUISINIER_TEXTURE_KEY] as const;

function registerWalkAnims(scene: Phaser.Scene, tex: string): void {
  if (!scene.textures.exists(tex)) return;
  (['up', 'left', 'down', 'right'] as LpcFacing[]).forEach((facing, dirIndex) => {
    const key = `${tex}-walk-${facing}`;
    if (scene.anims.exists(key)) return;
    const rowBase = sheetFrameAt(WALK_FIRST_ROW + dirIndex, 0);
    const start = rowBase + WALK_LOOP_COL_FIRST;
    const end = rowBase + WALK_FRAMES_PER_ROW - 1;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(tex, { start, end }),
      frameRate: WALK_FPS,
      repeat: -1,
    });
  });
}

function registerWaterUpAnim(scene: Phaser.Scene, tex: string): void {
  if (!scene.textures.exists(tex)) return;
  const key = `${tex}-water-up`;
  if (scene.anims.exists(key)) return;
  const frames = WATER_UP_COLS.map((col) => ({ key: tex, frame: sheetFrameAt(WATER_UP_ROW, col) }));
  scene.anims.create({
    key,
    frames,
    frameRate: WATER_FPS,
    repeat: 0,
  });
}

export function registerAct2KitchenNpcAnims(scene: Phaser.Scene): void {
  for (const tex of TEXTURE_KEYS) {
    registerWalkAnims(scene, tex);
    registerWaterUpAnim(scene, tex);
  }
}

/** Rayon de séparation approximatif (coordonnées monde, avant scale visuel). */
export const ACT2_NPC_BODY_RADIUS = 30;

export function playAct2KitchenWalk(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  const tex = sprite.texture.key;
  const key = `${tex}-walk-${facing}`;
  if (scene.anims.exists(key)) sprite.anims.play(key, true);
}

/** Pose figée : frame « debout » de la ligne marche (col. 0), pas d’anim idle LPC. */
export function setAct2KitchenIdleFrame(sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  sprite.anims.stop();
  sprite.setFrame(act2KitchenIdleFirstFrame(facing));
}

export function playAct2KitchenWaterUpOnce(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  onComplete?: () => void
): void {
  const key = `${sprite.texture.key}-water-up`;
  if (!scene.anims.exists(key)) {
    onComplete?.();
    return;
  }
  sprite.anims.play(key, true);
  const durationMs = Math.ceil((WATER_UP_COLS.length / WATER_FPS) * 1000) + 80;
  scene.time.delayedCall(durationMs, () => onComplete?.());
}

/** Direction dominante d’un PNJ vers une cible (vue de dessus). */
export function facingFromDelta(dx: number, dy: number): LpcFacing {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
