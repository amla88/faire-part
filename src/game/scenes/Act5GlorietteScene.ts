import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { SceneInput } from '../systems/SceneInput';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import { quests, QuestFlags } from '../systems/QuestSystem';

export class Act5GlorietteScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private info!: Phaser.GameObjects.Text;
  private saving = false;
  private spoken = false;

  constructor() {
    super('Act5GlorietteScene');
  }

  create(): void {
    gameState.setAct('act5');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(18, 14, 'ACTE 5 — La Gloriette aux souhaits', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0xffffff, 0.12);
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x000000, 0.04).setStrokeStyle(
      2,
      0xabbca6,
      0.25
    );
    this.add.text(width / 2, height * 0.28, 'La Gloriette aux souhaits', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
    }).setOrigin(0.5);

    this.info = this.add.text(width / 2, height - 70, 'Parlez à la Baronne (Espace/Enter).', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
      align: 'center',
    }).setOrigin(0.5);
  }

  override update(): void {
    const act = this.inputState.actionJustDown();

    if (this.dialogueBox.active) {
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      this.inputState.commit();
      return;
    }

    if (act) {
      if (!this.spoken) {
        this.spoken = true;
        this.dialogueBox.start(getDialogue('act5.glorietteIntro'), () => this.openIdeaForm(), {
          hideSceneHud: [this.info],
        });
      } else {
        this.openIdeaForm();
      }
    }

    this.inputState.commit();
  }

  private openIdeaForm(): void {
    if (this.formBox.active) return;
    this.formBox.startTextFields({
      hideSceneHud: [this.info],
      title: 'Boîte à idées (Acte 5)',
      fields: [
        {
          name: 'contenu',
          label: 'Votre idée',
          placeholder: 'Une suggestion pour le mariage…',
          multiline: true,
          maxLength: 8000,
        },
      ],
      onSubmit: (values) => {
        if (this.saving) return;
        const contenu = (values['contenu'] || '').trim();
        if (!contenu) {
          this.info.setText('Écrivez au moins quelques mots.');
          return;
        }
        this.saving = true;
        this.info.setText('La Baronne recueille votre inspiration…');
        gameBackend
          .insertIdeeForSelected(contenu)
          .then(() => {
            quests.done(QuestFlags.act5IdeaDone);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
            } catch {}
            this.info.setText('Idée déposée. Merci !');
            this.time.delayedCall(650, () => {
              gameState.setAct('hub');
              this.scene.start('HubOpenWorldScene');
            });
          })
          .catch((e) => {
            this.info.setText('Erreur: ' + String(e?.message || e));
          })
          .finally(() => {
            this.saving = false;
          });
      },
    });
  }
}

