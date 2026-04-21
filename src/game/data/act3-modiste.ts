/**
 * PNJ modiste — feuille Universal LPC 64×64 (`modiste.png`), même grille que le générateur officiel.
 * @see https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/
 */
import type Phaser from 'phaser';
import type { LpcFacing } from './lpc-garcon';

export const MODISTE_TEXTURE_KEY = 'modiste';

const COLS = 13;

/** Aligné sur `ANIMATION_CONFIGS.emote` (sources du générateur ULPC). */
const EMOTE_BASE_ROW = 34;

function sheetFrameAt(row: number, col: number): number {
  return row * COLS + col;
}

/** Lignes idle (22–25) identiques à `lpc-garcon` / feuilles joueur. */
const IDLE_ROW: Record<LpcFacing, number> = {
  up: 22,
  left: 23,
  down: 24,
  right: 25,
};

/** Cycle colonnes pour la direction « down » (emote, rangée 36). */
const EMOTE_DOWN_CYCLE = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2] as const;

/** 2× plus rapide que la cadence « par défaut » (8 fps). */
const EMOTE_FPS = 16;

function emoteRowForFacing(facing: LpcFacing): number {
  const o: Record<LpcFacing, number> = { up: 0, left: 1, down: 2, right: 3 };
  return EMOTE_BASE_ROW + o[facing];
}

export function registerModisteAnims(scene: Phaser.Scene): void {
  if (!scene.textures.exists(MODISTE_TEXTURE_KEY)) return;
  const key = `${MODISTE_TEXTURE_KEY}-emote-down`;
  if (scene.anims.exists(key)) return;
  const row = emoteRowForFacing('down');
  const frames = EMOTE_DOWN_CYCLE.map((col) => ({
    key: MODISTE_TEXTURE_KEY,
    frame: sheetFrameAt(row, col),
  }));
  scene.anims.create({
    key,
    frames,
    frameRate: EMOTE_FPS,
    repeat: 0,
  });
}

export function setModisteIdleFrame(sprite: Phaser.GameObjects.Sprite, facing: LpcFacing): void {
  sprite.anims.stop();
  sprite.setFrame(sheetFrameAt(IDLE_ROW[facing], 0));
}

/**
 * Joue l’emote « bas », fige la dernière frame, puis appelle `onComplete`
 * après `holdLastFrameMs` (ms) si strictement positif.
 */
export function playModisteEmoteDownOnce(
  sprite: Phaser.GameObjects.Sprite,
  onComplete?: () => void,
  holdLastFrameMs = 0,
): void {
  const key = `${MODISTE_TEXTURE_KEY}-emote-down`;
  if (!sprite.scene.anims.exists(key)) {
    onComplete?.();
    return;
  }
  const row = emoteRowForFacing('down');
  const lastCol = EMOTE_DOWN_CYCLE[EMOTE_DOWN_CYCLE.length - 1]!;
  const finish = () => {
    if (holdLastFrameMs > 0) {
      sprite.scene.time.delayedCall(holdLastFrameMs, () => onComplete?.());
    } else {
      onComplete?.();
    }
  };
  sprite.once('animationcomplete', () => {
    sprite.anims.stop();
    sprite.setFrame(sheetFrameAt(row, lastCol));
    finish();
  });
  sprite.anims.play(key, true);
}
