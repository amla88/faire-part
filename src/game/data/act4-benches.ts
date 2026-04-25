/**
 * Bancs acte 4 — `banc.png`.
 *
 * **Placement** : `xFrac` / `yFrac` = point d’appui au **sol** (centre bas du sprite, `originY = 1`).
 * **Multiplier** : dupliquez des lignes dans `ACT4_BENCHES`.
 *
 * **Hitbox** : rectangle bas centrée (`ACT4_BENCH_HITBOX`) — à ajuster selon le visuel.
 */
export const ACT4_BENCH_TEXTURE_KEY = 'act4-banc' as const;

export type Act4BenchDef = {
  xFrac: number;
  yFrac: number;
  scale?: number;
};

/** Instances — éditez / dupliquez les entrées pour placer les bancs. */
export const ACT4_BENCHES: readonly Act4BenchDef[] = [{ xFrac: 0.37, yFrac: 0.50, scale: 0.55 }, { xFrac: 0.68, yFrac: 0.16, scale: 0.55 }];

/**
 * Hitbox « siège / socle » : fractions du **AABB affiché**, centrée horizontalement,
 * ancrée en bas (alignée sur le sol `originY = 1`).
 */
export const ACT4_BENCH_HITBOX = {
  widthFrac: 0.88,
  heightFrac: 0.22,
} as const;
