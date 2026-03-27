import Phaser from 'phaser';

export interface DialogueStep {
  speaker: string;
  text: string;
  portraitColor?: number;
}

export interface DialogueData {
  steps: DialogueStep[];
}

export class DialogueBox {
  private bg: Phaser.GameObjects.Rectangle;
  private portrait: Phaser.GameObjects.Rectangle;
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

    // Palette "vert sauge" (alignée sur le site)
    const sageDeep = 0x2a3228;
    const sage = 0xabbca6;
    const cream = 0xfaf6f1;

    this.bg = scene.add.rectangle(x, y, boxW, boxH, sageDeep, 0.92);
    this.bg.setStrokeStyle(2, sage, 0.6);

    this.portrait = scene.add.rectangle(x - boxW / 2 + 28, y, 46, 46, sage, 0.22);
    this.portrait.setStrokeStyle(2, cream, 0.35);

    this.speakerText = scene.add.text(x - boxW / 2 + 88, y - boxH / 2 + 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#faf6f1',
    });

    this.bodyText = scene.add.text(x - boxW / 2 + 88, y - boxH / 2 + 34, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f3ebe4',
      wordWrap: { width: boxW - 88 - 18 },
      lineSpacing: 4,
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

    if (typeof step.portraitColor === 'number') {
      this.portrait.setFillStyle(step.portraitColor, 0.35);
    }

    this.bodyText.setText(step.text || '');
  }

  private show(): void {
    this.bg.setVisible(true);
    this.portrait.setVisible(true);
    this.speakerText.setVisible(true);
    this.bodyText.setVisible(true);
  }

  private hide(): void {
    this.bg.setVisible(false);
    this.portrait.setVisible(false);
    this.speakerText.setVisible(false);
    this.bodyText.setVisible(false);
  }
}

