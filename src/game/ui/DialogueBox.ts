import Phaser from 'phaser';
import { createCardGraphics } from './BridgertonCard';

export interface DialogueStep {
  speaker: string;
  text: string;
  /** Couleur d'accent si `portraitTexture` est absent (tint sur `portrait-generic`). */
  portraitColor?: number;
  /** Texture préchargée (ex. `portrait-majordome`). Sinon silhouette générique + tint. */
  portraitTexture?: string;
  /** Taille d'affichage du portrait (en px). Par défaut: 46x46. */
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
const DEFAULT_PORTRAIT_SIZE = { width: 46, height: 46 };

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

  private steps: DialogueStep[] = [];
  private index = 0;
  private onDone?: () => void;

  public active = false;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    const boxW = Math.floor(width * 0.92);
    const boxH = Math.floor(height * 0.24);
    const x = Math.floor(width / 2);
    const y = Math.floor(height - boxH / 2 - 10);

    this.btnX = x + Math.floor(boxW / 2) - BTN_MARGIN_RIGHT - Math.floor(BTN_W / 2);
    this.btnY = y;

    // Voile plein écran semi-transparent
    this.overlay = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setDepth(DEPTH_OVERLAY);

    // Fond de la boite de dialogue
    const g = createCardGraphics(scene, x, y, boxW, boxH);
    this.shadow = g.shadow.setDepth(DEPTH_BOX) as Phaser.GameObjects.Graphics;
    this.bg     = g.card  .setDepth(DEPTH_BOX) as Phaser.GameObjects.Graphics;

    // Portrait pixel
    this.portrait = scene.add
      .image(x - boxW / 2 + 28, y, 'portrait-generic')
      .setDisplaySize(DEFAULT_PORTRAIT_SIZE.width, DEFAULT_PORTRAIT_SIZE.height)
      .setAlpha(0.95)
      .setDepth(DEPTH_CONTENT);

    this.speakerText = scene.add
      .text(x - boxW / 2 + 88, y - boxH / 2 + 16, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#2c2433',
      })
      .setDepth(DEPTH_CONTENT);

    // La largeur du corps laisse de la place pour le bouton à droite
    const bodyMaxW = boxW - 88 - 18 - BTN_W - BTN_MARGIN_RIGHT - 8;
    this.bodyText = scene.add
      .text(x - boxW / 2 + 88, y - boxH / 2 + 34, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#2c2433',
        wordWrap: { width: bodyMaxW },
        lineSpacing: 5,
      })
      .setDepth(DEPTH_CONTENT);

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

  start(dialogue: DialogueData, onDone?: () => void): void {
    this.steps = dialogue.steps || [];
    this.index = 0;
    this.onDone = onDone;
    this.active = this.steps.length > 0;

    if (this.active) {
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
      this.onDone?.();
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
    this.portrait.setDisplaySize(portraitSize.width, portraitSize.height);
    if (tex && this.scene.textures.exists(tex)) {
      this.portrait.setTexture(tex);
      this.portrait.clearTint();
    } else {
      this.portrait.setTexture('portrait-generic');
      this.portrait.setTint(step.portraitColor ?? 0xabbca6);
    }

    this.bodyText.setText(step.text || '');
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
