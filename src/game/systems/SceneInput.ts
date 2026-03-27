import Phaser from 'phaser';
import { virtualInputState } from '../core/input-state';

export class SceneInput {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private enter: Phaser.Input.Keyboard.Key;

  private prevInteract = false;
  private prevConfirm = false;

  constructor(private scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.keys = scene.input.keyboard?.addKeys('Z,Q,S,D,SPACE') as Record<
      'Z' | 'Q' | 'S' | 'D' | 'SPACE',
      Phaser.Input.Keyboard.Key
    >;
    this.enter = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  leftJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.cursors.left!) || Phaser.Input.Keyboard.JustDown(this.keys.Q);
  }

  rightJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.cursors.right!) || Phaser.Input.Keyboard.JustDown(this.keys.D);
  }

  upJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.cursors.up!) || Phaser.Input.Keyboard.JustDown(this.keys.Z);
  }

  downJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.cursors.down!) || Phaser.Input.Keyboard.JustDown(this.keys.S);
  }

  get moveLeft(): boolean {
    return !!this.cursors.left?.isDown || !!this.keys.Q?.isDown || !!virtualInputState.left;
  }
  get moveRight(): boolean {
    return !!this.cursors.right?.isDown || !!this.keys.D?.isDown || !!virtualInputState.right;
  }
  get moveUp(): boolean {
    return !!this.cursors.up?.isDown || !!this.keys.Z?.isDown || !!virtualInputState.up;
  }
  get moveDown(): boolean {
    return !!this.cursors.down?.isDown || !!this.keys.S?.isDown || !!virtualInputState.down;
  }

  /** Action unique: Espace / Enter / tactile (interact ou confirm) */
  actionJustDown(): boolean {
    const keyJustDown =
      Phaser.Input.Keyboard.JustDown(this.cursors.space!) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.enter);

    const interactJustDown = virtualInputState.interact && !this.prevInteract;
    const confirmJustDown = virtualInputState.confirm && !this.prevConfirm;

    return keyJustDown || interactJustDown || confirmJustDown;
  }

  /** A appeler en fin de update() pour enregistrer les états tactiles */
  commit(): void {
    this.prevInteract = virtualInputState.interact;
    this.prevConfirm = virtualInputState.confirm;
  }
}

