/** Émis sur `window` quand au moins une boîte modale jeu (dialogue, formulaire) doit masquer l’overlay tactile Angular. */
export const GAME_TOUCH_OVERLAY_BLOCK_EVENT = 'fp-game-touch-overlay-block';
/** Émis quand plus aucune modale n’impose ce masquage (profondeur revenue à 0). */
export const GAME_TOUCH_OVERLAY_UNBLOCK_EVENT = 'fp-game-touch-overlay-unblock';

let blockDepth = 0;

export function pushGameModalTouchOverlayBlock(): void {
  blockDepth += 1;
  if (blockDepth === 1) {
    window.dispatchEvent(new CustomEvent(GAME_TOUCH_OVERLAY_BLOCK_EVENT));
  }
}

export function popGameModalTouchOverlayBlock(): void {
  if (blockDepth <= 0) return;
  blockDepth -= 1;
  if (blockDepth === 0) {
    window.dispatchEvent(new CustomEvent(GAME_TOUCH_OVERLAY_UNBLOCK_EVENT));
  }
}

/** À appeler si le jeu est détruit sans fermeture propre des modales (évite une profondeur fantôme). */
export function resetGameModalTouchOverlayBlockDepth(): void {
  blockDepth = 0;
}
