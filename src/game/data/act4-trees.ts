/**
 * Arbres acte 4 — `arbre-prunes.png` et `arbre-pommes.png`.
 *
 * **Placement** : `xFrac` / `yFrac` = position des **pieds** du tronc (0–1 du canvas, repère 960×540).
 * **Multiplier** : dupliquez des lignes dans `ACT4_TREES` (même `kind` autorisé).
 *
 * **Hitbox** : bande basse centrée (`ACT4_TREE_TRUNK_HITBOX`) — à ajuster si le tronc visuel change.
 *
 * Assets actuels : prunes 97×107, pommes 100×116.
 */
export const ACT4_TREE_TEXTURE = {
  prune: 'act4-arbre-prunes',
  pomme: 'act4-arbre-pommes',
} as const;

export type Act4TreeKind = 'prune' | 'pomme';

export type Act4TreeDef = {
  kind: Act4TreeKind;
  /** Pieds du tronc (fractions du canvas). */
  xFrac: number;
  yFrac: number;
  /** Échelle d’affichage (1 = taille native). */
  scale?: number;
};

/**
 * Liste des instances — éditez / dupliquez les entrées pour placer les arbres.
 */
export const ACT4_TREES: readonly Act4TreeDef[] = [
  { kind: 'prune', xFrac: 0.25, yFrac: 0.72, scale: 0.95 },
  { kind: 'prune', xFrac: 0.34, yFrac: 0.75, scale: 1 },
  { kind: 'prune', xFrac: 0.41, yFrac: 0.72, scale: 0.87 },
  { kind: 'pomme', xFrac: 0.66, yFrac: 0.09, scale: 1 },
  { kind: 'pomme', xFrac: 0.75, yFrac: 0.18, scale: 1 },
  { kind: 'pomme', xFrac: 0.76, yFrac: 0.42, scale: 0.97 },
  { kind: 'pomme', xFrac: 0.86, yFrac: 0.27, scale: 0.93 },
  { kind: 'pomme', xFrac: 0.88, yFrac: 0.46, scale: 1 },
];

/**
 * Hitbox « tronc » : largeur / hauteur en fraction du **AABB affiché** de l’image,
 * centrée horizontalement, ancrée en bas (alignée sur les pieds `originY = 1`).
 */
export const ACT4_TREE_TRUNK_HITBOX = {
  widthFrac: 0.36,
  heightFrac: 0.22,
} as const;
