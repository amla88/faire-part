import Phaser from 'phaser';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';

export class Act3GrangeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('Act3GrangeScene');
  }

  create(): void {
    gameState.setAct('act3');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#f3ebe4');
    this.add.text(18, 14, 'ACTE 3 - Grande grange (prototype)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.inputState = new SceneInput(this);
    this.info = this.add.text(
      width / 2,
      height / 2,
      'Appuyez sur Espace/Enter (ou bouton tactile)\npour créer un avatar (prototype).',
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
    if (act && !quests.isDone(QuestFlags.act3AvatarDone)) {
      this.info.setText('Sauvegarde avatar en cours…');
      const seed = String(Math.floor(Math.random() * 1_000_000));
      const options = { top: 'noHair' }; // placeholder minimal
      gameBackend
        .upsertAvatarForSelected(seed, options)
        .then(() => {
          quests.done(QuestFlags.act3AvatarDone);
          this.info.setText('Acte 3 validé. Fin prototype Actes 0→3.');
        })
        .catch((e) => {
          this.info.setText('Erreur: ' + String(e?.message || e));
        });
    }
    this.inputState.commit();
  }
}

