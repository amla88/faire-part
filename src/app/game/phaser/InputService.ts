import Phaser from 'phaser';

type Movement = { up: boolean; down: boolean; left: boolean; right: boolean };

export default class InputService {
  private scene: Phaser.Scene;
  public events: Phaser.Events.EventEmitter;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: { [key: string]: Phaser.Input.Keyboard.Key };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.events = new Phaser.Events.EventEmitter();
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    const k = this.scene.input.keyboard!;
    this.keys = {
      W: k.addKey('W'), A: k.addKey('A'), S: k.addKey('S'), D: k.addKey('D'),
      E: k.addKey('E'), SPACE: k.addKey('SPACE')
    };
  this.keys!['E'].on('down', () => this.events.emit('action'));
  this.keys!['SPACE'].on('down', () => this.events.emit('action'));
  }

  getMovement(): Movement {
    const c = this.cursors;
    const k = this.keys!;
    return {
  up: !!(c.up?.isDown || k['W'].isDown),
  down: !!(c.down?.isDown || k['S'].isDown),
  left: !!(c.left?.isDown || k['A'].isDown),
  right: !!(c.right?.isDown || k['D'].isDown),
    };
  }

  createTouchButtons() {
    // Optional: you can add on-screen buttons if needed later
  }
}
