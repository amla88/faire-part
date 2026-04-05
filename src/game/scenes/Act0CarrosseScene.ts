import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { gameState, PlayerArchetype } from '../core/game-state';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { SceneInput } from '../systems/SceneInput';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import {
  LPC_PLAYER_IDLE_FIRST_FRAMES,
  LPC_TEXTURE_KEY_BY_ARCHETYPE,
  playLpcPlayerIdle,
  setLpcPlayerIdleFrame,
  type LpcFacing,
} from '../data/lpc-garcon';

const ACT0_ARCHETYPES: PlayerArchetype[] = [
  'Lady',
  'Gentleman',
  'Reine de la nuit',
  'Duc de la scene',
];

/** Vue « face caméra » pour la grille de choix. */
const CHOICE_FACING: LpcFacing = 'down';

export class Act0CarrosseScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private optionSprites: Phaser.GameObjects.Sprite[] = [];
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
    this.add.text(18, 14, 'ACTE 0 — Le carrosse', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.add.text(width / 2, height * 0.16, 'Choisissez votre personnage', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
    }).setOrigin(0.5);

    const spriteScale = 2;
    const targets = [
      { x: width * 0.28, y: height * 0.5, label: 'Lady' },
      { x: width * 0.41, y: height * 0.5, label: 'Gentleman' },
      { x: width * 0.59, y: height * 0.5, label: 'Reine de la nuit' },
      { x: width * 0.72, y: height * 0.5, label: 'Duc de la scene' },
    ];
    this.optionSprites = targets.map((t, index) => {
      const tex = LPC_TEXTURE_KEY_BY_ARCHETYPE[ACT0_ARCHETYPES[index]!];
      const spr = this.add
        .sprite(t.x, t.y, tex, LPC_PLAYER_IDLE_FIRST_FRAMES[CHOICE_FACING])
        .setScale(spriteScale);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerover', () => {
        if (this.selectionLocked || this.dialogueBox.active) return;
        if (this.currentIndex === index) return;
        this.currentIndex = index;
        this.updateHighlight();
      });
      spr.on('pointerdown', () => {
        if (this.selectionLocked || this.dialogueBox.active) return;
        this.currentIndex = index;
        this.updateHighlight();
        this.validateSelection();
      });
      const labelY = t.y + 32 * spriteScale + 8;
      this.add.text(t.x, labelY, t.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f2dfc3',
      }).setOrigin(0.5, 0);
      return spr;
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

    if (!this.optionSprites.length) return;

    const leftPressed = this.inputState.leftJustDown();
    const rightPressed = this.inputState.rightJustDown();

    if (leftPressed) {
      this.currentIndex = (this.currentIndex + this.optionSprites.length - 1) % this.optionSprites.length;
      this.updateHighlight();
    } else if (rightPressed) {
      this.currentIndex = (this.currentIndex + 1) % this.optionSprites.length;
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

    const chosen = ACT0_ARCHETYPES[this.currentIndex] ?? 'Lady';
    gameState.setPlayer(chosen);
    quests.done(QuestFlags.act0Chosen);

    this.dialogueBox.start(getDialogue('act0.intro'), () => {
      quests.done(QuestFlags.act0IntroSeen);
      // Sync progression serveur (best-effort)
      try {
        void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
      } catch {}
      // Pas de validation supplémentaire: enchaîner directement sur l'acte 1.
      this.time.delayedCall(50, () => {
        gameState.setAct('act1');
        this.scene.start('Act1CourScene');
      });
    });
  }

  private updateHighlight(): void {
    this.optionSprites.forEach((sprite, index) => {
      if (index === this.currentIndex) {
        sprite.setTint(0xfff2c4);
        playLpcPlayerIdle(this, sprite, CHOICE_FACING);
      } else {
        sprite.clearTint();
        setLpcPlayerIdleFrame(sprite, CHOICE_FACING);
      }
    });
  }
}

