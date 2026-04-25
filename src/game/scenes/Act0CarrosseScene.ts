import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { DialogueBox } from '../ui/DialogueBox';
import { gameState, PlayerArchetype } from '../core/game-state';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { SceneInput } from '../systems/SceneInput';
import { isHubFreeRoamUnlocked } from '../core/act-routing';
import { registerRequestDomainMapListener } from '../core/open-domain-map';
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

/** Panneau / zone de clic par choix (sprite 64×64 à l’échelle 2 + libellé). */
const CHOICE_SLOT_W = 130;
const CHOICE_SLOT_H = 190;
/** Décalage vertical du panneau dans le container (permet de couvrir sprite + texte). */
const CHOICE_SLOT_PANEL_Y = 26;
/** Largeur max du libellé : cadre − 5 px (retour à la ligne si besoin). */
const CHOICE_LABEL_MAX_WIDTH = CHOICE_SLOT_W - 5;
/** Profondeurs relatives dans le container. */
const DEPTH_CHOICE_PANEL = 0;
const DEPTH_CHOICE_SPRITE = 1;
const DEPTH_CHOICE_LABEL = 2;

export class Act0CarrosseScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private choiceContainers: Phaser.GameObjects.Container[] = [];
  private choiceHitAreas: Phaser.GameObjects.Rectangle[] = [];
  private optionSprites: Phaser.GameObjects.Sprite[] = [];
  private choiceSlotPanels: Phaser.GameObjects.Rectangle[] = [];
  private currentIndex = 0;

  private dialogueBox!: DialogueBox;
  private selectionLocked = false;

  private parallaxLointain!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Act0CarrosseScene');
  }

  create(): void {
    gameState.setAct('act0');
    // La même instance de Scene peut être réutilisée par Phaser : on reset l'état.
    this.selectionLocked = false;
    this.currentIndex = 0;
    this.choiceContainers = [];
    this.choiceHitAreas = [];
    this.optionSprites = [];
    this.choiceSlotPanels = [];

    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.parallaxLointain = this.add.tileSprite(0, 50, width, height, 'act0-parallax-lointain').setOrigin(0, 0);

    this.add.image(width / 2, height / 2, 'act0-carrosse').setDisplaySize(width, height);

    this.add.text(18, 14, 'ACTE 0 — Le carrosse', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f4dfbf',
    });

    this.add.text(width / 2, height * 0.90, 'Choisissez votre personnage', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#f4dfbf',
    }).setOrigin(0.5);

    const spriteScale = 2;
    const firstChoiceX = width * 0.28;
    const lastChoiceX = width * 0.72;
    const choiceStepX = (lastChoiceX - firstChoiceX) / 3;
    const targets = [
      { x: firstChoiceX, y: height * 0.6, label: 'Lady' },
      { x: firstChoiceX + choiceStepX, y: height * 0.6, label: 'Gentleman' },
      { x: firstChoiceX + choiceStepX * 2, y: height * 0.6, label: 'Reine de la nuit' },
      { x: lastChoiceX, y: height * 0.6, label: 'Duc de la scene' },
    ];

    this.choiceContainers = [];
    this.choiceHitAreas = [];
    this.optionSprites = [];
    this.choiceSlotPanels = [];

    targets.forEach((t, index) => {
      // Container centré sur la position cible : plus simple à gérer pour les hit-tests
      const container = this.add.container(t.x, t.y);
      container.setSize(CHOICE_SLOT_W, CHOICE_SLOT_H);
      container.setDepth(DEPTH_CHOICE_PANEL);

      const panel = this.add
        .rectangle(0, CHOICE_SLOT_PANEL_Y, CHOICE_SLOT_W, CHOICE_SLOT_H, 0x1a1410, 0.8)
        .setStrokeStyle(2, 0xc4a77d, 0.85)
        .setDepth(DEPTH_CHOICE_PANEL);

      const tex = LPC_TEXTURE_KEY_BY_ARCHETYPE[ACT0_ARCHETYPES[index]!];
      const spr = this.add
        .sprite(0, 0, tex, LPC_PLAYER_IDLE_FIRST_FRAMES[CHOICE_FACING])
        .setScale(spriteScale)
        .setDepth(DEPTH_CHOICE_SPRITE);

      const labelYLocal = 32 * spriteScale + 8;
      const label = this.add
        .text(0, labelYLocal, t.label, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#f2dfc3',
          align: 'center',
          wordWrap: { width: CHOICE_LABEL_MAX_WIDTH },
        })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH_CHOICE_LABEL);

      container.add([panel, spr, label]);

      // Hitbox monde, alignée exactement sur le panneau visuel.
      const hitArea = this.add
        .rectangle(t.x, t.y + CHOICE_SLOT_PANEL_Y, CHOICE_SLOT_W, CHOICE_SLOT_H, 0xffffff, 0.001);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => this.onChoicePointerOver(index));
      hitArea.on('pointerdown', () => this.onChoicePointerDown(index));

      this.choiceContainers.push(container);
      this.choiceHitAreas.push(hitArea);
      this.choiceSlotPanels.push(panel);
      this.optionSprites.push(spr);
    });

    this.dialogueBox = new DialogueBox(this);
    this.inputState = new SceneInput(this);

    registerRequestDomainMapListener(this, () => {
      this.dialogueBox.forceAbort();
    });

    this.updateHighlight();
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.parallaxLointain.tilePositionX += PARALLAX_LOINTAIN_SPEED * dt;

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

  private onChoicePointerOver(index: number): void {
    if (this.selectionLocked || this.dialogueBox.active) return;
    if (this.currentIndex === index) return;
    this.currentIndex = index;
    this.updateHighlight();
  }

  private onChoicePointerDown(index: number): void {
    if (this.selectionLocked || this.dialogueBox.active) return;
    this.currentIndex = index;
    this.updateHighlight();
    this.validateSelection();
  }

  private validateSelection(): void {
    if (this.selectionLocked || this.dialogueBox.active) return;
    this.selectionLocked = true;
    // Masquer toute la grille de choix une fois la sélection faite.
    this.choiceContainers.forEach((c) => {
      c.setVisible(false);
    });
    this.choiceHitAreas.forEach((hit) => {
      hit.disableInteractive();
      hit.setVisible(false);
    });

    const chosen = ACT0_ARCHETYPES[this.currentIndex] ?? 'Lady';
    gameState.setPlayer(chosen);
    quests.done(QuestFlags.act0Chosen);

    this.dialogueBox.start(getDialogue('act0.intro'), () => {
      quests.done(QuestFlags.act0IntroSeen);
      try {
        void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
      } catch {}
      this.time.delayedCall(50, () => {
        if (isHubFreeRoamUnlocked()) {
          gameState.setAct('hub');
          this.scene.start('HubOpenWorldScene');
        } else {
          gameState.setAct('act1');
          this.scene.start('Act1CourScene');
        }
      });
    });
  }

  private updateHighlight(): void {
    this.optionSprites.forEach((sprite, index) => {
      const panel = this.choiceSlotPanels[index];
      if (panel) {
        if (index === this.currentIndex) {
          panel.setFillStyle(0x2a2218, 0.62);
          panel.setStrokeStyle(3, 0xfff2c4, 1);
        } else {
          panel.setFillStyle(0x1a1410, 0.5);
          panel.setStrokeStyle(2, 0xc4a77d, 0.85);
        }
      }
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
