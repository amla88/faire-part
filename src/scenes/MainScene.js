import supabaseService from "../services/supabaseService.js";
import env from "../environment";
import NPCForm from '../ui/NPCFormMusic';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.auth = null;
    this.user = null;
    this.dialogActive = false;
  }

  preload() {
    this.load.image('tiles', env.basePath + 'assets/tiles.png');
    this.load.tilemapTiledJSON('map', env.basePath + 'assets/map.json');
    this.load.spritesheet('player', env.basePath + 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('npc', env.basePath + 'assets/npc.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('ui-up', env.basePath + 'assets/ui/up.png');
    this.load.image('ui-down', env.basePath + 'assets/ui/down.png');
    this.load.image('ui-left', env.basePath + 'assets/ui/left.png');
    this.load.image('ui-right', env.basePath + 'assets/ui/right.png');
    this.load.image('ui-up-pressed', env.basePath + 'assets/ui/up_pressed.png');
    this.load.image('ui-down-pressed', env.basePath + 'assets/ui/down_pressed.png');
    this.load.image('ui-left-pressed', env.basePath + 'assets/ui/left_pressed.png');
    this.load.image('ui-right-pressed', env.basePath + 'assets/ui/right_pressed.png');
    this.load.image('ui-toggle', env.basePath + 'assets/ui/toggle.png');
  }

  create() {
    const user = supabaseService.getlUser();
    this.npcForm = new NPCForm(this, user, () => {
      this.dialogActive = false; // ✅ Réactive le mouvement quand le form se ferme
    });

    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tiles', 'tiles');
    const belowLayer = map.createLayer('Below Player', tileset);
    const worldLayer = map.createLayer('World', tileset);
    const aboveLayer = map.createLayer('Above Player', tileset);
    aboveLayer.setDepth(10);

    worldLayer.setCollisionByProperty({ collides: true });

    this.player = this.physics.add.sprite(100, 100, 'player', 0);
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, worldLayer);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(this.game.config.width / 3, this.game.config.height / 3);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.moveDirection = { up: false, down: false, left: false, right: false };

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.uiVisible = true;
    this.touchButtons = {};
    const btnSize = 48;
    const margin = 10;
    const centerX = margin + btnSize;
    const centerY = this.scale.height - margin - btnSize;

    const createButton = (key, keyPressed, x, y, dir) => {
      const normal = this.add.image(x, y, key).setInteractive().setScrollFactor(0).setDepth(100);
      const pressed = this.add.image(x, y, keyPressed).setInteractive().setScrollFactor(0).setDepth(101).setAlpha(0);

      const showPressed = () => {
        this.moveDirection[dir] = true;
        this.tweens.add({ targets: pressed, alpha: 1, duration: 100 });
        this.tweens.add({ targets: normal, alpha: 0, duration: 100 });
      };

      const hidePressed = () => {
        this.moveDirection[dir] = false;
        this.tweens.add({ targets: pressed, alpha: 0, duration: 100 });
        this.tweens.add({ targets: normal, alpha: 1, duration: 100 });
      };

      normal.on('pointerdown', showPressed);
      normal.on('pointerup', hidePressed);
      normal.on('pointerout', hidePressed);
      pressed.on('pointerup', hidePressed);
      pressed.on('pointerout', hidePressed);

      this.touchButtons[dir] = { normal, pressed };
    };

    createButton('ui-up', 'ui-up-pressed', centerX, centerY - btnSize, 'up');
    createButton('ui-down', 'ui-down-pressed', centerX, centerY + btnSize, 'down');
    createButton('ui-left', 'ui-left-pressed', centerX - btnSize, centerY, 'left');
    createButton('ui-right', 'ui-right-pressed', centerX + btnSize, centerY, 'right');

    const actionBtnX = this.scale.width - margin - btnSize;
    const actionBtnY = centerY;

    this.actionButton = this.add.image(actionBtnX, actionBtnY, 'ui-toggle') // tu peux changer l'image par une autre icône d'action
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(150)
    .setAlpha(0.4)    // semi transparent quand inactif
    .on('pointerdown', () => {
      if (this.actionButton.active) { // uniquement si actif
        if (!this.dialogActive) {
          this.dialogActive = true;
          this.checklist.setText('Checklist:\n- [x] Talk to NPC\n- [ ] Find the key');
          this.npcForm.show();
        }
      }
    });

    this.toggleBtn = this.add.image(this.scale.width - margin - 24, margin + 24, 'ui-toggle')
      .setInteractive()
      .setScrollFactor(0)
      .setDepth(150)
      .on('pointerdown', () => {
        this.uiVisible = !this.uiVisible;
        for (const dir in this.touchButtons) {
          const btn = this.touchButtons[dir];
          btn.normal.setVisible(this.uiVisible);
          btn.normal.setAlpha(1);
          btn.pressed.setAlpha(0);
        }
      });

    this.checklist = this.add.text(10, 10, 'Checklist:\n- [ ] Talk to NPC\n- [ ] Find the key', {
      font: '16px monospace',
      fill: '#ffffff',
      padding: { x: 10, y: 10 },
      backgroundColor: '#000000'
    }).setScrollFactor(0).setDepth(20);

    this.add.sprite(200, 200, 'npc', 0);

    this.interactiveNPC = this.physics.add.sprite(300, 300, 'npc', 1);
    this.physics.add.overlap(this.player, this.interactiveNPC, () => {
      this.actionButton.setAlpha(1);
      this.actionButton.active = true;
    }, null, this);

    this.exitZone = this.add.zone(600, 100, 32, 32);
    this.physics.world.enable(this.exitZone);
    this.exitZone.body.setAllowGravity(false);
    this.exitZone.body.setImmovable(true);
    this.physics.add.overlap(this.player, this.exitZone, () => {
      console.log('TODO: Load second zone');
    });
  }

  update() {
    if (this.dialogActive) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      return; // stop toute mise à jour liée au gameplay
    }
    const speed = 150;
    const move = this.moveDirection;

    const left = this.cursors.left.isDown || move.left;
    const right = this.cursors.right.isDown || move.right;
    const up = this.cursors.up.isDown || move.up;
    const down = this.cursors.down.isDown || move.down;

    this.player.body.setVelocity(0);

    if (left) {
      this.player.body.setVelocityX(-speed);
    } else if (right) {
      this.player.body.setVelocityX(speed);
    }

    if (up) {
      this.player.body.setVelocityY(-speed);
    } else if (down) {
      this.player.body.setVelocityY(speed);
    }

    this.player.body.velocity.normalize().scale(speed);

    // Vérifier distance au NPC pour désactiver le bouton si trop loin
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.interactiveNPC.x, this.interactiveNPC.y
    );
    if (dist > 50) {  // par ex. 50 pixels de rayon pour activer
      this.actionButton.setAlpha(0.4);
      this.actionButton.active = false;
    }
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      if (this.actionButton.active && !this.dialogActive) {
        this.dialogActive = true;
        this.checklist.setText('Checklist:\n- [x] Talk to NPC\n- [ ] Find the key');
        this.npcForm.show();
      }
    }
  }

  

  async saveGame() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("Utilisateur connecté:", user);
    const response = await supabase
      .from("users")
      .update({ connect: true, connexion: new Date() })
      .eq("id", this.user.id);

    if (response.error) {
      console.error("Erreur sauvegarde:", response.error);
    } else {
      console.log("✅ Sauvegarde réussie !", response.data);
    }
  }

  async loadSave() {
    const { username } = this.saveData;

    const { data, error } = await supabase
      .from("saves")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Erreur chargement :", error);
    } else if (data) {
      this.saveData = { ...this.saveData, ...data };
      console.log("✅ Sauvegarde chargée :", this.saveData);
      this.add.text(
        50,
        200,
        `Joueur: ${data.username}, Niveau: ${data.level}`,
        {
          font: "18px Arial",
          fill: "#fff",
        }
      );
    } else {
      console.log("📭 Aucune sauvegarde trouvée.");
    }
  }
}
