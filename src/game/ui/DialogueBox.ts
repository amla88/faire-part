import Phaser from 'phaser';
import { createCardGraphics } from './BridgertonCard';

export interface DialogueStep {
  speaker: string;
  text: string;
  /** Couleur d’accent si `portraitTexture` est absent (tint sur `portrait-generic`). */
  portraitColor?: number;
  /** Texture préchargée (ex. `portrait-majordome`). Sinon silhouette générique + tint. */
  portraitTexture?: string;
}

export interface DialogueData {
  steps: DialogueStep[];
}

export class DialogueBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;

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

    // Style "card" du site (crème + bord doré doux).
    const g = createCardGraphics(scene, x, y, boxW, boxH);
    this.shadow = g.shadow;
    this.bg = g.card;

    // Portrait pixel (texture `portrait-generic` ou clé dédiée préchargée).
    this.portrait = scene.add.image(x - boxW / 2 + 28, y, 'portrait-generic');
    this.portrait.setDisplaySize(46, 46);
    this.portrait.setAlpha(0.95);

    this.speakerText = scene.add.text(x - boxW / 2 + 88, y - boxH / 2 + 16, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#2c2433',
    });

    this.bodyText = scene.add.text(x - boxW / 2 + 88, y - boxH / 2 + 34, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#2c2433',
      wordWrap: { width: boxW - 88 - 18 },
      lineSpacing: 5,
    });

    this.hide();
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
    this.shadow.setVisible(true);
    this.bg.setVisible(true);
    this.portrait.setVisible(true);
    this.speakerText.setVisible(true);
    this.bodyText.setVisible(true);
  }

  private hide(): void {
    this.shadow.setVisible(false);
    this.bg.setVisible(false);
    this.portrait.setVisible(false);
    this.speakerText.setVisible(false);
    this.bodyText.setVisible(false);
  }
}

