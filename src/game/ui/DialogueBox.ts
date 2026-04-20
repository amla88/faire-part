import Phaser from 'phaser';
import {
  popGameModalTouchOverlayBlock,
  pushGameModalTouchOverlayBlock,
} from '../core/modal-touch-overlay-bridge';
import { createCardGraphics } from './BridgertonCard';
import { sceneHudMaskPop, sceneHudMaskPush } from './scene-hud-mask';

export interface DialogueStep {
  speaker: string;
  text: string;
  /** Couleur d'accent si `portraitTexture` est absent (tint sur `portrait-generic`). */
  portraitColor?: number;
  /** Texture préchargée (ex. `portrait-majordome`). Sinon silhouette générique + tint. */
  portraitTexture?: string;
  /** Taille d'affichage du portrait (en px). Par défaut: silhouettes 72×72. */
  portraitDisplaySize?: { width: number; height: number };
}

export interface DialogueData {
  steps: DialogueStep[];
}

/** Profondeurs : doivent passer au-dessus de tout contenu de scène (y compris les choices). */
const DEPTH_OVERLAY = 500;
const DEPTH_BOX     = 510;
const DEPTH_CONTENT = 520;
const DEPTH_BTN     = 521;

const BTN_W = 72;
const BTN_H = 36;
const BTN_MARGIN_RIGHT = 14;
/** Silhouette `portrait-generic` sans taille dédiée dans le catalogue. */
const DEFAULT_PORTRAIT_SIZE = { width: 72, height: 72 };
const PORTRAIT_PAD_LEFT = 12;
const TEXT_GAP_AFTER_PORTRAIT = 12;
/** Le bas du portrait dépasse légèrement sous la carte (effet « buste » classique). */
const PORTRAIT_BOTTOM_BLEED = 10;

export class DialogueBox {
  private overlay: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private nextBtnBg: Phaser.GameObjects.Graphics;
  private nextBtnLabel: Phaser.GameObjects.Text;
  private nextBtnHit: Phaser.GameObjects.Rectangle;

  private readonly btnX: number;
  private readonly btnY: number;
  private readonly boxX: number;
  private readonly boxY: number;
  private readonly boxW: number;
  private readonly boxH: number;

  private steps: DialogueStep[] = [];
  private index = 0;
  private onDone?: () => void;
  /** Si défini, un `pop` est attendu à la fin du dialogue (après `onDone`). */
  private hudMaskPushed = false;
  /** True tant qu’on a poussé le blocage overlay tactile (évite double push / pop). */
  private touchOverlayBlocked = false;

  public active = false;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    const boxW = Math.floor(width * 0.92);
    const boxH = Math.floor(height * 0.24);
    const x = Math.floor(width / 2);
    const y = Math.floor(height - boxH / 2 - 10);

    this.btnX = x + Math.floor(boxW / 2) - BTN_MARGIN_RIGHT - Math.floor(BTN_W / 2);
    this.btnY = y;
    this.boxX = x;
    this.boxY = y;
    this.boxW = boxW;
    this.boxH = boxH;

    // Voile plein écran semi-transparent
    this.overlay = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setDepth(DEPTH_OVERLAY);

    // Fond de la boite de dialogue
    const g = createCardGraphics(scene, x, y, boxW, boxH);
    this.shadow = g.shadow.setDepth(DEPTH_BOX) as Phaser.GameObjects.Graphics;
    this.bg     = g.card  .setDepth(DEPTH_BOX) as Phaser.GameObjects.Graphics;

    // Portrait : ancrage bas-centre, position recalculée à chaque ligne (taille variable).
    this.portrait = scene.add
      .image(0, 0, 'portrait-generic')
      .setOrigin(0.5, 1)
      .setAlpha(0.95)
      .setDepth(DEPTH_CONTENT);

    this.speakerText = scene.add
      .text(0, y - boxH / 2 + 16, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#2c2433',
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH_CONTENT);

    this.bodyText = scene.add
      .text(0, y - boxH / 2 + 34, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#2c2433',
        wordWrap: { width: 400 },
        lineSpacing: 5,
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH_CONTENT);

    this.layoutPortraitAndText(DEFAULT_PORTRAIT_SIZE);

    // Bouton "Suite ›"
    this.nextBtnBg = scene.add.graphics().setDepth(DEPTH_BTN);
    this.drawNextBtn(false);

    this.nextBtnLabel = scene.add
      .text(this.btnX, this.btnY, 'Suite ›', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f2dfc3',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_BTN);

    this.nextBtnHit = scene.add
      .rectangle(this.btnX, this.btnY, BTN_W, BTN_H, 0x000000, 0)
      .setDepth(DEPTH_BTN);
    this.nextBtnHit.setInteractive({ useHandCursor: true });
    this.nextBtnHit.on('pointerover', () => this.drawNextBtn(true));
    this.nextBtnHit.on('pointerout',  () => this.drawNextBtn(false));
    this.nextBtnHit.on('pointerdown', () => this.next());

    this.hide();
  }

