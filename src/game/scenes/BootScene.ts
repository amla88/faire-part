import Phaser from 'phaser';
import { gameState } from '../core/game-state';
import { QuestFlags } from '../systems/QuestSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Charge la sauvegarde si disponible.
    gameState.load();

    // Verrouillage: on repart toujours de l'acte "autorisé" selon flags.
    const s = gameState.snapshot;
    const has = (k: string) => s.flags?.[k] === true;

    if (has(QuestFlags.hubMapUnlocked)) {
      gameState.setAct('hub');
      this.scene.start('HubOpenWorldScene');
      return;
    }
    if (has(QuestFlags.act3AvatarDone)) {
      gameState.setAct('act3');
      this.scene.start('Act3GrangeScene');
      return;
    }
    if (has(QuestFlags.act2AllergensDone)) {
      gameState.setAct('act3');
      this.scene.start('Act3GrangeScene');
      return;
    }
    if (has(QuestFlags.act1RegisterDone)) {
      gameState.setAct('act2');
      this.scene.start('Act2OfficeScene');
      return;
    }
    if (has(QuestFlags.act0IntroSeen)) {
      gameState.setAct('act1');
      this.scene.start('Act1CourScene');
      return;
    }

    gameState.setAct('act0');
    this.scene.start('Act0CarrosseScene');
  }
}

