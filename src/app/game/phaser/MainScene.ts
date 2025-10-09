import Phaser from 'phaser';
import InputService from './InputService';
import UIService from './UIService';
import ChecklistService from './ChecklistService';

interface MainSceneData { user?: any | null }

export default class MainScene extends Phaser.Scene {
  user: any | null = null;
  checklistService!: ChecklistService;
  inputService!: InputService;
  uiService!: UIService;
  player!: Phaser.Physics.Arcade.Sprite;
  private worldLayer?: Phaser.Tilemaps.TilemapLayer;
  private facing: 'front' | 'back' | 'left' | 'right' = 'front';

  constructor() { super('MainScene'); }

  preload() {
    // Loader simple
    const { width, height } = this.scale;
    const label = this.add.text(width/2, height/2, 'Chargement…', { font: '14px monospace', color: '#ffffff' }).setOrigin(0.5);

    this.load.on('complete', () => { label.destroy(); });

    // Les assets sont servis par Angular sous /<base>/assets
    this.load.atlas('ui-interface', 'assets/ui/interface.png', 'assets/ui/interface.json');
    this.load.image('tiles', 'assets/tiles.png');
    this.load.tilemapTiledJSON('map', 'assets/map.json');
    this.load.spritesheet('npcSprite', 'assets/npc.png', { frameWidth: 32, frameHeight: 32 });

    const pBase = 'assets/ui/character/player/thib/';
    this.load.atlas('thib_idle_front', `${pBase}Idle_front.png`, `${pBase}Idle_front.json`);
    this.load.atlas('thib_idle_back', `${pBase}Idle_back.png`, `${pBase}Idle_back.json`);
    this.load.atlas('thib_idle_left', `${pBase}Idle_side_left.png`, `${pBase}Idle_side_left.json`);
    this.load.atlas('thib_idle_right', `${pBase}Idle_side_right.png`, `${pBase}Idle_side_right.json`);
    this.load.atlas('thib_walk_front', `${pBase}Walk_front.png`, `${pBase}Walk_front.json`);
    this.load.atlas('thib_walk_back', `${pBase}Walk_back.png`, `${pBase}Walk_back.json`);
    this.load.atlas('thib_walk_left', `${pBase}Walk_side_left.png`, `${pBase}Walk_side_left.json`);
    this.load.atlas('thib_walk_right', `${pBase}Walk_side_right.png`, `${pBase}Walk_side_right.json`);
  }

  init(data: MainSceneData) { this.user = data.user || null; }

  create() {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tiles', 'tiles');
    map.createLayer('Below Player', tileset!, 0, 0);
    this.worldLayer = map.createLayer('World', tileset!, 0, 0) ?? undefined;
    const aboveLayer = map.createLayer('Above Player', tileset!, 0, 0);
    if (aboveLayer) aboveLayer.setDepth(10);

    const worldW = map.widthInPixels; const worldH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this.checklistService = new ChecklistService(this, this.user);
    this.inputService = new InputService(this);
    this.inputService.createTouchButtons();
    this.uiService = new UIService(this, this.user, this.checklistService, this.inputService);

    this.player = this.physics.add.sprite(64, 64, 'thib_idle_front', 'Idle_front_0');
    this.player.setScale(1);
    this.player.setCollideWorldBounds(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 36, true);
    body.setOffset((this.player.displayWidth - 28) / 2, this.player.displayHeight - 36);

    if (this.worldLayer) {
      this.worldLayer.setCollisionByExclusion([-1, 0], true);
      this.physics.add.collider(this.player, this.worldLayer);
    }

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.buildPlayerAnimations();
  }

  override update() {
    const baseSpeed = 100;
    const movement = this.inputService.getMovement();
    let vx = 0, vy = 0;
    if (movement.up) { vy = -1; this.facing = 'back'; }
    else if (movement.down) { vy = 1; this.facing = 'front'; }
    if (movement.left) { vx = -1; this.facing = 'left'; }
    else if (movement.right) { vx = 1; this.facing = 'right'; }
    const diagonal = vx !== 0 && vy !== 0;
    const speed = diagonal ? baseSpeed / Math.SQRT2 : baseSpeed;
    this.player.setVelocity(vx * speed, vy * speed);

    const anyMoving = movement.up || movement.down || movement.left || movement.right;
    const animKey = `${anyMoving ? 'walk' : 'idle'}-${this.facing}`;
    if (this.anims.exists(animKey)) {
      this.player.anims.play(animKey, true);
    }
  }

  private buildPlayerAnimations() {
    const create = (textureKey: string, framePrefix: string, animKey: string, frameRate: number) => {
      const names = this.textures.get(textureKey).getFrameNames();
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

    create('thib_idle_front', 'Idle_front_', 'idle-front', 6);
    create('thib_idle_back', 'Idle_back_', 'idle-back', 6);
    create('thib_idle_left', 'Idle_side_left_', 'idle-left', 6);
    create('thib_idle_right', 'Idle_side_right_', 'idle-right', 6);

    create('thib_walk_front', 'Walk_front_', 'walk-front', 10);
    create('thib_walk_back', 'Walk_back_', 'walk-back', 10);
    create('thib_walk_left', 'Walk_side_left_', 'walk-left', 10);
    create('thib_walk_right', 'Walk_side_right_', 'walk-right', 10);
  }
}