  private drawNextBtn(hovered: boolean): void {
    this.nextBtnBg.clear();
    this.nextBtnBg.fillStyle(hovered ? 0xc4a77d : 0x9e7d55, 0.9);
    this.nextBtnBg.fillRoundedRect(
      this.btnX - BTN_W / 2,
      this.btnY - BTN_H / 2,
      BTN_W,
      BTN_H,
      6,
    );
    this.nextBtnBg.lineStyle(1, 0xf2dfc3, 0.6);
    this.nextBtnBg.strokeRoundedRect(
      this.btnX - BTN_W / 2,
      this.btnY - BTN_H / 2,
      BTN_W,
      BTN_H,
      6,
    );
  }

  start(
    dialogue: DialogueData,
    onDone?: () => void,
    options?: { hideSceneHud?: Phaser.GameObjects.GameObject[] },
  ): void {
    this.steps = dialogue.steps || [];
    this.index = 0;
    this.onDone = onDone;
    this.active = this.steps.length > 0;
    this.hudMaskPushed = false;

    if (this.active) {
      const hud = options?.hideSceneHud;
      if (hud?.length) {
        sceneHudMaskPush(this.scene, hud);
        this.hudMaskPushed = true;
      }
      if (!this.touchOverlayBlocked) {
        pushGameModalTouchOverlayBlock();
        this.touchOverlayBlocked = true;
      }
      this.show();
      this.renderStep();
    } else {
      this.hide();
      this.onDone?.();
    }
  }

  next(): void {
    if (!this.active) return;
    this.index += 1;
    if (this.index >= this.steps.length) {
      this.active = false;
      this.hide();
      const cb = this.onDone;
      this.onDone = undefined;
      cb?.();
      if (this.hudMaskPushed) {
        sceneHudMaskPop(this.scene);
        this.hudMaskPushed = false;
      }
      return;
    }
    this.renderStep();
  }

  private renderStep(): void {
    const step = this.steps[this.index];
    if (!step) return;
    this.speakerText.setText(step.speaker || '');

    const tex = step.portraitTexture?.trim();
    const portraitSize = step.portraitDisplaySize ?? DEFAULT_PORTRAIT_SIZE;
    // `setTexture` peut réinitialiser la taille d’affichage : toujours fixer la taille après la texture.
    if (tex && this.scene.textures.exists(tex)) {
      this.portrait.setTexture(tex);
      this.portrait.clearTint();
    } else {
      this.portrait.setTexture('portrait-generic');
      this.portrait.setTint(step.portraitColor ?? 0xabbca6);
    }
    this.portrait.setDisplaySize(portraitSize.width, portraitSize.height);
    this.layoutPortraitAndText(portraitSize);

    this.bodyText.setText(step.text || '');
  }

  /** Portrait à gauche, bas aligné sous la carte ; texte repoussé selon la largeur du portrait. */
  private layoutPortraitAndText(portraitSize: { width: number; height: number }): void {
    const innerLeft = this.boxX - this.boxW / 2;
    const portraitLeft = innerLeft + PORTRAIT_PAD_LEFT;
    const portraitCenterX = portraitLeft + portraitSize.width / 2;
    const portraitBottomY = this.boxY + this.boxH / 2 + PORTRAIT_BOTTOM_BLEED;
    this.portrait.setPosition(portraitCenterX, portraitBottomY);

    const textX = portraitLeft + portraitSize.width + TEXT_GAP_AFTER_PORTRAIT;
    this.speakerText.setPosition(textX, this.boxY - this.boxH / 2 + 16);
    this.bodyText.setPosition(textX, this.boxY - this.boxH / 2 + 34);

    const innerRight = this.boxX + this.boxW / 2;
    const wrap = Math.max(
      80,
      innerRight - textX - 18 - BTN_W - BTN_MARGIN_RIGHT - 8,
    );
    this.bodyText.setWordWrapWidth(wrap, true);
  }

  private show(): void {
    this.overlay.setVisible(true);
    this.shadow.setVisible(true);
    this.bg.setVisible(true);
    this.portrait.setVisible(true);
    this.speakerText.setVisible(true);
    this.bodyText.setVisible(true);
    this.nextBtnBg.setVisible(true);
    this.nextBtnLabel.setVisible(true);
    this.nextBtnHit.setVisible(true);
    this.nextBtnHit.setInteractive({ useHandCursor: true });
  }

  private hide(): void {
    if (this.touchOverlayBlocked) {
      popGameModalTouchOverlayBlock();
      this.touchOverlayBlocked = false;
    }
    this.overlay.setVisible(false);
    this.shadow.setVisible(false);
    this.bg.setVisible(false);
    this.portrait.setVisible(false);
    this.speakerText.setVisible(false);
    this.bodyText.setVisible(false);
    this.nextBtnBg.setVisible(false);
    this.nextBtnLabel.setVisible(false);
    this.nextBtnHit.setVisible(false);
    this.nextBtnHit.disableInteractive();
  }
}
