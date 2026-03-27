import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';
import { getDialogue } from '../data/dialogues.catalog';

export class Act2OfficeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private info!: Phaser.GameObjects.Text;
  private saving = false;
  private player!: Phaser.GameObjects.Rectangle;
  private chef!: Phaser.GameObjects.Rectangle;
  private chefLabel!: Phaser.GameObjects.Text;
  private chefSpoken = false;

  constructor() {
    super('Act2OfficeScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#f3ebe4');
    this.add.text(18, 14, 'ACTE 2 - Cuisine (prototype)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    // Décor cuisine très simple (placeholder)
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0xffffff, 0.18);
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x000000, 0.04).setStrokeStyle(2, 0xabbca6, 0.25);
    this.add.rectangle(width * 0.22, height * 0.35, 220, 46, 0xabbca6, 0.10).setStrokeStyle(1, 0x2a3228, 0.18); // plan de travail
    this.add.rectangle(width * 0.76, height * 0.36, 220, 46, 0xabbca6, 0.10).setStrokeStyle(1, 0x2a3228, 0.18); // plan de travail

    // Joueur + Chef (PNJ)
    this.player = this.add.rectangle(width / 2 - 180, height / 2 + 70, 22, 26, 0xb8956a, 0.75);
    this.player.setStrokeStyle(2, 0x2c2433, 0.25);

    const chefX = width / 2 + 160;
    const chefY = height / 2 - 20;
    this.chef = this.add.rectangle(chefX, chefY, 30, 44, 0x2a3228, 0.16);
    this.chef.setStrokeStyle(2, 0xabbca6, 0.45);
    this.chefLabel = this.add.text(chefX, chefY + 48, 'Le Chef', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#2c2433',
    }).setOrigin(0.5, 0);

    this.info = this.add.text(width / 2, height - 72, 'Parlez au Chef (Espace/Enter ou bouton tactile).', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
      align: 'center',
    }).setOrigin(0.5);
  }

  override update(): void {
    const dt = 1 / 60;
    const act = this.inputState.actionJustDown();
    if (this.dialogueBox.active) {
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      this.info.setVisible(false);
      // champs texte: on laisse la DOM box gérer la saisie.
      this.inputState.commit();
      return;
    }
    this.info.setVisible(true);

    // Déplacement simple
    const moveLeft = this.inputState.moveLeft;
    const moveRight = this.inputState.moveRight;
    const moveUp = this.inputState.moveUp;
    const moveDown = this.inputState.moveDown;
    if (moveLeft || moveRight || moveUp || moveDown) {
      const speed = 160;
      let vx = 0;
      let vy = 0;
      if (moveLeft) vx -= 1;
      if (moveRight) vx += 1;
      if (moveUp) vy -= 1;
      if (moveDown) vy += 1;
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }
      const { width, height } = this.scale;
      this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed * dt, 24, width - 24);
      this.player.y = Phaser.Math.Clamp(this.player.y + vy * speed * dt, 24, height - 24);
    }

    // Interaction Chef -> dialogue -> formulaire
    if (!quests.isDone(QuestFlags.act2AllergensDone)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chef.x, this.chef.y);
      const closeEnough = dist < 78;

      if (closeEnough && act && !this.chefSpoken) {
        this.chefSpoken = true;
        this.dialogueBox.start(getDialogue('act2.chefIntro'), () => {
          this.openHealthForm();
        });
      } else if (closeEnough && act && this.chefSpoken) {
        this.openHealthForm();
      }
    }

    this.inputState.commit();
  }

  private openHealthForm(): void {
    if (this.formBox.active || quests.isDone(QuestFlags.act2AllergensDone)) return;
    this.formBox.startTextFields({
      title: 'Santé & bien-être',
      fields: [
        { name: 'allergenes_alimentaires', label: 'Allergènes (optionnel)', placeholder: 'Noix, gluten…', multiline: true, maxLength: 2000 },
        { name: 'regimes_remarques', label: 'Remarques / régimes (optionnel)', placeholder: 'Végétarien, sans lactose…', multiline: true, maxLength: 2000 },
      ],
      onSubmit: (values) => {
        if (this.saving) return;
        this.saving = true;
        this.info.setText('Sauvegarde en cours…');
        gameBackend
          .recordRsvpForSelected({
            present_reception: false,
            present_repas: false,
            present_soiree: false,
            allergenes_alimentaires: values['allergenes_alimentaires'] || '',
            regimes_remarques: values['regimes_remarques'] || '',
          })
          .then(() => {
            quests.done(QuestFlags.act2AllergensDone);
            this.info.setText('Acte 2 validé. Passage à l’Acte 3…');
            this.time.delayedCall(600, () => {
              gameState.setAct('act3');
              this.scene.start('Act3GrangeScene');
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

  // (le code précédent qui ouvrait le form sur n'importe quel appui est remplacé)
}

