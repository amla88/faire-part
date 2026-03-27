import Phaser from 'phaser';
import { virtualInputState } from '../core/input-state';

export class SceneInput {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Record<'Z' | 'Q' | 'S' | 'D' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private enter: Phaser.Input.Keyboard.Key;

  private prevInteract = false;
  private prevConfirm = false;
  private prevUp = false;
  private prevDown = false;
  private prevLeft = false;
  private prevRight = false;

  constructor(private scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.keys = scene.input.keyboard?.addKeys('Z,Q,S,D,SPACE') as Record<
      'Z' | 'Q' | 'S' | 'D' | 'SPACE',
      Phaser.Input.Keyboard.Key
    >;
    this.enter = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  leftJustDown(): boolean {
    const key = Phaser.Input.Keyboard.JustDown(this.cursors.left!) || Phaser.Input.Keyboard.JustDown(this.keys.Q);
    const virt = virtualInputState.left && !this.prevLeft;
    return key || virt;
  }

  rightJustDown(): boolean {
    const key = Phaser.Input.Keyboard.JustDown(this.cursors.right!) || Phaser.Input.Keyboard.JustDown(this.keys.D);
    const virt = virtualInputState.right && !this.prevRight;
    return key || virt;
  }

  upJustDown(): boolean {
    const key = Phaser.Input.Keyboard.JustDown(this.cursors.up!) || Phaser.Input.Keyboard.JustDown(this.keys.Z);
    const virt = virtualInputState.up && !this.prevUp;
    return key || virt;
  }

  downJustDown(): boolean {
    const key = Phaser.Input.Keyboard.JustDown(this.cursors.down!) || Phaser.Input.Keyboard.JustDown(this.keys.S);
    const virt = virtualInputState.down && !this.prevDown;
    return key || virt;
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
    this.prevUp = virtualInputState.up;
    this.prevDown = virtualInputState.down;
    this.prevLeft = virtualInputState.left;
    this.prevRight = virtualInputState.right;
  }
}

