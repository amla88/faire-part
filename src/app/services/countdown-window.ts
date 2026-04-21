/** Fenêtre temporaire "décompte" : jusqu'à mercredi midi (heure locale). */
export const COUNTDOWN_DEADLINE_LOCAL = new Date(2026, 3, 25, 12, 0, 0, 0); // 2026-04-22 12:00

export function isCountdownWindowActive(now = new Date()): boolean {
  return now.getTime() < COUNTDOWN_DEADLINE_LOCAL.getTime();
}

