import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { act0IntroDialogue } from '../data/act0.dialogues';
import { virtualInputState } from '../core/input-state';

export class Act0CarrosseScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zqsd!: Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private optionRects: Phaser.GameObjects.Rectangle[] = [];
  private currentIndex = 0;

  private dialogueBox!: DialogueBox;
  private dialogueDone = false;
  private prevConfirm = false;

  constructor() {
    super('Act0CarrosseScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#2c2433');

    // Faux decor de "carrosse" pixelise pour un prototype de deplacement.
    const room = this.add.rectangle(width / 2, height / 2, width * 0.86, height * 0.74, 0x4b3b33);
    room.setStrokeStyle(6, 0xc9a55c, 0.9);

    this.add.rectangle(width / 2, height * 0.28, width * 0.66, 32, 0x6b4f44);
    this.add.rectangle(width / 2, height * 0.72, width * 0.66, 32, 0x6b4f44);
    this.add.text(18, 14, 'ACTE 0 - Carrosse (prototype)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f8e8c9',
    });

    this.add.text(width / 2, height * 0.16, 'Choisissez votre personnage', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f4dfbf',
    }).setOrigin(0.5);

    // Silhouettes cible (placeholder).
    const targets = [
      { x: width * 0.28, y: height * 0.5, label: 'Lady' },
      { x: width * 0.41, y: height * 0.5, label: 'Gentleman' },
      { x: width * 0.59, y: height * 0.5, label: 'Reine de la nuit' },
      { x: width * 0.72, y: height * 0.5, label: 'Duc de la scene' },
    ];
    this.optionRects = targets.map((t) => {
      const rect = this.add.rectangle(t.x, t.y, 24, 38, 0x1b1821);
      this.add.text(t.x, t.y + 30, t.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f2dfc3',
      }).setOrigin(0.5, 0);
      return rect;
    });

    this.dialogueBox = new DialogueBox(this);

    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.zqsd = this.input.keyboard?.addKeys(
      'Z,Q,S,D,SPACE'
    ) as Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;

    this.updateHighlight();
  }

  override update(_: number, delta: number): void {
    const spaceOrEnterJustDown =
      Phaser.Input.Keyboard.JustDown(this.zqsd.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.space!) ||
      Phaser.Input.Keyboard.JustDown(this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER));

    const confirmJustDown = virtualInputState.confirm && !this.prevConfirm;
    const validate = spaceOrEnterJustDown || confirmJustDown;

    if (this.dialogueBox.active) {
      if (validate) this.dialogueBox.next();
      this.prevConfirm = virtualInputState.confirm;
      return;
    }

    if (this.dialogueDone) {
      if (validate) {
        this.scene.start('Act1CourScene');
      }
      this.prevConfirm = virtualInputState.confirm;
      return;
    }

    if (!this.optionRects.length) return;

    const leftPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.left!) ||
      Phaser.Input.Keyboard.JustDown(this.zqsd.Q);
    const rightPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.right!) ||
      Phaser.Input.Keyboard.JustDown(this.zqsd.D);

    if (leftPressed) {
      this.currentIndex = (this.currentIndex + this.optionRects.length - 1) % this.optionRects.length;
      this.updateHighlight();
    } else if (rightPressed) {
      this.currentIndex = (this.currentIndex + 1) % this.optionRects.length;
      this.updateHighlight();
    }

    if (validate && !this.dialogueDone) {
      // Dialogue d'accueil (Phase B) après la sélection.
      this.dialogueBox.start(act0IntroDialogue, () => {
        this.dialogueDone = true;
        this.add.text(this.scale.width / 2, this.scale.height - 90, 'Acte 0 terminé. Appuyez sur Espace.', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#f4dfbf',
        }).setOrigin(0.5);
      });
    }

    this.prevConfirm = virtualInputState.confirm;
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

