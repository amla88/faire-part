import { QuestFlags, quests } from '../systems/QuestSystem';

/**
 * Le joueur a accompli l’enchaînement 0–3 (le hub est débloqué) : revenir en acte
 * 0–1–2–3 n’impose plus d’enchaîner sur l’acte suivant, et les scènes re-jouent les
 * échanges (registre, miroir…) au lieu de bloquer.
 */
export function isHubFreeRoamUnlocked(): boolean {
  return quests.isDone(QuestFlags.hubMapUnlocked);
}
