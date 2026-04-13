import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';
import { DialogueBox } from '../ui/DialogueBox';
import { AvatarBox } from '../ui/AvatarBox';
import { getDialogue } from '../data/dialogues.catalog';

export class Act3GrangeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private info!: Phaser.GameObjects.Text;
  private dialogueBox!: DialogueBox;
  private avatarBox!: AvatarBox;
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
    this.avatarBox = new AvatarBox(this);
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

  override update(): void {
    const act = this.inputState.actionJustDown();

    if (this.dialogueBox.active) {
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (this.avatarBox.active) {
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
        .then((existing) => {
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
              this.avatarBox.start({
                title: 'La Galerie des reflets',
                defaults: existing ?? undefined,
                onSubmit: ({ seed, options }) => {
                  this.info.setText('Sauvegarde de votre effigie…');
                  gameBackend
                    .upsertAvatarForSelected(seed, options)
                    .then(() => {
                      quests.done(QuestFlags.act3AvatarDone);
                      quests.done(QuestFlags.hubMapUnlocked);
                      // Sync progression serveur (best-effort)
                      try {
                        void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
                      } catch {}
                      this.info.setText('Acte 3 validé.');
                      this.dialogueBox.start(getDialogue('act3.mapUnlock'), () => {
                        // À la fermeture: ouvrir la carte côté Angular (overlay) puis basculer en hub.
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
                    })
                    .catch((e) => {
                      this.info.setText('Erreur: ' + String(e?.message || e));
                    })
                    .finally(() => {
                      this.opening = false;
                    });
                },
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

