import Phaser from 'phaser';

/**
 * Zone de marche de l’acte 4 : **polygone fermé** en coordonnées normalisées (0–1) du canvas.
 *
 * - Modifiez les sommets pour la forme voulue ; gardez au moins **3** points et refermez la ligne
 *   (le dernier point rejoint le premier automatiquement côté Phaser si la liste est fermée — ici on duplique pas le premier).
 * - **Polygone convexe** recommandé : le blocage sur les bords utilise un segment vers l’intérieur.
 * - Gardez le joueur et le Vicomte **à l’intérieur** (sinon ajustez `ACT4_PLAYER_START_FRAC` / `ACT4_VICOMTE_POS_FRAC`).
 *
 * Astuce : mettez `ACT4_DEBUG_DRAW_WALK_POLYGON` à `true` pour afficher le polygone en bleu translucide dans le jeu.
 */
export const ACT4_DEBUG_DRAW_WALK_POLYGON = false;

/** Sommets dans l’ordre (trapezium + point bas : zone un peu plus large au sol qu’en haut). */
export const ACT4_WALK_POLYGON_FRAC: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.13, y: 0.42 }, //entrée haut gauche
  { x: 0.43, y: 0.42 },
  { x: 0.43, y: 0.1 },
  { x: 0.51, y: 0.1 },
  { x: 0.51, y: 0.39 },
  { x: 0.47, y: 0.39 },
  { x: 0.47, y: 0.44 }, //pont haut gauche
  { x: 0.66, y: 0.44 },
  { x: 0.66, y: 0.39 },
  { x: 0.62, y: 0.39 },
  { x: 0.62, y: 0.05 },
  { x: 0.7, y: 0.05 },
  { x: 0.98, y: 0.25 },
  { x: 0.98, y: 0.43 }, //cabane
  { x: 0.93, y: 0.45 },
  { x: 0.68, y: 0.45 },
  { x: 0.68, y: 0.93 },
  { x: 0.62, y: 0.93 },
  { x: 0.62, y: 0.56 }, // pont bas droite
  { x: 0.66, y: 0.56 },
  { x: 0.66, y: 0.5 },
  { x: 0.47, y: 0.5 },
  { x: 0.47, y: 0.56 },
  { x: 0.51, y: 0.56 },
  { x: 0.51, y: 0.92 },
  { x: 0.46, y: 0.92 },
  { x: 0.46, y: 0.76 },
  { x: 0.33, y: 0.76 },
  { x: 0.33, y: 0.65 },
  { x: 0.13, y: 0.65 },
];

/** Position initiale du joueur (fractions du canvas). */
export const ACT4_PLAYER_START_FRAC = { x: 0.14, y: 0.52 } as const;

/** Position du Vicomte (pieds, fractions du canvas). */
export const ACT4_VICOMTE_POS_FRAC = { x: 0.66, y: 0.3 } as const;

export function buildAct4WalkPolygon(width: number, height: number): Phaser.Geom.Polygon {
  const flat: number[] = [];
  for (const p of ACT4_WALK_POLYGON_FRAC) {
    flat.push(p.x * width, p.y * height);
  }
  return new Phaser.Geom.Polygon(flat);
}

/**
 * Dernier point du segment [from→to] encore **à l’intérieur** du polygone (recherche dichotomique).
 * Si `from` est hors polygone, utilisez plutôt le centre des sommets comme origine du segment.
 */
export function clampSegmentInsidePolygon(
  polygon: Phaser.Geom.Polygon,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  if (polygon.contains(toX, toY)) return { x: toX, y: toY };

  let fx = fromX;
  let fy = fromY;
  if (!polygon.contains(fx, fy)) {
    const pts = polygon.points;
    if (pts.length === 0) return { x: toX, y: toY };
    fx = 0;
    fy = 0;
    for (const p of pts) {
      fx += p.x;
      fy += p.y;
    }
    fx /= pts.length;
    fy /= pts.length;
    if (!polygon.contains(fx, fy)) {
      return { x: toX, y: toY };
    }
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const x = fx + (toX - fx) * mid;
    const y = fy + (toY - fy) * mid;
    if (polygon.contains(x, y)) lo = mid;
    else hi = mid;
  }
  const t = Math.max(0, lo - 1e-5);
  return { x: fx + (toX - fx) * t, y: fy + (toY - fy) * t };
}
