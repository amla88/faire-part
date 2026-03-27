import Phaser from 'phaser';
import { SceneInput } from '../systems/SceneInput';
import { gameState } from '../core/game-state';

export class HubOpenWorldScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('HubOpenWorldScene');
  }

  create(): void {
    gameState.setAct('hub');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#f3ebe4');

    this.add.text(18, 14, 'HUB - Domaine (monde ouvert)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.info = this.add.text(
      width / 2,
      height / 2,
      'Le monde ouvert commence.\nOuvrez la carte (bouton UI) pour voyager.',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#2c2433',
        align: 'center',
      }
    ).setOrigin(0.5);

    this.inputState = new SceneInput(this);
  }

  override update(): void {
    // Raccourci clavier: "M" ouvre la carte via event (optionnel)
    const kb = this.input.keyboard;
    const m = kb?.addKey?.(Phaser.Input.Keyboard.KeyCodes.M) as Phaser.Input.Keyboard.Key | undefined;
    if (m && Phaser.Input.Keyboard.JustDown(m)) {
      try {
        window.dispatchEvent(new CustomEvent('fp-game-show-map'));
      } catch {}
    }
    this.inputState.commit();
  }
}

