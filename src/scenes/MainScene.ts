import Phaser from "phaser";
import InputService from "../services/InputService";
import UIService from "../services/UIService";
import ChecklistService from "../services/ChecklistService";
import { User } from "../services/supabaseService"; // si tu as déjà un type User

interface NPC extends Phaser.Physics.Arcade.Sprite {
  name: string;
  action: () => void;
  objectiveId?: number;
}

interface MainSceneData {
  user?: User | null;
}

class MainScene extends Phaser.Scene {
  user: User | null = null;
  checklistService!: ChecklistService;
  inputService!: InputService;
  uiService!: UIService;
  player!: Phaser.Physics.Arcade.Sprite;
  npcs: NPC[] = [];

  constructor() {
    super("MainScene");
  }

  preload() {
    this.load.atlas('ui-interface', 'assets/ui/interface.png', 'assets/ui/interface.json');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 60, frameHeight: 60 });
    this.load.spritesheet('npcSprite', 'assets/npc.png', { frameWidth: 32, frameHeight: 32 });
  }

  init(data: MainSceneData) {
    this.user = data.user || null;
  }

  create() {
    this.checklistService = new ChecklistService(this, this.user);
    this.inputService = new InputService(this);
    this.inputService.createTouchButtons();
    this.uiService = new UIService(this, this.user, this.checklistService, this.inputService);

    this.player = this.physics.add.sprite(400, 300, "player", 0);
    this.player.setCollideWorldBounds(true);

    this.createNPC(500, 300, "NPC 1", () => console.log("Dialogue avec NPC 1"), 1);
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
    const speed = 200;
    const movement = this.inputService.getMovement();

    this.player.setVelocity(0);
    if (movement.up) this.player.setVelocityY(-speed);
    if (movement.down) this.player.setVelocityY(speed);
    if (movement.left) this.player.setVelocityX(-speed);
    if (movement.right) this.player.setVelocityX(speed);
  }
}

export default MainScene;
