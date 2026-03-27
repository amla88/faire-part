import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { SceneInput } from '../systems/SceneInput';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';

export class Act1CourScene extends Phaser.Scene {
  private inputState!: SceneInput;

  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;

  private player!: Phaser.GameObjects.Rectangle;
  private npc!: Phaser.GameObjects.Rectangle;
  private npcLabel!: Phaser.GameObjects.Text;

  private hintText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;
  private choicesText!: Phaser.GameObjects.Text;
  private saving = false;
  private toChefQueued = false;

  constructor() {
    super('Act1CourScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#f3ebe4');

    // Sol (prototype).
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0xffffff, 0.22);
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x000000, 0.04).setStrokeStyle(2, 0xabbca6, 0.25);

    // Player (placeholder).
    this.player = this.add.rectangle(width / 2 - 140, height / 2 + 60, 22, 26, 0xf5c16c, 0.85);
    this.player.setStrokeStyle(2, 0xf4dfbf, 0.35);

    // PNJ (placeholder) - "Le Majordome".
    const npcX = width / 2 + 130;
    const npcY = height / 2 - 40;
    this.npc = this.add.rectangle(npcX, npcY, 28, 40, 0x4b86c5, 0.3);
    this.npc.setStrokeStyle(2, 0x90c7ff, 0.45);

    this.npcLabel = this.add.text(npcX, npcY + 44, 'M. de La Plume', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f2dfc3',
    }).setOrigin(0.5, 0);

    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);
    this.inputState = new SceneInput(this);

    this.hintText = this.add.text(width / 2, height - 86, 'Approchez le PNJ puis appuyez sur Espace / Parler', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f4dfbf',
      align: 'center',
    }).setOrigin(0.5);

    this.questText = this.add.text(width / 2, height - 62, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8af39a',
      align: 'center',
    }).setOrigin(0.5);

    this.choicesText = this.add.text(width / 2, height - 42, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f4dfbf',
      align: 'center',
    }).setOrigin(0.5);
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;

    const moveLeft = this.inputState.moveLeft;
    const moveRight = this.inputState.moveRight;
    const moveUp = this.inputState.moveUp;
    const moveDown = this.inputState.moveDown;

    const interactJustDown = this.inputState.actionJustDown();

    if (this.dialogueBox.active) {
      if (interactJustDown) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      this.formBox.handleToggleInput({
        up: this.inputState.upJustDown(),
        down: this.inputState.downJustDown(),
        left: this.inputState.leftJustDown(),
        right: this.inputState.rightJustDown(),
        action: interactJustDown,
      });
      this.inputState.commit();
      return;
    }

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
      const minX = 24;
      const maxX = width - 24;
      const minY = 24;
      const maxY = height - 24;

      this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed * dt, minX, maxX);
      this.player.y = Phaser.Math.Clamp(this.player.y + vy * speed * dt, minY, maxY);
    }

    if (!quests.isDone(QuestFlags.act1RegisterDone)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y);
      const closeEnough = dist < 70;

      if (closeEnough && interactJustDown) {
        this.choicesText.setText('Consultation du registre…');
        gameBackend
          .getSelectedPersonneRow()
          .then((row) => {
            this.choicesText.setText('');
            const defaults = row
              ? {
                  present_reception: row.present_reception === true,
                  present_repas: row.present_repas === true,
                  present_soiree: row.present_soiree === true,
                }
              : undefined;

            // IMPORTANT: même si "tout est false", on doit préremplir depuis la DB
            // pour éviter de réécrire des valeurs par défaut.
            const alreadyHasAnything =
              !!row &&
              (row.present_reception === true ||
                row.present_repas === true ||
                row.present_soiree === true ||
                String(row.allergenes_alimentaires || '').trim().length > 0 ||
                String(row.regimes_remarques || '').trim().length > 0);

            const dlg = alreadyHasAnything ? getDialogue('act1.already') : getDialogue('act1.register');
            this.dialogueBox.start(dlg, () => {
              if (alreadyHasAnything) {
                this.questText.setText('Registre déjà rempli (modifiable).');
                this.hintText.setText('Vous pouvez confirmer ou ajuster.');
              }
              this.openRegisterChoices(defaults);
            });
          })
          .catch(() => {
            this.choicesText.setText('');
            this.dialogueBox.start(getDialogue('act1.register'), () => {
              this.openRegisterChoices();
            });
          });
      }
    }

    this.inputState.commit();
  }

  private openRegisterChoices(defaults?: {
    present_reception?: boolean;
    present_repas?: boolean;
    present_soiree?: boolean;
  }): void {
    this.formBox.startToggles({
      title: 'Présence au domaine',
      toggles: [
        { key: 'present_reception', label: 'Réception', value: defaults?.present_reception ?? false },
        { key: 'present_repas', label: 'Repas', value: defaults?.present_repas ?? false },
        { key: 'present_soiree', label: 'Soirée', value: defaults?.present_soiree ?? false },
      ],
      onSubmit: (values) => {
        if (this.saving) return;
        this.saving = true;
        this.choicesText.setText('Enregistrement en cours…');
        gameBackend
          .recordRsvpForSelected({
            present_reception: !!values['present_reception'],
            present_repas: !!values['present_repas'],
            present_soiree: !!values['present_soiree'],
          })
          .then(() => {
            quests.done(QuestFlags.act1RegisterDone);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            this.questText.setText('Présence consignée dans le registre !');
            this.hintText.setText('Un dernier message…');
            this.choicesText.setText('');
            this.playToChefThenGoAct2();
          })
          .catch((e) => {
            this.choicesText.setText('');
            this.hintText.setText('Erreur en sauvegardant. Réessayez.');
            this.questText.setText(String(e?.message || e));
          })
          .finally(() => {
            this.saving = false;
          });
      },
    });
  }

  private playToChefThenGoAct2(): void {
    if (this.toChefQueued) return;
    this.toChefQueued = true;
    this.dialogueBox.start(getDialogue('act1.toChef'), () => {
      this.time.delayedCall(200, () => {
        gameState.setAct('act2');
        this.scene.start('Act2OfficeScene');
      });
    });
  }
}

