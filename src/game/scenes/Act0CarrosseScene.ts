import Phaser from 'phaser';
import { virtualInputState } from '../core/input-state';

export class Act0CarrosseScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zqsd!: Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Rectangle;
  private speed = 150;

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

    this.add.text(width / 2, height * 0.16, 'Deplacez-vous vers les silhouettes', {
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
    targets.forEach((t) => {
      this.add.rectangle(t.x, t.y, 24, 38, 0x1b1821);
      this.add.text(t.x, t.y + 30, t.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f2dfc3',
      }).setOrigin(0.5, 0);
    });

    this.player = this.add.rectangle(width / 2, height * 0.6, 16, 16, 0x7ed2ff);
    this.player.setStrokeStyle(2, 0xffffff);

    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.zqsd = this.input.keyboard?.addKeys(
      'Z,Q,S,D,SPACE'
    ) as Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;

    // Limites de deplacement dans le decor.
    const body = this.player;
    body.setData('minX', room.x - room.width / 2 + 14);
    body.setData('maxX', room.x + room.width / 2 - 14);
    body.setData('minY', room.y - room.height / 2 + 14);
    body.setData('maxY', room.y + room.height / 2 - 14);
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;
    const dir = this.readDirection();

    const nx = this.player.x + dir.x * this.speed * dt;
    const ny = this.player.y + dir.y * this.speed * dt;

    const minX = this.player.getData('minX') as number;
    const maxX = this.player.getData('maxX') as number;
    const minY = this.player.getData('minY') as number;
    const maxY = this.player.getData('maxY') as number;

    this.player.x = Phaser.Math.Clamp(nx, minX, maxX);
    this.player.y = Phaser.Math.Clamp(ny, minY, maxY);
  }

  private readDirection(): { x: number; y: number } {
    const kLeft = !!(this.cursors?.left?.isDown || this.zqsd?.Q?.isDown);
    const kRight = !!(this.cursors?.right?.isDown || this.zqsd?.D?.isDown);
    const kUp = !!(this.cursors?.up?.isDown || this.zqsd?.Z?.isDown);
    const kDown = !!(this.cursors?.down?.isDown || this.zqsd?.S?.isDown);

    const left = kLeft || virtualInputState.left;
    const right = kRight || virtualInputState.right;
    const up = kUp || virtualInputState.up;
    const down = kDown || virtualInputState.down;

    let x = 0;
    let y = 0;
    if (left) x -= 1;
    if (right) x += 1;
    if (up) y -= 1;
    if (down) y += 1;

    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }

    return { x, y };
  }
}

