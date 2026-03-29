/** Mode d’édition du plan : pièce (murs / ouvertures), disposition des tables, placement invités. */
export type PlanMode = 'room' | 'tables' | 'assign';

/** Outil mode Invités : échanger deux tables ou déplacer des invités vers une autre (un seul actif). */
export type AssignBulkTool = 'none' | 'swap' | 'moveAll';
