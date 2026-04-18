import Phaser from 'phaser';
import {
  ACT2_CHEF_TEXTURE_KEY,
  ACT2_CUISINIER_TEXTURE_KEY,
  registerAct2KitchenNpcAnims,
} from '../data/act2-kitchen-npcs';
import {
  LPC_DE_LA_PLUME_TEXTURE_KEY,
  LPC_PLAYER_SHEET_LOADS,
  registerLpcPlayerIdleAnimsAll,
  registerLpcPlayerWalkAnimsAll,
  registerLpcUniversalSheetWalkAndIdle,
} from '../data/lpc-garcon';

/** Chemins relatifs au dossier `src/assets` servi par Angular sous `/assets/`. */
const G = 'assets/game';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.load.image('tile-courtyard', `${G}/tilesets/tile-courtyard.png`);
    this.load.image('tile-border', `${G}/tilesets/tile-border.png`);
    for (const { key, path } of LPC_PLAYER_SHEET_LOADS) {
      this.load.spritesheet(key, `${G}/${path}`, {
        frameWidth: 64,
        frameHeight: 64,
      });
    }
    this.load.spritesheet(LPC_DE_LA_PLUME_TEXTURE_KEY, `${G}/sprites/de-la-plume.png`, {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.image('player-top', `${G}/sprites/player-top.png`);
    this.load.image('npc-majordome-top', `${G}/sprites/npc-majordome-top.png`);
    this.load.spritesheet(ACT2_CHEF_TEXTURE_KEY, `${G}/sprites/cuisinier_chef.png`, {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet(ACT2_CUISINIER_TEXTURE_KEY, `${G}/sprites/cuisinier.png`, {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.image('portrait-generic', `${G}/portraits/portrait-generic.png`);
    this.load.image('portrait-majordome', `${G}/portraits/portrait-majordome.png`);
    this.load.image('portrait-cocher', `${G}/portraits/portrait-cocher.png`);
    this.load.image('archetype-lady', `${G}/sprites/archetype-lady.png`);
    this.load.image('archetype-gentleman', `${G}/sprites/archetype-gentleman.png`);
    this.load.image('archetype-reine', `${G}/sprites/archetype-reine.png`);
    this.load.image('archetype-duc', `${G}/sprites/archetype-duc.png`);
    this.load.image('act0-carrosse', `${G}/backgrounds/acte0-carrosse.png`);
    this.load.image('act0-parallax-lointain', `${G}/backgrounds/acte0-parallax-lointain.png`);
    this.load.image('act0-parallax-proche', `${G}/backgrounds/acte0-parallax-proche.png`);
    this.load.image('act1-courtyard', `${G}/backgrounds/acte1-courtyard.png`);
    this.load.image('act1-carosse', `${G}/sprites/carosse.png`);
  }

  create(): void {
    registerLpcPlayerWalkAnimsAll(this);
    registerLpcPlayerIdleAnimsAll(this);
    registerLpcUniversalSheetWalkAndIdle(this, LPC_DE_LA_PLUME_TEXTURE_KEY);
    registerAct2KitchenNpcAnims(this);
    this.scene.start('BootScene');
  }
}
