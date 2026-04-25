/**
 * Pont acte 4 — deux calques (`pont-haut`, `pont-bas`) ; pas de calque « centre ».
 *
 * **Placement** : coordonnées **coin haut-gauche** en fraction du canvas (0–1), comme un repère 960×540.
 * Pour régler au pixel : `x_px / 960`, `y_px / 540`.
 *
 * **Profondeur** : même logique que les personnages — `depth ≈ bas du sprite en Y` + petit offset par calque
 * pour départager quand les bas se confondent.
 */
import Phaser from 'phaser';

export const ACT4_PONT_TEXTURE = {
  haut: 'act4-pont-haut',
  bas: 'act4-pont-bas',
} as const;

/** Offsets ajoutés à `getBounds().bottom` pour l’ordre de dessin (plus grand = plus devant). */
export const ACT4_PONT_DEPTH_OFFSET = {
  haut: 0.08,
  bas: 0.0,
} as const;

/**
 * Coin haut-gauche de chaque image (fractions 0–1 du canvas).
 * Repère 960×540 — remparts 158 px de large (assets actuels). À affiner au pixel selon ton décor.
 */
export const ACT4_PONT_TOP_LEFT_FRAC = {
  /** Rempart haut (158×37). */
  haut: { x: 461 / 960, y: 226 / 540 },
  /** Rempart bas (158×42). */
  bas: { x: 461 / 960, y: 280 / 540 },
} as const;

export function positionAct4BridgeImages(
  width: number,
  height: number,
  pontHaut: Phaser.GameObjects.Image,
  pontBas: Phaser.GameObjects.Image,
): void {
  const h = ACT4_PONT_TOP_LEFT_FRAC.haut;
  const b = ACT4_PONT_TOP_LEFT_FRAC.bas;
  pontHaut.setPosition(h.x * width, h.y * height);
  pontBas.setPosition(b.x * width, b.y * height);
}

export function depthForAct4Pont(img: Phaser.GameObjects.Image, offset: number): number {
  return img.getBounds().bottom + offset;
}
