import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { Act0CarrosseScene } from '../scenes/Act0CarrosseScene';
import { Act1CourScene } from '../scenes/Act1CourScene';
import { Act2OfficeScene } from '../scenes/Act2OfficeScene';
import { Act3GrangeScene } from '../scenes/Act3GrangeScene';
import { HubOpenWorldScene } from '../scenes/HubOpenWorldScene';
import { Act4VergerScene } from '../scenes/Act4VergerScene';
import { Act5GlorietteScene } from '../scenes/Act5GlorietteScene';
import { Act6EcurieScene } from '../scenes/Act6EcurieScene';
import { Act7FinalGazetteScene } from '../scenes/Act7FinalGazetteScene';

export function createGame(container: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: '#faf6f1',
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
    scene: [
      BootScene,
      Act0CarrosseScene,
      Act1CourScene,
      Act2OfficeScene,
      Act3GrangeScene,
      HubOpenWorldScene,
      Act4VergerScene,
      Act5GlorietteScene,
      Act6EcurieScene,
      Act7FinalGazetteScene,
    ],
    input: {
      // Écouter sur window évite les soucis de focus après des inputs DOM (Chrome/mobile).
      // (Phaser accepte keyboard:true ou un objet config; on garde une forme compatible TS.)
      keyboard: { target: window } as unknown as boolean,
      mouse: true,
      touch: true,
      gamepad: false,
    },
    callbacks: {
      postBoot: (game) => {
        try {
          // Permet de refocus le canvas après un formulaire DOM (allergènes).
          game.canvas.setAttribute('tabindex', '0');
          game.canvas.style.outline = 'none';
          // Focus au clic/tap pour les navigateurs stricts
          game.canvas.addEventListener('pointerdown', () => {
            try {
              game.canvas.focus();
            } catch {}
          });
          game.canvas.focus();
        } catch {
          // ignore
        }
      },
    },
  };

  return new Phaser.Game(config);
}

