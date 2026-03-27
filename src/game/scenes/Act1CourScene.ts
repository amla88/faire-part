import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { act1RegisterDialogue } from '../data/act1.dialogues';
import { virtualInputState } from '../core/input-state';

export class Act1CourScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zqsd!: Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;

  private dialogueBox!: DialogueBox;

  private player!: Phaser.GameObjects.Rectangle;
  private npc!: Phaser.GameObjects.Rectangle;
  private npcLabel!: Phaser.GameObjects.Text;
  private questDone = false;

  private hintText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;

  private prevInteract = false;
  private prevConfirm = false;

  constructor() {
    super('Act1CourScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#231f2a');

    // Sol (prototype).
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x2b2534, 0.95);
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x000000, 0.08).setStrokeStyle(3, 0xc9a55c, 0.3);

    // Player (placeholder).
    this.player = this.add.rectangle(width / 2 - 140, height / 2 + 60, 22, 26, 0xf5c16c, 0.85);
    this.player.setStrokeStyle(2, 0xf4dfbf, 0.35);

    // PNJ (placeholder) - "Le Majordome".
    const npcX = width / 2 + 130;
    const npcY = height / 2 - 40;
    this.npc = this.add.rectangle(npcX, npcY, 28, 40, 0x4b86c5, 0.3);
    this.npc.setStrokeStyle(2, 0x90c7ff, 0.45);

    this.npcLabel = this.add.text(npcX, npcY + 44, 'Majordome', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f2dfc3',
    }).setOrigin(0.5, 0);

    this.dialogueBox = new DialogueBox(this);

    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.zqsd = this.input.keyboard?.addKeys('Z,Q,S,D,SPACE') as Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;

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
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;

    const moveLeft =
      !!this.cursors.left?.isDown ||
      !!this.zqsd.Q?.isDown ||
      !!virtualInputState.left;
    const moveRight =
      !!this.cursors.right?.isDown ||
      !!this.zqsd.D?.isDown ||
      !!virtualInputState.right;
    const moveUp =
      !!this.cursors.up?.isDown ||
      !!this.zqsd.Z?.isDown ||
      !!virtualInputState.up;
    const moveDown =
      !!this.cursors.down?.isDown ||
      !!this.zqsd.S?.isDown ||
      !!virtualInputState.down;

    const spaceOrEnterJustDown =
      Phaser.Input.Keyboard.JustDown(this.cursors.space!) ||
      Phaser.Input.Keyboard.JustDown(this.zqsd.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER));

    const confirmJustDown = virtualInputState.confirm && !this.prevConfirm;

    const interactJustDown =
      spaceOrEnterJustDown ||
      (virtualInputState.interact && !this.prevInteract) ||
      confirmJustDown;

    if (this.dialogueBox.active) {
      if (interactJustDown) this.dialogueBox.next();
      this.prevInteract = virtualInputState.interact;
      this.prevConfirm = virtualInputState.confirm;
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

    if (!this.questDone) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y);
      const closeEnough = dist < 70;

      if (closeEnough && interactJustDown) {
        this.dialogueBox.start(act1RegisterDialogue, () => {
          this.questDone = true;
          this.questText.setText('Quête du registre validée (prototype) !');
          this.hintText.setText('Bravo. Prototype terminé pour Phase B.');
        });
      }
    }

    this.prevInteract = virtualInputState.interact;
    this.prevConfirm = virtualInputState.confirm;
  }
}

