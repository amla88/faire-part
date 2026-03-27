import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { gameState, PlayerArchetype } from '../core/game-state';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { SceneInput } from '../systems/SceneInput';
import { getDialogue } from '../data/dialogues.catalog';

export class Act0CarrosseScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private optionRects: Phaser.GameObjects.Rectangle[] = [];
  private currentIndex = 0;

  private dialogueBox!: DialogueBox;
  private selectionLocked = false;

  constructor() {
    super('Act0CarrosseScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#f3ebe4');

    // Faux decor de "carrosse" pixelise pour un prototype de deplacement.
    const room = this.add.rectangle(width / 2, height / 2, width * 0.86, height * 0.74, 0x4b3b33);
    room.setStrokeStyle(6, 0xc9a55c, 0.9);

    this.add.rectangle(width / 2, height * 0.28, width * 0.66, 32, 0x6b4f44);
    this.add.rectangle(width / 2, height * 0.72, width * 0.66, 32, 0x6b4f44);
    this.add.text(18, 14, 'ACTE 0 - Carrosse (prototype)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.add.text(width / 2, height * 0.16, 'Choisissez votre personnage', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
    }).setOrigin(0.5);

    // Silhouettes cible (placeholder).
    const targets = [
      { x: width * 0.28, y: height * 0.5, label: 'Lady' },
      { x: width * 0.41, y: height * 0.5, label: 'Gentleman' },
      { x: width * 0.59, y: height * 0.5, label: 'Reine de la nuit' },
      { x: width * 0.72, y: height * 0.5, label: 'Duc de la scene' },
    ];
    this.optionRects = targets.map((t, index) => {
      const rect = this.add.rectangle(t.x, t.y, 24, 38, 0x1b1821);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', () => {
        if (this.selectionLocked || this.dialogueBox.active) return;
        this.currentIndex = index;
        this.updateHighlight();
        this.validateSelection();
      });
      this.add.text(t.x, t.y + 30, t.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f2dfc3',
      }).setOrigin(0.5, 0);
      return rect;
    });

    this.dialogueBox = new DialogueBox(this);
    this.inputState = new SceneInput(this);

    this.updateHighlight();
  }

  override update(_: number, delta: number): void {
    const validate = this.inputState.actionJustDown();

    if (this.dialogueBox.active) {
      if (validate) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (!this.optionRects.length) return;

    const leftPressed = this.inputState.leftJustDown();
    const rightPressed = this.inputState.rightJustDown();

    if (leftPressed) {
      this.currentIndex = (this.currentIndex + this.optionRects.length - 1) % this.optionRects.length;
      this.updateHighlight();
    } else if (rightPressed) {
      this.currentIndex = (this.currentIndex + 1) % this.optionRects.length;
      this.updateHighlight();
    }

    if (validate) {
      this.validateSelection();
    }

    this.inputState.commit();
  }

  private validateSelection(): void {
    if (this.selectionLocked || this.dialogueBox.active) return;
    this.selectionLocked = true;

    const labels: PlayerArchetype[] = ['Lady', 'Gentleman', 'Reine de la nuit', 'Duc de la scene'];
    const chosen = labels[this.currentIndex] ?? 'Lady';
    gameState.setPlayer(chosen);
    quests.done(QuestFlags.act0Chosen);

    this.dialogueBox.start(getDialogue('act0.intro'), () => {
      quests.done(QuestFlags.act0IntroSeen);
      // Pas de validation supplémentaire: enchaîner directement sur l'acte 1.
      this.time.delayedCall(50, () => {
        gameState.setAct('act1');
        this.scene.start('Act1CourScene');
      });
    });
  }

  private updateHighlight(): void {
    this.optionRects.forEach((rect, index) => {
      if (index === this.currentIndex) {
        rect.setStrokeStyle(3, 0xf5c16c, 1);
      } else {
        rect.setStrokeStyle(1, 0x000000, 0.5);
      }
    });
  }
}

