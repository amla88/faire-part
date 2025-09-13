import Phaser from "phaser";
import InputService from "../services/InputService";
import UIService from "../services/UIService";
import ChecklistService from "../services/ChecklistService";

interface NPC extends Phaser.Physics.Arcade.Sprite {
  name: string;
  action: () => void;
  objectiveId?: number;
}

interface MainSceneData {
  user?: any | null;
}

class MainScene extends Phaser.Scene {
  user: any | null = null;
  checklistService!: ChecklistService;
  inputService!: InputService;
  uiService!: UIService;
  player!: Phaser.Physics.Arcade.Sprite;
  npcs: NPC[] = [];
  // Direction courante pour les animations
  private facing: "front" | "back" | "left" | "right" = "front";
  private worldLayer?: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super("MainScene");
  }

  preload() {
    // Loader visuel
    const { width, height } = this.scale;
    const barW = Math.max(200, Math.floor(width * 0.5));
    const barH = 16;
    const x = (width - barW) / 2;
    const y = (height - barH) / 2;
    const border = this.add.graphics();
    const fill = this.add.graphics();
    const label = this.add.text(width / 2, y - 24, 'Chargement…', {
      font: '14px monospace',
      color: '#ffffff',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);

    border.lineStyle(2, 0xffffff, 0.9).strokeRect(x, y, barW, barH).setScrollFactor(0).setDepth(1000);
    fill.fillStyle(0x5ac18e, 1).fillRect(x + 2, y + 2, 0, barH - 4).setScrollFactor(0).setDepth(1000);

    this.load.on('progress', (value: number) => {
      fill.clear();
      fill.fillStyle(0x5ac18e, 1).fillRect(x + 2, y + 2, Math.floor((barW - 4) * value), barH - 4);
    });

    this.load.on('complete', () => {
      border.destroy();
      fill.destroy();
      label.destroy();
    });

  const base = (import.meta as any).env.BASE_URL || '/';
  // UI atlas
  this.load.atlas('ui-interface', `${base}assets/ui/interface.png`, `${base}assets/ui/interface.json`);

  // Tiled map + tileset
  this.load.image('tiles', `${base}assets/tiles.png`);
  this.load.tilemapTiledJSON('map', `${base}assets/map.json`);

  // NPC simple sprite
  this.load.spritesheet('npcSprite', `${base}assets/npc.png`, { frameWidth: 32, frameHeight: 32 });

  // Aseprite atlases pour le joueur "thib"
  const pBase = `${base}assets/ui/character/player/thib/`;
  this.load.atlas('thib_idle_front', `${pBase}Idle_front.png`, `${pBase}Idle_front.json`);
  this.load.atlas('thib_idle_back', `${pBase}Idle_back.png`, `${pBase}Idle_back.json`);
  this.load.atlas('thib_idle_left', `${pBase}Idle_side_left.png`, `${pBase}Idle_side_left.json`);
  this.load.atlas('thib_idle_right', `${pBase}Idle_side_right.png`, `${pBase}Idle_side_right.json`);
  this.load.atlas('thib_walk_front', `${pBase}Walk_front.png`, `${pBase}Walk_front.json`);
  this.load.atlas('thib_walk_back', `${pBase}Walk_back.png`, `${pBase}Walk_back.json`);
  this.load.atlas('thib_walk_left', `${pBase}Walk_side_left.png`, `${pBase}Walk_side_left.json`);
  this.load.atlas('thib_walk_right', `${pBase}Walk_side_right.png`, `${pBase}Walk_side_right.json`);
  }

  init(data: MainSceneData) {
    this.user = data.user || null;
  }

  create() {
    // Crée la carte Tiled et les couches
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tiles', 'tiles');
    const belowLayer = map.createLayer('Below Player', tileset!, 0, 0);
    this.worldLayer = map.createLayer('World', tileset!, 0, 0) ?? undefined;
    const aboveLayer = map.createLayer('Above Player', tileset!, 0, 0);
    if (aboveLayer) aboveLayer.setDepth(10);

    // Limites du monde et caméra
    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // Services
    this.checklistService = new ChecklistService(this, this.user);
    this.inputService = new InputService(this);
    this.inputService.createTouchButtons();
    this.uiService = new UIService(this, this.user, this.checklistService, this.inputService);

    // Joueur (texture idle face caméra par défaut)
  this.player = this.physics.add.sprite(64, 64, 'thib_idle_front', 'Idle_front_0');
  // 2x plus grand
  this.player.setScale(1);
    this.player.setCollideWorldBounds(true);
    // Corps plus petit pour des collisions plus fines
    const body = this.player.body as Phaser.Physics.Arcade.Body;
  body.setSize(28, 36, true);
  body.setOffset((this.player.displayWidth - 28) / 2, this.player.displayHeight - 36);

    // Collisions avec le monde
    if (this.worldLayer) {
      this.worldLayer.setCollisionByExclusion([-1, 0], true);
      this.physics.add.collider(this.player, this.worldLayer);
    }

    // Caméra suit le joueur
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  // Avec ENVELOP, Phaser gère le redimensionnement pour remplir l'écran

    // Animations
    this.buildPlayerAnimations();

    // Exemple d'un NPC de test
    this.createNPC(200, 200, "NPC 1", () => console.log("Dialogue avec NPC 1"), 1);
  }

  createNPC(x: number, y: number, name: string, action: () => void, objectiveId?: number) {
    const npc = this.physics.add.sprite(x, y, "npcSprite", 0) as NPC;
    npc.name = name;
    npc.action = action;
    npc.objectiveId = objectiveId;

    this.npcs.push(npc);

    this.physics.add.overlap(this.player, npc, () => {
      this.uiService.showActionButton(true, npc);
    });
  }

  update() {
    const baseSpeed = 100; // pixels/sec, réduit pour un déplacement plus lent
    const movement = this.inputService.getMovement();

    let vx = 0;
    let vy = 0;
    const movingVertical = movement.up || movement.down;
    const movingHorizontal = movement.left || movement.right;

    if (movement.up) {
      vy = -1;
      this.facing = "back";
    } else if (movement.down) {
      vy = 1;
      this.facing = "front";
    }
    if (movement.left) {
      vx = -1;
      this.facing = "left";
    } else if (movement.right) {
      vx = 1;
      this.facing = "right";
    }

    // Normalise la vitesse en diagonale pour éviter d'aller plus vite
    const diagonal = vx !== 0 && vy !== 0;
    const speed = diagonal ? baseSpeed / Math.SQRT2 : baseSpeed;
    this.player.setVelocity(vx * speed, vy * speed);

    // Animation en fonction du mouvement
    const anyMoving = movingVertical || movingHorizontal;
    const animKey = `${anyMoving ? 'walk' : 'idle'}-${this.facing}`;
    if (this.anims.exists(animKey)) {
      this.player.anims.play(animKey, true);
    }
  }

  private buildPlayerAnimations() {
    // Helper pour créer une anim à partir d'une texture et d'un préfixe
    const create = (
      textureKey: string,
      framePrefix: string,
      animKey: string,
      frameRate: number
    ) => {
      const names = this.textures.get(textureKey).getFrameNames();
      // Filtrer uniquement les frames qui matchent le préfixe, trier par index numérique
      const frames = names
        .filter((n) => n.startsWith(framePrefix))
        .sort((a, b) => {
          const na = parseInt(a.substring(framePrefix.length), 10);
          const nb = parseInt(b.substring(framePrefix.length), 10);
          return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
        })
        .map((frame) => ({ key: textureKey, frame }));

      if (frames.length > 0 && !this.anims.exists(animKey)) {
        this.anims.create({ key: animKey, frames, frameRate, repeat: -1 });
      }
    };

    // Idle
    create('thib_idle_front', 'Idle_front_', 'idle-front', 6);
    create('thib_idle_back', 'Idle_back_', 'idle-back', 6);
    create('thib_idle_left', 'Idle_side_left_', 'idle-left', 6);
    create('thib_idle_right', 'Idle_side_right_', 'idle-right', 6);
    // Walk
    create('thib_walk_front', 'Walk_front_', 'walk-front', 10);
    create('thib_walk_back', 'Walk_back_', 'walk-back', 10);
    create('thib_walk_left', 'Walk_side_left_', 'walk-left', 10);
    create('thib_walk_right', 'Walk_side_right_', 'walk-right', 10);
  }
}

export default MainScene;
