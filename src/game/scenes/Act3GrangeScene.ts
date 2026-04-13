import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';
import { DialogueBox } from '../ui/DialogueBox';
import { AvatarEditorBox } from '../ui/AvatarEditorBox';
import { getDialogue } from '../data/dialogues.catalog';

export class Act3GrangeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private info!: Phaser.GameObjects.Text;
  private dialogueBox!: DialogueBox;
  private avatarEditorBox!: AvatarEditorBox;
  private opening = false;

  constructor() {
    super('Act3GrangeScene');
  }

  create(): void {
    gameState.setAct('act3');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(18, 14, 'ACTE 3 — La Grande Grange', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.avatarEditorBox = new AvatarEditorBox(this);
    this.info = this.add.text(
      width / 2,
      height / 2,
      'Approchez du miroir et façonnez votre effigie.\nEspace/Enter (ou bouton tactile) pour commencer.',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#2c2433',
        align: 'center',
      }
    ).setOrigin(0.5);
  }

  /** Éditeur DiceBear intégré à Phaser (mêmes options que le site). */
  private openPhaserAvatarEditor(initial: { seed?: string; options?: unknown } | null): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.avatarEditorBox.start({
        initial,
        onClose: (saved) => resolve(saved),
      });
    });
  }

  override update(): void {
    const act = this.inputState.actionJustDown();

    if (this.avatarEditorBox.active) {
      this.inputState.commit();
      return;
    }

    if (this.dialogueBox.active) {
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (quests.isDone(QuestFlags.act3AvatarDone)) {
      this.info.setText('Acte 3 déjà validé. Merci !');
      this.inputState.commit();
      return;
    }

    if (act && !this.opening) {
      this.opening = true;
      this.info.setText('Préparation du miroir…');
      gameBackend
        .getAvatarForSelected()
        .then((avatarRow) => {
          this.info.setText('');
          this.dialogueBox.start(
            {
              steps: [
                {
                  speaker: 'Madame Chromatique',
                  portraitColor: 0xabbca6,
                  text:
                    "Quelle silhouette charmante… mais il lui manque ce je-ne-sais-quoi numérique ! Approchez : votre portrait doit être aussi mémorable qu’une rumeur.",
                },
              ],
            },
            () => {
              void this.openPhaserAvatarEditor(avatarRow).then((saved) => {
                this.opening = false;
                if (!saved) {
                  this.info.setText('Approchez du miroir et façonnez votre effigie.\nEspace/Enter (ou bouton tactile) pour commencer.');
                  return;
                }
                quests.done(QuestFlags.act3AvatarDone);
                quests.done(QuestFlags.hubMapUnlocked);
                try {
                  void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
                } catch {}
                this.info.setText('Acte 3 validé.');
                this.dialogueBox.start(getDialogue('act3.mapUnlock'), () => {
                  try {
                    window.dispatchEvent(new CustomEvent('fp-game-show-map'));
                  } catch {}
                  try {
                    gameState.setAct('hub');
                    this.scene.start('HubOpenWorldScene');
                  } catch {
                    // Si la scène hub n'existe pas encore, on reste ici.
                  }
                });
              });
            }
          );
        })
        .catch((e) => {
          this.opening = false;
          this.info.setText('Erreur: ' + String(e?.message || e));
        });
    }
    this.inputState.commit();
  }
}
