/**
 * Période RSVP close : le jeu reste jouable, mais les saisies invités
 * (présence, avatar, anecdotes, idées, musiques, photos) ne sont plus
 * persistées. Seule la progression (où en est le joueur) peut encore
 * être enregistrée.
 */
export const GAME_CONTENT_WRITES_LOCKED = true;

export const GAME_CONTENT_LOCK_BANNER =
  'Inscriptions closes — le jeu reste ouvert, sans nouvel enregistrement.';
