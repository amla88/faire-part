import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { SceneInput } from '../systems/SceneInput';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import { quests, QuestFlags } from '../systems/QuestSystem';

export class Act6EcurieScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private info!: Phaser.GameObjects.Text;
  private saving = false;
  private spoken = false;

  constructor() {
    super('Act6EcurieScene');
  }

  create(): void {
    gameState.setAct('act6');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(18, 14, 'ACTE 6 — L’Écurie musicale', {
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
    this.add.text(width / 2, height * 0.28, "L'Écurie musicale", {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
    }).setOrigin(0.5);

    this.info = this.add.text(width / 2, height - 70, 'Parlez au Maestro (Espace/Enter).', {
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
        this.dialogueBox.start(getDialogue('act6.ecurieIntro'), () => this.openMusicForm());
      } else {
        this.openMusicForm();
      }
    }

    this.inputState.commit();
  }

  private openMusicForm(): void {
    if (this.formBox.active) return;
    this.formBox.startTextFields({
      title: 'Air du bal (Acte 6)',
      fields: [
        { name: 'titre', label: 'Titre', placeholder: 'Ex: Dancing Queen', multiline: false, maxLength: 200 },
        { name: 'auteur', label: 'Auteur / Artiste', placeholder: 'Ex: ABBA', multiline: false, maxLength: 200 },
        { name: 'lien', label: 'Lien', placeholder: 'Spotify / YouTube / Deezer…', multiline: false, maxLength: 2000 },
        { name: 'commentaire', label: 'Commentaire (optionnel)', placeholder: 'Pourquoi ce choix ?', multiline: true, maxLength: 2000 },
      ],
      onSubmit: (values) => {
        if (this.saving) return;
        const titre = (values['titre'] || '').trim();
        const auteur = (values['auteur'] || '').trim();
        const lien = (values['lien'] || '').trim();
        const commentaire = (values['commentaire'] || '').trim();

        if (!titre || !auteur || !lien) {
          this.info.setText('Titre, auteur et lien sont requis.');
          return;
        }

        this.saving = true;
        this.info.setText('Le Maestro note votre proposition…');
        gameBackend
          .insertMusiqueManualForSelected({ titre, auteur, lien, commentaire })
          .then(() => {
            quests.done(QuestFlags.act6MusicDone);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
            } catch {}
            this.info.setText('Proposition envoyée. Merci ! (max 3)');
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

