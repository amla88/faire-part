import Phaser from 'phaser';
import { Act0CarrosseScene } from '../scenes/Act0CarrosseScene';
import { Act1CourScene } from '../scenes/Act1CourScene';
import { Act2OfficeScene } from '../scenes/Act2OfficeScene';
import { Act3GrangeScene } from '../scenes/Act3GrangeScene';

export function createGame(container: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: '#201a26',
    pixelArt: true,
    dom: {
      createContainer: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    scene: [Act0CarrosseScene, Act1CourScene, Act2OfficeScene, Act3GrangeScene],
    input: {
      keyboard: true,
      mouse: true,
      touch: true,
      gamepad: false,
    },
  };

  return new Phaser.Game(config);
}

