import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
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

/** Lointain : défile lentement (px/s, texture qui se répète). */
const PARALLAX_LOINTAIN_SPEED = 24;
/** Proche : défile plus vite. */
const PARALLAX_PROCHE_SPEED = 68;

export class Act0CarrosseScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private optionSprites: Phaser.GameObjects.Sprite[] = [];
  private currentIndex = 0;

  private dialogueBox!: DialogueBox;
  private selectionLocked = false;

  private parallaxLointain!: Phaser.GameObjects.TileSprite;
  private parallaxProche!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Act0CarrosseScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.parallaxLointain = this.add.tileSprite(0, 0, width, height, 'act0-parallax-lointain').setOrigin(0, 0);

    this.parallaxProche = this.add.tileSprite(0, 0, width, height, 'act0-parallax-proche').setOrigin(0, 0);

    this.add.image(width / 2, height / 2, 'act0-carrosse').setDisplaySize(width, height);

    this.add.text(18, 14, 'ACTE 0 — Le carrosse', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f3ebe4',
    });

    this.add.text(width / 2, height * 0.16, 'Choisissez votre personnage', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#f3ebe4',
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
        fontSize: '20px',
        color: '#f2dfc3',
      }).setOrigin(0.5, 0);
      return spr;
    });

    this.dialogueBox = new DialogueBox(this);
    this.inputState = new SceneInput(this);

    this.updateHighlight();
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.parallaxLointain.tilePositionX += PARALLAX_LOINTAIN_SPEED * dt;
    this.parallaxProche.tilePositionX += PARALLAX_PROCHE_SPEED * dt;

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
      try {
        void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
      } catch {}
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
