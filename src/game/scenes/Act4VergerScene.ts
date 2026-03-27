import Phaser from 'phaser';
import { gameState } from '../core/game-state';
import { SceneInput } from '../systems/SceneInput';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { PhotoUploadBox } from '../ui/PhotoUploadBox';

export class Act4VergerScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private photoBox!: PhotoUploadBox;
  private info!: Phaser.GameObjects.Text;
  private saving = false;
  private spoken = false;

  constructor() {
    super('Act4VergerScene');
  }

  create(): void {
    gameState.setAct('act4');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#f3ebe4');
    this.add.text(18, 14, 'ACTE 4 - Verger (placeholder)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);
    this.photoBox = new PhotoUploadBox(this);

    // Décor léger
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0xffffff, 0.12);
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x000000, 0.04).setStrokeStyle(
      2,
      0xabbca6,
      0.25
    );
    this.add.text(width / 2, height * 0.28, 'Le Verger des confidences', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
    }).setOrigin(0.5);

    this.info = this.add.text(width / 2, height - 70, 'Parlez au Vicomte (Espace/Enter).', {
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
    if (this.photoBox.active) {
      this.inputState.commit();
      return;
    }

    if (act) {
      if (!this.spoken) {
        this.spoken = true;
        this.dialogueBox.start(getDialogue('act4.vergerIntro'), () => this.openVergerMenu());
      } else {
        this.openVergerMenu();
      }
    }

    this.inputState.commit();
  }

  private openAnecdoteForm(): void {
    if (this.formBox.active) return;
    this.formBox.startTextFields({
      title: 'Anecdote (Acte 4)',
      fields: [
        {
          name: 'contenu',
          label: 'Votre anecdote',
          placeholder: 'Une histoire, une rumeur, un souvenir…',
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
        this.info.setText('Le Vicomte consigne vos mots…');
        gameBackend
          .insertAnecdoteForSelected(contenu)
          .then(() => {
            quests.done(QuestFlags.act4AnecdoteDone);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
            } catch {}
            this.info.setText('Anecdote déposée. Merci !');
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

  private openVergerMenu(): void {
    if (this.formBox.active || this.photoBox.active) return;
    this.formBox.startToggles({
      title: 'Le coffret entre deux pommiers',
      toggles: [
        { key: 'photo', label: 'Déposer une photo', value: false },
        { key: 'anecdote', label: 'Confier une anecdote', value: false },
      ],
      onSubmit: (values) => {
        if (values['photo']) {
          this.openPhotoUpload();
          return;
        }
        this.openAnecdoteForm();
      },
    });
  }

  private openPhotoUpload(): void {
    if (this.photoBox.active) return;
    this.photoBox.start({
      title: 'Déposer un cliché (Acte 4)',
      onSubmit: async (file) => {
        await gameBackend.uploadPhotoForSelected(file);
      },
      onDone: () => {
        quests.done(QuestFlags.act4PhotoDone);
        try {
          void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
        } catch {}
        this.info.setText('Photo déposée. Merci !');
      },
    });
  }
}

