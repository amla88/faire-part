import Phaser from 'phaser';

/** Scènes techniques encore parfois listées côté manager (ne jamais servir d’ancrage pour un `start`). */
const BUILTIN_EXCLUDE = new Set(['PreloadScene', 'BootScene']);

function sceneKey(s: Phaser.Scene): string {
  return String(s.sys?.settings?.key ?? '');
}

/**
 * Parmi `getScenes(true)` le premier élément n’est **pas** forcément la scène “visible” : l’ordre
 * reprend l’arbre du manager (arrière → avant : le **dernier** est celle devant, updates prioritaires).
 * Prendre [0] pouvait appeler `start` sur Preload/une scène en fond → enchaînes bizarres, puis plantage
 * (ex. entrée en Acte 4) après navigation Hub ↔ acte.
 */
function pickActiveSceneForExternalStart(game: Phaser.Game): Phaser.Scene | null {
  const running = game.scene.getScenes(true) as Phaser.Scene[];
  if (!running.length) return null;

  const withoutBuiltin = running.filter((s) => !BUILTIN_EXCLUDE.has(sceneKey(s)));
  const list = withoutBuiltin.length > 0 ? withoutBuiltin : running;
  return list[list.length - 1] ?? null;
}

/**
 * Phaser 3.50+ : `game.scene.start` depuis l’extérieur (hors d’une instance de `Scene`)
 * ne s’enchaîne pas proprement sur le cycle d’exécution, ce qui peut rater le changement
 * ou recharger la mauvaise scène. Il faut passer par `this.scene` d’une scène en cours
 * d’exécution, comme pour la navigation depuis un autre processus (socket, UI, etc.).
 * @see https://stackoverflow.com/questions/64048650
 */
export function startSceneFromGame(game: Phaser.Game, key: string, data?: object): void {
  const from = pickActiveSceneForExternalStart(game);
  if (from) {
    try {
      if (data !== undefined) {
        from.scene.start(key, data);
      } else {
        from.scene.start(key);
      }
      return;
    } catch (e) {
      console.error('startSceneFromGame: via scène active', e);
    }
  }
  try {
    if (data !== undefined) {
      game.scene.start(key, data);
    } else {
      game.scene.start(key);
    }
  } catch (e) {
    console.error('startSceneFromGame: repli', e);
  }
}

/**
 * Émis avant `scene.start('HubOpenWorldScene')` (bouton Carte Angular) pour laisser la
 * scène courante fermer proprement dialogues / formulaires (sans attendre onDone).
 */
export const FP_REQUEST_DOMAIN_MAP = 'fp-game-request-domain-map';

export function dispatchRequestDomainMap(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(FP_REQUEST_DOMAIN_MAP, { detail: { source: 'angular-carte' } }));
  } catch {
    // ignore
  }
}

/**
 * Chaque scène de jeu (avec modales) enregistre un `cleanup` dans `create()` ; on le retire en SHUTDOWN.
 * Seule la scène en cours a un listener, donc le nettoyage ne s’applique qu’à celle-là.
 */
export function registerRequestDomainMapListener(scene: Phaser.Scene, cleanup: () => void): void {
  if (typeof window === 'undefined') return;

  const h = () => {
    if (!isSceneInActiveStack(scene)) return;
    try {
      cleanup();
    } catch {
      // ignore
    }
  };
  window.addEventListener(FP_REQUEST_DOMAIN_MAP, h);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    try {
      window.removeEventListener(FP_REQUEST_DOMAIN_MAP, h);
    } catch {
      // ignore
    }
  });
}

function isSceneInActiveStack(scene: Phaser.Scene): boolean {
  try {
    return scene?.game?.scene.getScenes(true).some((s) => s === scene) === true;
  } catch {
    return false;
  }
}
