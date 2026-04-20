import Phaser from 'phaser';

const DATA_KEY = 'fpSceneHudMask';

type VisibleGameObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

type MaskState = {
  depth: number;
  snapshots: { obj: VisibleGameObject; visible: boolean }[];
};

function asVisible(obj: Phaser.GameObjects.GameObject): VisibleGameObject {
  return obj as VisibleGameObject;
}

/**
 * Masque temporairement des éléments de HUD de scène (textes d’aide, quêtes, etc.).
 * Plusieurs overlays peuvent s’empiler (ex. dialogue puis formulaire) : la visibilité
 * d’origine n’est restaurée qu’au dernier `pop`, après la fermeture du formulaire.
 */
export function sceneHudMaskPush(scene: Phaser.Scene, objects: Phaser.GameObjects.GameObject[]): void {
  const list = objects.filter((o) => o && o.scene === scene).map(asVisible);
  if (!list.length) return;
  let st = scene.data.get(DATA_KEY) as MaskState | undefined;
  if (!st) {
    st = { depth: 0, snapshots: [] };
    scene.data.set(DATA_KEY, st);
  }
  if (st.depth === 0) {
    st.snapshots = list.map((obj) => ({ obj, visible: obj.visible }));
    for (const o of list) o.setVisible(false);
  }
  st.depth++;
}

export function sceneHudMaskPop(scene: Phaser.Scene): void {
  const st = scene.data.get(DATA_KEY) as MaskState | undefined;
  if (!st || st.depth <= 0) return;
  st.depth--;
  if (st.depth === 0) {
    for (const s of st.snapshots) {
      try {
        if (s.obj?.scene) s.obj.setVisible(s.visible);
      } catch {
        // objet détruit avec la scène
      }
    }
    st.snapshots = [];
  }
}
