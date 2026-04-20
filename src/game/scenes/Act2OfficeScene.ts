import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';
import { getDialogue } from '../data/dialogues.catalog';
import {
  ACT2_CHEF_TEXTURE_KEY,
  ACT2_CUISINIER_TEXTURE_KEY,
  act2KitchenIdleFirstFrame,
  facingFromDelta,
  playAct2KitchenWalk,
  playAct2KitchenWaterUpOnce,
  setAct2KitchenIdleFrame,
} from '../data/act2-kitchen-npcs';
import {
  LPC_PLAYER_IDLE_FIRST_FRAMES,
  type LpcFacing,
  playLpcPlayerIdle,
  playLpcPlayerWalk,
  resolveLpcPlayerTextureKey,
} from '../data/lpc-garcon';

/** Zone de marche (fractions du canvas). */
const ACT2_WALK_ZONE = {
  minXFrac: 0.13,
  maxXFrac: 0.89,
  minYFrac: 0.21,
  bottomReservePx: 85,
} as const;

/** Obstacle (centrée en fractions du canvas, taille en px) : joueur, vagabond et PNJ fixes. */
const ACT2_DEBUG_GREEN_HITBOX = {
  centerXFrac: 0.22,
  centerYFrac: 0.27,
  widthPx: 230,
  heightPx: 80,
} as const;

/** Profondeur des textes HUD au-dessus du jeu. */
const ACT2_UI_DEPTH = 100_000;

/** Pieds du joueur (collision tables / PNJ). */
const ACT2_PLAYER_FEET_HITBOX = {
  widthFrac: 0.38,
  heightFrac: 0.12,
} as const;

/** Hitbox PNJ (bas du sprite, comme acte 1). */
const ACT2_NPC_BODY_HITBOX = {
  widthFrac: 0.42,
  heightFrac: 0.34,
} as const;

/**
 * Tables : position (fractions du canvas, origine bas-centre), taille affichée en **pixels**,
 * hitbox type « carrosse » (insets sur le AABB affiché, 0 = haut du bitmap, 1 = bas).
 */
type Act2TableDef = {
  textureKey: string;
  xFrac: number;
  yFrac: number;
  /** Largeur du sprite affiché (px). */
  widthPx: number;
  /** Hauteur du sprite affiché (px). */
  heightPx: number;
  hit: { insetXFrac: number; insetTopFrac: number; insetBottomFrac: number };
};

const ACT2_TABLE_DEFS: Act2TableDef[] = [
  {
    textureKey: 'act2-table-1',
    xFrac: 0.24,
    yFrac: 0.94,
    widthPx: 370,
    heightPx: 123,
    hit: { insetXFrac: 0.00, insetTopFrac: 0.60, insetBottomFrac: 0.00 },
  },
  {
    textureKey: 'act2-table-2',
    xFrac: 0.75,
    yFrac: 0.94,
    widthPx: 352,
    heightPx: 71,
    hit: { insetXFrac: 0.0, insetTopFrac: 0.40, insetBottomFrac: 0.00 },
  },
  {
    textureKey: 'act2-table-centre-1',
    xFrac: 0.70,
    yFrac: 0.52,
    widthPx: 317,
    heightPx: 129,
    hit: { insetXFrac: 0.00, insetTopFrac: 0.40, insetBottomFrac: 0.00 },
  },
  {
    textureKey: 'act2-table-centre-2',
    xFrac: 0.30,
    yFrac: 0.70,
    widthPx: 234,
    heightPx: 78,
    hit: { insetXFrac: 0.00, insetTopFrac: 0.30, insetBottomFrac: 0.00 },
  },
];

/** Fond / repère marche (fixes). Tables + personnages : tri dynamique sur le Y des « pieds » (comme acte 1 / carrosse). */
const ACT2_DEPTH_WALK_BLUE = -199;

