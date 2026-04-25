import type { LpcFacing } from './lpc-garcon';

/** Même emplacement d’art que `baronne-inspiration.png` (grille 64×64, 13 colonnes). */
export const ACT5_BARONNE_TEXTURE_KEY = 'baronne-inspiration';

export const ACT5_Gloriette = {
  bg: 'act5-gloriette' as const,
} as const;

/**
 * Centre du sprite PNJ (même logique qu’en acte 1 : `setLpcWalkFirstCycleFrame`, échelle ×2).
 * Coordonnées normalisées 0–1.
 */
export const ACT5_BARONNE_POS_FRAC = { x: 0.47, y: 0.53 } as const;

export const ACT5_BARONNE_FACING: LpcFacing = 'down';

/** Même `TILE_SCALE` qu’`Act1CourScene` pour les feuilles LPC 64×64. */
export const ACT5_LPC_TILE_SCALE = 1.8;

/**
 * Zone rectangulaire de déplacement (fractions de l’écran, réserve basse en px pour le texte d’UI).
 */
export const ACT5_WALK_ZONE = {
  minXFrac: 0.47,
  maxXFrac: 0.53,
  minYFrac: 0.53,
  bottomReservePx: 78,
} as const;

export function act5WalkBounds(
  width: number,
  height: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const z = ACT5_WALK_ZONE;
  return {
    minX: width * z.minXFrac,
    maxX: width * z.maxXFrac,
    minY: height * z.minYFrac,
    maxY: height - z.bottomReservePx,
  };
}

/** Position initiale : centre de la zone, légèrement au-dessus du bord bas. */
export function act5DefaultPlayerPos(width: number, height: number): { x: number; y: number } {
  const w = act5WalkBounds(width, height);
  return { x: (w.minX + w.maxX) / 2, y: w.maxY - 24 };
}

/** Parler à la Baronne quand le joueur est assez proche. */
export const ACT5_BARONNE_INTERACT_RADIUS = 104;