function act2WalkBounds(width: number, height: number): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    width * ACT2_WALK_ZONE.minXFrac,
    height * ACT2_WALK_ZONE.minYFrac,
    width * (ACT2_WALK_ZONE.maxXFrac - ACT2_WALK_ZONE.minXFrac),
    height - ACT2_WALK_ZONE.bottomReservePx - height * ACT2_WALK_ZONE.minYFrac,
  );
}

export class Act2OfficeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private info!: Phaser.GameObjects.Text;
  private saving = false;
  private player!: Phaser.GameObjects.Sprite;
  private chef!: Phaser.GameObjects.Sprite;
  private cookA!: Phaser.GameObjects.Sprite;
  private cookB!: Phaser.GameObjects.Sprite;
  private wanderer!: Phaser.GameObjects.Sprite;
  private wandererTarget = { x: 0, y: 0 };
  private wandererFacing: LpcFacing = 'down';
  private wandererPauseUntil = 0;

  private chefLabel!: Phaser.GameObjects.Text;
  private chefSpoken = false;
  private playerFacing: LpcFacing = 'right';

  private chefWatering = false;
  private chefNextWaterAt = 0;
  /** Cuisinier de gauche (`cookA`) : arrosage ponctuel (même anim que le chef). */
  private cookAWatering = false;
  private cookANextWaterAt = 0;

  private readonly playerFeetBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly chefBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly cookABlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly cookBBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly wandererBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  /** Collision solide : alignée sur `ACT2_DEBUG_GREEN_HITBOX`. */
  private readonly debugGreenCollisionRect = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  private tableBlocks: Phaser.Geom.Rectangle[] = [];
  private tableImages: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Act2OfficeScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.add
      .image(width / 2, height / 2, 'act2-cuisine')
      .setDisplaySize(width, height)
      .setDepth(-200);

    const walk = act2WalkBounds(width, height);

    this.add.text(18, 14, 'ACTE 2 — L\'Office des saveurs', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f4dfbf',
    });

    this.spawnTables(width, height);

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    const TILE_SCALE = 2;
    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    const px = walk.x + walk.width * 0.49;
    const py = walk.y + walk.height * 0.94;
    this.player = this.add
      .sprite(px, py, playerTex, LPC_PLAYER_IDLE_FIRST_FRAMES[this.playerFacing])
      .setScale(TILE_SCALE);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    const chefX = walk.x + walk.width * 0.88;
    const chefY = walk.y + walk.height * 0.38;
    this.chef = this.add
      .sprite(chefX, chefY, ACT2_CHEF_TEXTURE_KEY, act2KitchenIdleFirstFrame('up'))
      .setScale(TILE_SCALE);
    setAct2KitchenIdleFrame(this.chef, 'up');

    this.cookA = this.add
      .sprite(walk.x + walk.width * 0.18, walk.y + walk.height * 0.42, ACT2_CUISINIER_TEXTURE_KEY, act2KitchenIdleFirstFrame('down'))
      .setScale(TILE_SCALE);
    this.cookB = this.add
      .sprite(walk.x + walk.width * 0.48, walk.y + walk.height * 0.32, ACT2_CUISINIER_TEXTURE_KEY, act2KitchenIdleFirstFrame('left'))
      .setScale(TILE_SCALE);

    const wx = walk.x + walk.width * 0.42;
    const wy = walk.y + walk.height * 0.55;
    this.wanderer = this.add
      .sprite(wx, wy, ACT2_CUISINIER_TEXTURE_KEY, act2KitchenIdleFirstFrame('down'))
      .setScale(TILE_SCALE);

    this.chefLabel = this.add.text(chefX, chefY + 44, "Chef", {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#2c2433',
    }).setOrigin(0.5, 0);

    this.chefNextWaterAt = this.time.now + Phaser.Math.Between(2000, 4500);
    this.cookANextWaterAt = this.time.now + Phaser.Math.Between(3500, 8000);

    this.info = this.add.text(width / 2, height - 450, 'Parlez au chef', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#f4dfbf',
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(ACT2_UI_DEPTH);

    this.syncDebugGreenHitboxGeometry();
    this.pickWandererTarget();
    this.wandererPauseUntil = this.time.now + 400;

    this.refreshDepths();
  }

  private spawnTables(width: number, height: number): void {
    this.tableBlocks = [];
    this.tableImages = [];
    for (const def of ACT2_TABLE_DEFS) {
      const img = this.add
        .image(width * def.xFrac, height * def.yFrac, def.textureKey)
        .setOrigin(0.5, 1);
      const dw = Math.max(1, def.widthPx);
      const dh = Math.max(1, def.heightPx);
      img.setDisplaySize(dw, dh);
      this.tableImages.push(img);

      const topY = img.y - dh;
      const ix = dw * def.hit.insetXFrac;
      const iyTop = dh * def.hit.insetTopFrac;
      const iyBot = dh * def.hit.insetBottomFrac;
      const blockH = Math.max(1, dh - iyTop - iyBot);
      const block = new Phaser.Geom.Rectangle(img.x - dw / 2 + ix, topY + iyTop, dw - 2 * ix, blockH);
      this.tableBlocks.push(block);
    }
  }

  private refreshPlayerFeetBlock(): void {
    const p = this.player;
    const full = p.getBounds();
    const fw = Math.max(10, p.displayWidth * ACT2_PLAYER_FEET_HITBOX.widthFrac);
    const fh = Math.max(6, p.displayHeight * ACT2_PLAYER_FEET_HITBOX.heightFrac);
    const bottom = full.bottom;
    this.playerFeetBlock.setTo(p.x - fw / 2, bottom - fh, fw, fh);
  }

  private refreshNpcBlock(sprite: Phaser.GameObjects.Sprite, out: Phaser.Geom.Rectangle): void {
    const b = sprite.getBounds();
    const w = Math.max(24, b.width * ACT2_NPC_BODY_HITBOX.widthFrac);
    const h = Math.max(28, b.height * ACT2_NPC_BODY_HITBOX.heightFrac);
    out.setTo(sprite.x - w / 2, b.bottom - h, w, h);
  }

  private refreshAllNpcBlocks(): void {
    this.refreshNpcBlock(this.chef, this.chefBlock);
    this.refreshNpcBlock(this.cookA, this.cookABlock);
    this.refreshNpcBlock(this.cookB, this.cookBBlock);
    this.refreshNpcBlock(this.wanderer, this.wandererBlock);
  }

  private obstacleRectsForPlayer(): Phaser.Geom.Rectangle[] {
    return [
      this.chefBlock,
      this.cookABlock,
      this.cookBBlock,
      this.wandererBlock,
      this.debugGreenCollisionRect,
      ...this.tableBlocks,
    ];
  }

  /**
   * Repousse les pieds du joueur hors des rectangles (PNJ + tables), puis re-clamp la zone de marche.
   */
  private resolvePlayerFeetVsObstacles(): void {
    const { width, height } = this.scale;
    const walk = act2WalkBounds(width, height);
    const obstacles = this.obstacleRectsForPlayer();

    for (let pass = 0; pass < 4; pass++) {
      for (const block of obstacles) {
        for (let iter = 0; iter < 10; iter++) {
          this.refreshPlayerFeetBlock();
          const pb = this.playerFeetBlock;
          if (!Phaser.Geom.Intersects.RectangleToRectangle(pb, block)) break;

          const overlapX = Math.min(pb.right, block.right) - Math.max(pb.left, block.left);
          const overlapY = Math.min(pb.bottom, block.bottom) - Math.max(pb.top, block.top);
          if (overlapX <= 0 || overlapY <= 0) break;

          if (overlapX < overlapY) {
            this.player.x += pb.centerX < block.centerX ? -overlapX : overlapX;
          } else {
            this.player.y += pb.centerY < block.centerY ? -overlapY : overlapY;
          }
        }
      }
      this.player.x = Phaser.Math.Clamp(this.player.x, walk.x, walk.right);
      this.player.y = Phaser.Math.Clamp(this.player.y, walk.y, walk.bottom);
    }
  }

  /**
   * Même logique que le joueur : hitbox « pieds » PNJ vs tables + autres PNJ, puis clamp dans la zone de marche.
   */
  private resolveWandererFeetVsObstacles(): void {
    const { width, height } = this.scale;
    const walk = act2WalkBounds(width, height);
    const others: Phaser.Geom.Rectangle[] = [
      this.chefBlock,
      this.cookABlock,
      this.cookBBlock,
      this.debugGreenCollisionRect,
      ...this.tableBlocks,
    ];
    this.refreshPlayerFeetBlock();
    others.push(this.playerFeetBlock);

    for (let pass = 0; pass < 4; pass++) {
      for (const block of others) {
        for (let iter = 0; iter < 10; iter++) {
          this.refreshNpcBlock(this.wanderer, this.wandererBlock);
          const wb = this.wandererBlock;
          if (!Phaser.Geom.Intersects.RectangleToRectangle(wb, block)) break;

          const overlapX = Math.min(wb.right, block.right) - Math.max(wb.left, block.left);
          const overlapY = Math.min(wb.bottom, block.bottom) - Math.max(wb.top, block.top);
          if (overlapX <= 0 || overlapY <= 0) break;

          if (overlapX < overlapY) {
            this.wanderer.x += wb.centerX < block.centerX ? -overlapX : overlapX;
          } else {
            this.wanderer.y += wb.centerY < block.centerY ? -overlapY : overlapY;
          }
        }
      }
      this.wanderer.x = Phaser.Math.Clamp(this.wanderer.x, walk.x, walk.right);
      this.wanderer.y = Phaser.Math.Clamp(this.wanderer.y, walk.y, walk.bottom);
    }
  }

  override update(_: number, delta: number): void {
    this.syncDebugGreenHitboxGeometry();
    const dt = delta / 1000;

    if (this.formBox.active) {
      this.interruptWateringForEngagement();
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateChefFacingEngaged();
      this.updateStaticCooks();
      this.refreshAllNpcBlocks();
      this.resolveStaticNpcsVsGreenObstacle();
      this.refreshDepths();
      this.inputState.commit();
      return;
    }

    const act = this.inputState.actionJustDown();
    if (this.dialogueBox.active) {
      this.interruptWateringForEngagement();
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateChefFacingEngaged();
      this.updateStaticCooks();
      this.refreshAllNpcBlocks();
      this.resolveStaticNpcsVsGreenObstacle();
      this.updateWanderer(dt);
      this.refreshAllNpcBlocks();
      this.refreshDepths();
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    const { width, height } = this.scale;
    const walk = act2WalkBounds(width, height);

    const moveLeft = this.inputState.moveLeft;
    const moveRight = this.inputState.moveRight;
    const moveUp = this.inputState.moveUp;
    const moveDown = this.inputState.moveDown;
    if (moveLeft || moveRight || moveUp || moveDown) {
      const speed = 160;
      let vx = 0;
      let vy = 0;
      if (moveLeft) vx -= 1;
      if (moveRight) vx += 1;
      if (moveUp) vy -= 1;
      if (moveDown) vy += 1;
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }
      if (Math.abs(vx) > Math.abs(vy)) {
        this.playerFacing = vx > 0 ? 'right' : 'left';
      } else if (vy !== 0) {
        this.playerFacing = vy > 0 ? 'down' : 'up';
      }
      playLpcPlayerWalk(this, this.player, this.playerFacing);
      this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed * dt, walk.x, walk.right);
      this.player.y = Phaser.Math.Clamp(this.player.y + vy * speed * dt, walk.y, walk.bottom);
    } else {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
    }

    this.refreshAllNpcBlocks();
    this.resolveStaticNpcsVsGreenObstacle();
    this.resolvePlayerFeetVsObstacles();

    this.updateWanderer(dt);
    this.updateChefRoutine();
    this.updateCookAWateringRoutine();
    this.updateStaticCooks();
    this.refreshDepths();

    if (!quests.isDone(QuestFlags.act2AllergensDone)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chef.x, this.chef.y);
      const closeEnough = dist < 82;

      if (closeEnough && act && !this.chefSpoken) {
        this.chefSpoken = true;
        this.dialogueBox.start(
          getDialogue('act2.chefIntro'),
          () => {
            this.openHealthForm();
          },
          { hideSceneHud: this.act2HudForOverlay() },
        );
      } else if (closeEnough && act && this.chefSpoken) {
        this.openHealthForm();
      }
    }

    this.inputState.commit();
  }

  private interruptWateringForEngagement(): void {
    if (this.chefWatering) {
      this.chefWatering = false;
      this.chef.anims.stop();
      this.chefNextWaterAt = this.time.now + Phaser.Math.Between(4500, 9500);
    }
    if (this.cookAWatering) {
      this.cookAWatering = false;
      this.cookA.anims.stop();
      this.cookANextWaterAt = this.time.now + Phaser.Math.Between(5000, 10000);
      setAct2KitchenIdleFrame(this.cookA, 'down');
    }
  }

  private updateChefFacingEngaged(): void {
    const dx = this.player.x - this.chef.x;
    const dy = this.player.y - this.chef.y;
    setAct2KitchenIdleFrame(this.chef, facingFromDelta(dx, dy));
  }

  private updateChefRoutine(): void {
    if (this.dialogueBox.active || this.formBox.active) return;
    if (this.chefWatering) return;
    const now = this.time.now;
    if (now >= this.chefNextWaterAt) {
      this.chefWatering = true;
      playAct2KitchenWaterUpOnce(this, this.chef, () => {
        this.chefWatering = false;
        this.chefNextWaterAt = this.time.now + Phaser.Math.Between(4500, 9500);
        if (!this.dialogueBox.active && !this.formBox.active) {
          setAct2KitchenIdleFrame(this.chef, 'up');
        }
      });
      return;
    }
    setAct2KitchenIdleFrame(this.chef, 'up');
  }

  private updateCookAWateringRoutine(): void {
    if (this.dialogueBox.active || this.formBox.active) return;
    if (this.cookAWatering) return;
    const now = this.time.now;
    if (now >= this.cookANextWaterAt) {
      this.cookAWatering = true;
      setAct2KitchenIdleFrame(this.cookA, 'up');
      playAct2KitchenWaterUpOnce(this, this.cookA, () => {
        this.cookAWatering = false;
        this.cookANextWaterAt = this.time.now + Phaser.Math.Between(7000, 15000);
        if (!this.dialogueBox.active && !this.formBox.active) {
          setAct2KitchenIdleFrame(this.cookA, 'down');
        }
      });
    }
  }

  private updateStaticCooks(): void {
    if (!this.cookAWatering) {
      setAct2KitchenIdleFrame(this.cookA, 'down');
    }
    setAct2KitchenIdleFrame(this.cookB, 'left');
  }

  private wandererTargetValid(tx: number, ty: number): boolean {
    const { width, height } = this.scale;
    const walk = act2WalkBounds(width, height);
    const margin = 20;
    if (tx < walk.x + margin || tx > walk.right - margin || ty < walk.y + margin || ty > walk.bottom - margin) {
      return false;
    }
    for (const r of this.tableBlocks) {
      if (Phaser.Geom.Rectangle.Contains(r, tx, ty)) return false;
    }
    if (Phaser.Geom.Rectangle.Contains(this.debugGreenCollisionRect, tx, ty)) return false;
    const minNpc = 44;
    if (Phaser.Math.Distance.Between(tx, ty, this.chef.x, this.chef.y) < minNpc) return false;
    if (Phaser.Math.Distance.Between(tx, ty, this.cookA.x, this.cookA.y) < minNpc) return false;
    if (Phaser.Math.Distance.Between(tx, ty, this.cookB.x, this.cookB.y) < minNpc) return false;
    return true;
  }

  private pickWandererTarget(): void {
    const { width, height } = this.scale;
    const walk = act2WalkBounds(width, height);
    for (let i = 0; i < 40; i++) {
      const tx = Phaser.Math.FloatBetween(walk.x + 28, walk.right - 28);
      const ty = Phaser.Math.FloatBetween(walk.y + 28, walk.bottom - 28);
      if (this.wandererTargetValid(tx, ty)) {
        this.wandererTarget.x = tx;
        this.wandererTarget.y = ty;
        return;
      }
    }
    this.wandererTarget.x = walk.centerX;
    this.wandererTarget.y = walk.centerY;
  }

  private updateWanderer(dt: number): void {
    const now = this.time.now;
    if (now < this.wandererPauseUntil) {
      setAct2KitchenIdleFrame(this.wanderer, this.wandererFacing);
      return;
    }

    const wx = this.wanderer.x;
    const wy = this.wanderer.y;
    const dx = this.wandererTarget.x - wx;
    const dy = this.wandererTarget.y - wy;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      this.wandererPauseUntil = now + Phaser.Math.Between(700, 2400);
      this.pickWandererTarget();
      setAct2KitchenIdleFrame(this.wanderer, this.wandererFacing);
      return;
    }

    const spd = 58;
    let nx = wx + (dx / dist) * spd * dt;
    let ny = wy + (dy / dist) * spd * dt;
    this.wandererFacing = facingFromDelta(dx, dy);

    this.wanderer.setPosition(nx, ny);
    this.resolveWandererFeetVsObstacles();

    if (Phaser.Math.Distance.Between(this.wanderer.x, this.wanderer.y, wx, wy) < 0.5) {
      this.wandererPauseUntil = now + 400;
      this.pickWandererTarget();
      setAct2KitchenIdleFrame(this.wanderer, this.wandererFacing);
      return;
    }

    playAct2KitchenWalk(this, this.wanderer, this.wandererFacing);
  }

  /**
   * Tri par Y des « pieds » (bas du AABB), comme l’acte 1 / le carrosse : plus bas à l’écran = plus devant.
   * Tables : origine bas-centre → ligne de sol = `img.y`.
   */
  private refreshDepths(): void {
    this.player.setDepth(this.player.getBounds().bottom);
    for (const s of [this.chef, this.cookA, this.cookB, this.wanderer]) {
      s.setDepth(s.getBounds().bottom);
    }

    for (let i = 0; i < this.tableImages.length; i++) {
      const img = this.tableImages[i];
      if (!img) continue;
      const sortY = img.y;
      img.setDepth(sortY);
    }

    const chefFeet = this.chef.getBounds().bottom;
    this.chefLabel.setPosition(this.chef.x, chefFeet + 6);
    this.chefLabel.setDepth(chefFeet + 0.15);

    this.syncDebugGreenHitboxGeometry();
  }

  /** Met à jour le rectangle de collision aligné sur `ACT2_DEBUG_GREEN_HITBOX`. */
  private syncDebugGreenHitboxGeometry(): void {
    const { width, height } = this.scale;
    const h = ACT2_DEBUG_GREEN_HITBOX;
    const cx = width * h.centerXFrac;
    const cy = height * h.centerYFrac;
    this.debugGreenCollisionRect.setTo(cx - h.widthPx / 2, cy - h.heightPx / 2, h.widthPx, h.heightPx);
  }

  /** Repousse chef / cuisiniers fixes hors de `ACT2_DEBUG_GREEN_HITBOX` s’ils la chevauchent. */
  private resolveStaticNpcsVsGreenObstacle(): void {
    const green = this.debugGreenCollisionRect;
    const pairs: [Phaser.GameObjects.Sprite, Phaser.Geom.Rectangle][] = [
      [this.chef, this.chefBlock],
      [this.cookA, this.cookABlock],
      [this.cookB, this.cookBBlock],
    ];
    for (const [spr, block] of pairs) {
      for (let pass = 0; pass < 4; pass++) {
        for (let iter = 0; iter < 10; iter++) {
          this.refreshNpcBlock(spr, block);
          if (!Phaser.Geom.Intersects.RectangleToRectangle(block, green)) break;

          const overlapX = Math.min(block.right, green.right) - Math.max(block.left, green.left);
          const overlapY = Math.min(block.bottom, green.bottom) - Math.max(block.top, green.top);
          if (overlapX <= 0 || overlapY <= 0) break;

          if (overlapX < overlapY) {
            spr.x += block.centerX < green.centerX ? -overlapX : overlapX;
          } else {
            spr.y += block.centerY < green.centerY ? -overlapY : overlapY;
          }
        }
      }
    }
  }

  private openHealthForm(): void {
    if (this.formBox.active || quests.isDone(QuestFlags.act2AllergensDone)) return;
    this.info.setText('Chargement du registre…');
    gameBackend
      .getSelectedPersonneRow()
      .then((row) => {
        const defaults: Record<string, string> = {
          allergenes_alimentaires: String(row?.allergenes_alimentaires ?? ''),
          regimes_remarques: String(row?.regimes_remarques ?? ''),
        };
        this.formBox.startTextFields({
          hideSceneHud: this.act2HudForOverlay(),
          title: 'Registre des saveurs',
          subtitle: 'Pour le service : indiquez ce que le domaine doit savoir (allergènes, régimes, remarques).',
          fields: [
            { name: 'allergenes_alimentaires', label: 'Allergènes (optionnel)', placeholder: 'Noix, gluten…', multiline: true, maxLength: 2000 },
            { name: 'regimes_remarques', label: 'Remarques / régimes (optionnel)', placeholder: 'Végétarien, sans lactose…', multiline: true, maxLength: 2000 },
          ],
          defaults,
          onSubmit: (values) => {
            if (this.saving) return;
            this.saving = true;
            this.info.setText('Sauvegarde en cours…');
            gameBackend
              .recordRsvpForSelected({
                allergenes_alimentaires: values['allergenes_alimentaires'] || '',
                regimes_remarques: values['regimes_remarques'] || '',
              })
              .then(() => {
                quests.done(QuestFlags.act2AllergensDone);
                try {
                  void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
                } catch {}
                this.info.setText('Acte 2 validé. Passage à l’Acte 3…');
                this.time.delayedCall(600, () => {
                  gameState.setAct('act3');
                  this.scene.start('Act3GrangeScene');
                });
              })
              .catch((e) => {
                this.info.setText('Erreur: ' + String(e?.message || e));
              })
              .finally(() => {
                this.saving = false;
              });
          },
        });
      })
      .catch(() => {
        this.formBox.startTextFields({
          hideSceneHud: this.act2HudForOverlay(),
          title: 'Registre des saveurs',
          subtitle: 'Pour le service : indiquez ce que le domaine doit savoir (allergènes, régimes, remarques).',
          fields: [
            { name: 'allergenes_alimentaires', label: 'Allergènes (optionnel)', placeholder: 'Noix, gluten…', multiline: true, maxLength: 2000 },
            { name: 'regimes_remarques', label: 'Remarques / régimes (optionnel)', placeholder: 'Végétarien, sans lactose…', multiline: true, maxLength: 2000 },
          ],
          onSubmit: (values) => {
            if (this.saving) return;
            this.saving = true;
            this.info.setText('Sauvegarde en cours…');
            gameBackend
              .recordRsvpForSelected({
                allergenes_alimentaires: values['allergenes_alimentaires'] || '',
                regimes_remarques: values['regimes_remarques'] || '',
              })
              .then(() => {
                quests.done(QuestFlags.act2AllergensDone);
                try {
                  void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
                } catch {}
                this.info.setText('Acte 2 validé. Passage à l’Acte 3…');
                this.time.delayedCall(600, () => {
                  gameState.setAct('act3');
                  this.scene.start('Act3GrangeScene');
                });
              })
              .catch((e) => {
                this.info.setText('Erreur: ' + String(e?.message || e));
              })
              .finally(() => {
                this.saving = false;
              });
          },
        });
      });
  }

  private act2HudForOverlay(): Phaser.GameObjects.GameObject[] {
    return [this.info, this.chefLabel];
  }
}
