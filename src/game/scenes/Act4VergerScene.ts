import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { registerRequestDomainMapListener } from '../core/open-domain-map';
import { SceneInput } from '../systems/SceneInput';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { PhotoUploadBox } from '../ui/PhotoUploadBox';
import { sceneHudMaskPop, sceneHudMaskPush } from '../ui/scene-hud-mask';
import { VICOMTE_DES_MURMURES_TEXTURE_KEY } from '../data/act4-vicomte';
import {
  ACT4_PONT_DEPTH_OFFSET,
  ACT4_PONT_TEXTURE,
  depthForAct4Pont,
  positionAct4BridgeImages,
} from '../data/act4-bridge';
import {
  ACT4_DEBUG_DRAW_WALK_POLYGON,
  ACT4_PLAYER_START_FRAC,
  ACT4_VICOMTE_POS_FRAC,
  buildAct4WalkPolygon,
  clampSegmentInsidePolygon,
} from '../data/act4-walk-polygon';
import { ACT4_BENCHES, ACT4_BENCH_HITBOX, ACT4_BENCH_TEXTURE_KEY, type Act4BenchDef } from '../data/act4-benches';
import {
  ACT4_CHICKEN_COUNT,
  ACT4_FARM_PADDOCK_INSET,
  ACT4_FARM_PADDOCK_SHOW_OVERLAY,
  ACT4_SHEEP_COUNT,
  act4PaddockBuildRect,
  act4PaddockCreateEntry,
  act4PaddockUpdateOne,
  type Act4PaddockState,
  registerAct4PaddockAnims,
} from '../data/act4-farm-animals';
import { ACT4_TREES, ACT4_TREE_TEXTURE, ACT4_TREE_TRUNK_HITBOX, type Act4TreeDef } from '../data/act4-trees';
import {
  LPC_PLAYER_IDLE_FIRST_FRAMES,
  LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES,
  type LpcFacing,
  playLpcPlayerIdle,
  playLpcPlayerWalk,
  resolveLpcPlayerTextureKey,
  setLpcWalkFirstCycleFrame,
} from '../data/lpc-garcon';

/** Joueur + Vicomte : 50 % de l’échelle LPC habituelle des autres actes (×2 → ×1). */
const ACT4_TILE_SCALE = 1;
const ACT4_PLAYER_SPEED = 150;
const ACT4_NPC_INTERACT_RADIUS = 118;

const ACT4_PLAYER_FEET_HITBOX = {
  widthFrac: 0.38,
  heightFrac: 0.12,
} as const;

const ACT4_NPC_BODY_HITBOX = {
  widthFrac: 0.4,
  heightFrac: 0.28,
} as const;

const ACT4_UI_DEPTH = 100_000;

/** Même palette / typo que Act1CourScene, Act2OfficeScene, Act3GrangeScene. */
const ACT4_TITLE_STYLE = {
  fontFamily: 'monospace',
  fontSize: '20px',
  color: '#f4dfbf',
} as const;
const ACT4_HINT_LARGE_STYLE = {
  fontFamily: 'monospace',
  fontSize: '30px',
  color: '#f4dfbf',
  align: 'center' as const,
};
const ACT4_SUBTITLE_STYLE = {
  fontFamily: 'monospace',
  fontSize: '20px',
  color: '#f4dfbf',
  align: 'center' as const,
};
/** Bandeau type `questText` acte 1 (messages d’état / consignes secondaires). */
const ACT4_QUEST_STYLE = {
  fontFamily: 'monospace',
  fontSize: '13px',
  color: '#8af39a',
  align: 'center' as const,
};
const ACT4_NPC_LABEL_STYLE = {
  fontFamily: 'monospace',
  fontSize: '15px',
  color: '#f2dfc3',
  align: 'center' as const,
};

export class Act4VergerScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private veil!: Phaser.GameObjects.Rectangle;
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private photoBox!: PhotoUploadBox;
  private info!: Phaser.GameObjects.Text;
  /** Grand rappel « Parlez au… » (même placement que actes 1 et 2). */
  private hintText!: Phaser.GameObjects.Text;
  private actTitle!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private saving = false;
  private spoken = false;

  private player!: Phaser.GameObjects.Sprite;
  private vicomte!: Phaser.GameObjects.Sprite;
  private vicomteLabel!: Phaser.GameObjects.Text;
  private playerFacing: LpcFacing = 'up';
  /** Orientation du PNJ (feuille Universal LPC, 4 directions). */
  private vicomteFacing: LpcFacing = 'left';

  private readonly playerFeetBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly npcBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  /** Zone de marche (polygone éditable dans `act4-walk-polygon.ts`). */
  private walkPolygon!: Phaser.Geom.Polygon;
  private walkDebugGfx?: Phaser.GameObjects.Graphics;

  /** Pont (haut + bas) — positions dans `act4-bridge.ts`. */
  private pontHaut!: Phaser.GameObjects.Image;
  private pontBas!: Phaser.GameObjects.Image;

  /** Arbres — définitions dans `act4-trees.ts`. */
  private act4TreeInstances: { def: Act4TreeDef; img: Phaser.GameObjects.Image }[] = [];
  private readonly treeTrunkBlockScratch = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  /** Bancs — définitions dans `act4-benches.ts`. */
  private act4BenchInstances: { def: Act4BenchDef; img: Phaser.GameObjects.Image }[] = [];
  private readonly benchSeatBlockScratch = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  /** Moutons / poules — zone `act4-farm-animals.ts` (`ACT4_FARM_PADDOCK_FRAC`). */
  private act4PaddockRect!: Phaser.Geom.Rectangle;
  private act4PaddockAnimals: Act4PaddockState[] = [];
  private act4PaddockDebugGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Act4VergerScene');
  }

  create(): void {
    gameState.setAct('act4');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.actTitle = this.add
      .text(18, 14, 'ACTE 4 — Le Verger des Confidences', ACT4_TITLE_STYLE)
      .setDepth(ACT4_UI_DEPTH);

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);
    this.photoBox = new PhotoUploadBox(this);

    this.bg = this.add.image(0, 0, 'act4-verger').setOrigin(0, 0).setDepth(-20);
    this.layoutBackground(width, height);
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      this.act4PaddockDebugGfx?.destroy();
      this.act4PaddockDebugGfx = undefined;
    });

    this.veil = this.add.rectangle(width / 2, height / 2, width, height, 0x0f0a12, 0.18).setDepth(-10);

    this.pontHaut = this.add
      .image(0, 0, ACT4_PONT_TEXTURE.haut)
      .setOrigin(0, 0)
      .setDepth(0);
    this.pontBas = this.add
      .image(0, 0, ACT4_PONT_TEXTURE.bas)
      .setOrigin(0, 0)
      .setDepth(0);
    positionAct4BridgeImages(width, height, this.pontHaut, this.pontBas);

    this.spawnAct4Trees();
    this.layoutAct4Trees(width, height);
    this.spawnAct4Benches();
    this.layoutAct4Benches(width, height);

    registerAct4PaddockAnims(this);
    this.act4PaddockRect = act4PaddockBuildRect(width, height, ACT4_FARM_PADDOCK_INSET);
    this.spawnAct4Paddock();
    this.layoutAct4Paddock(width, height);

    this.subtitle = this.add
      .text(width / 2, height * 0.1, 'Le Verger des Confidences', ACT4_SUBTITLE_STYLE)
      .setOrigin(0.5)
      .setDepth(ACT4_UI_DEPTH);

    this.hintText = this.add
      .text(width / 2, height - 450, 'Parlez au Vicomte des Murmures', ACT4_HINT_LARGE_STYLE)
      .setOrigin(0.5)
      .setDepth(ACT4_UI_DEPTH);

    this.info = this.add
      .text(width / 2, height - 62, '', ACT4_QUEST_STYLE)
      .setOrigin(0.5)
      .setDepth(ACT4_UI_DEPTH);

    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    this.player = this.add
      .sprite(0, 0, playerTex, LPC_PLAYER_IDLE_FIRST_FRAMES.up)
      .setScale(ACT4_TILE_SCALE);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    this.vicomte = this.add
      .sprite(0, 0, VICOMTE_DES_MURMURES_TEXTURE_KEY, LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES[this.vicomteFacing])
      .setScale(ACT4_TILE_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(0);
    setLpcWalkFirstCycleFrame(this.vicomte, this.vicomteFacing);

    this.vicomteLabel = this.add
      .text(0, 0, 'Vicomte', ACT4_NPC_LABEL_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(ACT4_UI_DEPTH);

    this.rebuildWalkPolygon(width, height);
    this.layoutActors(width, height);

    registerRequestDomainMapListener(this, () => {
      this.dialogueBox.forceAbort();
      this.formBox.stop();
      this.photoBox.abort();
    });
  }

  private onResize = (gameSize: Phaser.Structs.Size): void => {
    this.layoutBackground(gameSize.width, gameSize.height);
    if (this.veil) {
      this.veil.setPosition(gameSize.width / 2, gameSize.height / 2);
      this.veil.setSize(gameSize.width, gameSize.height);
    }
    this.subtitle?.setPosition(gameSize.width / 2, gameSize.height * 0.1);
    this.hintText?.setPosition(gameSize.width / 2, gameSize.height - 450);
    this.info.setPosition(gameSize.width / 2, gameSize.height - 62);
    this.rebuildWalkPolygon(gameSize.width, gameSize.height);
    positionAct4BridgeImages(gameSize.width, gameSize.height, this.pontHaut, this.pontBas);
    this.layoutAct4Trees(gameSize.width, gameSize.height);
    this.layoutAct4Benches(gameSize.width, gameSize.height);
    this.layoutAct4Paddock(gameSize.width, gameSize.height);
    this.layoutActors(gameSize.width, gameSize.height);
  };

  private spawnAct4Trees(): void {
    for (const def of ACT4_TREES) {
      const key = def.kind === 'prune' ? ACT4_TREE_TEXTURE.prune : ACT4_TREE_TEXTURE.pomme;
      const img = this.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(0);
      img.setScale(def.scale ?? 1);
      this.act4TreeInstances.push({ def, img });
    }
  }

  private layoutAct4Trees(width: number, height: number): void {
    for (const { def, img } of this.act4TreeInstances) {
      img.setPosition(def.xFrac * width, def.yFrac * height);
      img.setScale(def.scale ?? 1);
    }
  }

  private spawnAct4Benches(): void {
    for (const def of ACT4_BENCHES) {
      const img = this.add.image(0, 0, ACT4_BENCH_TEXTURE_KEY).setOrigin(0.5, 1).setDepth(0);
      img.setScale(def.scale ?? 1);
      this.act4BenchInstances.push({ def, img });
    }
  }

  private layoutAct4Benches(width: number, height: number): void {
    for (const { def, img } of this.act4BenchInstances) {
      img.setPosition(def.xFrac * width, def.yFrac * height);
      img.setScale(def.scale ?? 1);
    }
  }

  private spawnAct4Paddock(): void {
    const r = this.act4PaddockRect;
    for (let i = 0; i < ACT4_SHEEP_COUNT; i++) {
      this.act4PaddockAnimals.push(act4PaddockCreateEntry(this, r, 'sheep'));
    }
    for (let j = 0; j < ACT4_CHICKEN_COUNT; j++) {
      this.act4PaddockAnimals.push(act4PaddockCreateEntry(this, r, 'chicken'));
    }
  }

  private layoutAct4Paddock(width: number, height: number): void {
    this.act4PaddockRect = act4PaddockBuildRect(width, height, ACT4_FARM_PADDOCK_INSET);
    for (const a of this.act4PaddockAnimals) {
      a.sprite.setPosition(
        Phaser.Math.Clamp(a.sprite.x, this.act4PaddockRect.x, this.act4PaddockRect.right),
        Phaser.Math.Clamp(a.sprite.y, this.act4PaddockRect.y, this.act4PaddockRect.bottom),
      );
    }
    this.rebuildPaddockDebugOverlay();
  }

  private rebuildPaddockDebugOverlay(): void {
    this.act4PaddockDebugGfx?.destroy();
    this.act4PaddockDebugGfx = undefined;
    if (!ACT4_FARM_PADDOCK_SHOW_OVERLAY) return;
    const p = this.act4PaddockRect;
    if (!p || p.width < 2) return;
    const g = this.add.graphics();
    g.setDepth(-2);
    const r = 0xcc2222;
    g.fillStyle(r, 0.2);
    g.fillRect(p.x, p.y, p.width, p.height);
    g.lineStyle(2, r, 0.5);
    g.strokeRect(p.x, p.y, p.width, p.height);
    this.act4PaddockDebugGfx = g;
  }

  private updateAct4Paddock(dt: number): void {
    for (const a of this.act4PaddockAnimals) {
      act4PaddockUpdateOne(a, this.act4PaddockRect, dt);
    }
  }

  private rebuildWalkPolygon(width: number, height: number): void {
    this.walkPolygon = buildAct4WalkPolygon(width, height);
    this.walkDebugGfx?.destroy();
    this.walkDebugGfx = undefined;
    if (!ACT4_DEBUG_DRAW_WALK_POLYGON) return;
    const g = this.add.graphics().setDepth(99_990);
    const pts = this.walkPolygon.points;
    if (pts.length >= 2) {
      /** Contour + remplissage bleu translucide (zone de marche, debug). */
      const blue = 0x4a8fe8;
      g.lineStyle(2, blue, 0.55);
      g.beginPath();
      g.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i]!.x, pts[i]!.y);
      }
      g.closePath();
      g.strokePath();
      g.fillStyle(blue, 0.22);
      g.fillPath();
    }
    this.walkDebugGfx = g;
  }

  private layoutBackground(width: number, height: number): void {
    if (!this.bg) return;
    const tex = this.textures.get('act4-verger').getSourceImage() as HTMLImageElement;
    const srcW = Math.max(1, tex?.width || 1);
    const srcH = Math.max(1, tex?.height || 1);
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setScale(scale);
    this.bg.setPosition((width - srcW * scale) / 2, (height - srcH * scale) / 2);
  }

  private layoutActors(width: number, height: number): void {
    this.vicomte.setPosition(width * ACT4_VICOMTE_POS_FRAC.x, height * ACT4_VICOMTE_POS_FRAC.y);
    this.player.setPosition(width * ACT4_PLAYER_START_FRAC.x, height * ACT4_PLAYER_START_FRAC.y);
    this.ensurePlayerInWalkPolygon();
    this.syncVicomteLabel();
    this.updateDepthSorting();
  }

  /** Si le joueur sort du polygone (resize, collision), le ramène vers l’intérieur (centre des sommets → position). */
  private ensurePlayerInWalkPolygon(): void {
    const poly = this.walkPolygon;
    const px = this.player.x;
    const py = this.player.y;
    if (poly.contains(px, py)) return;
    const pts = poly.points;
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    const n = Math.max(1, pts.length);
    cx /= n;
    cy /= n;
    const c = clampSegmentInsidePolygon(poly, cx, cy, px, py);
    this.player.setPosition(c.x, c.y);
  }

  private sceneHudForOverlay(): Phaser.GameObjects.GameObject[] {
    return [
      this.player,
      this.vicomte,
      this.vicomteLabel,
      this.pontHaut,
      this.pontBas,
      ...this.act4TreeInstances.map((t) => t.img),
      ...this.act4BenchInstances.map((b) => b.img),
      ...this.act4PaddockAnimals.map((a) => a.sprite),
      this.actTitle,
      this.subtitle,
      this.hintText,
      this.info,
    ];
  }

  private syncVicomteLabel(): void {
    const pad = 4;
    this.vicomteLabel.setPosition(this.vicomte.x, this.vicomte.getBounds().bottom + pad);
  }

  private refreshPlayerFeetBlock(): void {
    const p = this.player;
    const full = p.getBounds();
    const fw = Math.max(10, p.displayWidth * ACT4_PLAYER_FEET_HITBOX.widthFrac);
    const fh = Math.max(6, p.displayHeight * ACT4_PLAYER_FEET_HITBOX.heightFrac);
    const bottom = full.bottom;
    this.playerFeetBlock.setTo(p.x - fw / 2, bottom - fh, fw, fh);
  }

  private refreshNpcBlock(): void {
    const n = this.vicomte;
    const b = n.getBounds();
    const bw = Math.max(24, b.width * ACT4_NPC_BODY_HITBOX.widthFrac);
    const bh = Math.max(28, b.height * ACT4_NPC_BODY_HITBOX.heightFrac);
    this.npcBlock.setTo(n.x - bw / 2, b.bottom - bh, bw, bh);
  }

  private refreshTreeTrunkBlock(img: Phaser.GameObjects.Image, out: Phaser.Geom.Rectangle): void {
    const b = img.getBounds();
    const wf = ACT4_TREE_TRUNK_HITBOX.widthFrac;
    const hf = ACT4_TREE_TRUNK_HITBOX.heightFrac;
    const w = Math.max(8, b.width * wf);
    const h = Math.max(10, b.height * hf);
    out.setTo(b.centerX - w / 2, b.bottom - h, w, h);
  }

  private resolvePlayerTreeCollisions(): void {
    const block = this.treeTrunkBlockScratch;
    for (const { img } of this.act4TreeInstances) {
      for (let pass = 0; pass < 3; pass++) {
        for (let iter = 0; iter < 8; iter++) {
          this.refreshPlayerFeetBlock();
          this.refreshTreeTrunkBlock(img, block);
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
        this.ensurePlayerInWalkPolygon();
      }
    }
  }

  private refreshBenchSeatBlock(img: Phaser.GameObjects.Image, out: Phaser.Geom.Rectangle): void {
    const b = img.getBounds();
    const wf = ACT4_BENCH_HITBOX.widthFrac;
    const hf = ACT4_BENCH_HITBOX.heightFrac;
    const w = Math.max(12, b.width * wf);
    const h = Math.max(8, b.height * hf);
    out.setTo(b.centerX - w / 2, b.bottom - h, w, h);
  }

  private resolvePlayerBenchCollisions(): void {
    const block = this.benchSeatBlockScratch;
    for (const { img } of this.act4BenchInstances) {
      for (let pass = 0; pass < 3; pass++) {
        for (let iter = 0; iter < 8; iter++) {
          this.refreshPlayerFeetBlock();
          this.refreshBenchSeatBlock(img, block);
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
        this.ensurePlayerInWalkPolygon();
      }
    }
  }

  private resolvePlayerNpcCollision(): void {
    this.refreshNpcBlock();
    const block = this.npcBlock;
    for (let pass = 0; pass < 3; pass++) {
      for (let iter = 0; iter < 8; iter++) {
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

      this.ensurePlayerInWalkPolygon();
    }
  }

  /**
   * Oriente le Vicomte vers le joueur — pose figée (1ʳᵉ frame du walk), comme l’acte 1.
   *
   * Le joueur n’a pas `setOrigin(0.5, 1)` (centre par défaut) : `player.y` vaut le **milieu** du
   * sprite, le Vicomte a les **pieds** en (x, y). Avec `player.y - vicomte.y` on comparait donc
   * milieu vs pieds : dès qu’on est proche en dessous, `dy` pouvait rester négatif → tête vers
   * le haut. On aligne sur les **pieds** (bas des AABB, `getBounds()` tient compte de l’échelle).
   */
  private updateVicomteFacingTowardPlayer(): void {
    const p = this.player.getBounds();
    const n = this.vicomte.getBounds();
    const dx = p.centerX - n.centerX;
    const dy = p.bottom - n.bottom;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      setLpcWalkFirstCycleFrame(this.vicomte, this.vicomteFacing);
      this.syncVicomteLabel();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      this.vicomteFacing = dx > 0 ? 'right' : 'left';
    } else {
      this.vicomteFacing = dy > 0 ? 'down' : 'up';
    }
    setLpcWalkFirstCycleFrame(this.vicomte, this.vicomteFacing);
    this.syncVicomteLabel();
  }

  private updateDepthSorting(): void {
    this.updateVicomteFacingTowardPlayer();
    /** Même principe que la cour (Y des pieds / bas du sprite) : le pont se recoupe avec les personnages. */
    const o = ACT4_PONT_DEPTH_OFFSET;
    this.pontBas.setDepth(depthForAct4Pont(this.pontBas, o.bas));
    this.pontHaut.setDepth(depthForAct4Pont(this.pontHaut, o.haut));

    const ySortedProps: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[] = [
      ...this.act4TreeInstances.map((t) => t.img),
      ...this.act4BenchInstances.map((b) => b.img),
      ...this.act4PaddockAnimals.map((a) => a.sprite),
    ];
    ySortedProps.sort((a, b) => a.getBounds().bottom - b.getBounds().bottom);
    for (let i = 0; i < ySortedProps.length; i++) {
      const img = ySortedProps[i]!;
      img.setDepth(img.getBounds().bottom + i * 0.015);
    }

    const playerFeetY = this.player.getBounds().bottom;
    const npcBottom = this.vicomte.getBounds().bottom;
    this.player.setDepth(playerFeetY);
    this.vicomte.setDepth(npcBottom - 0.5);
    this.vicomteLabel.setDepth(ACT4_UI_DEPTH);
  }

  private nearVicomte(): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, this.vicomte.x, this.vicomte.y) < ACT4_NPC_INTERACT_RADIUS;
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;
    this.updateAct4Paddock(dt);
    const interactJustDown = this.inputState.actionJustDown();

    if (this.dialogueBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      if (interactJustDown) this.dialogueBox.next();
      this.updateDepthSorting();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      const choice = this.formBox.handleChoiceMenuInput({
        up: this.inputState.upJustDown(),
        down: this.inputState.downJustDown(),
        action: interactJustDown,
      });
      if (!choice) {
        this.formBox.handleToggleInput({
          up: this.inputState.upJustDown(),
          down: this.inputState.downJustDown(),
          left: this.inputState.leftJustDown(),
          right: this.inputState.rightJustDown(),
          action: interactJustDown,
        });
      }
      this.updateDepthSorting();
      this.inputState.commit();
      return;
    }

    if (this.photoBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateDepthSorting();
      this.inputState.commit();
      return;
    }

    const moveLeft = this.inputState.moveLeft;
    const moveRight = this.inputState.moveRight;
    const moveUp = this.inputState.moveUp;
    const moveDown = this.inputState.moveDown;

    if (moveLeft || moveRight || moveUp || moveDown) {
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

      const prevX = this.player.x;
      const prevY = this.player.y;
      const nx = prevX + vx * ACT4_PLAYER_SPEED * dt;
      const ny = prevY + vy * ACT4_PLAYER_SPEED * dt;
      const clamped = clampSegmentInsidePolygon(this.walkPolygon, prevX, prevY, nx, ny);
      this.player.setPosition(clamped.x, clamped.y);
    } else {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
    }

    this.resolvePlayerNpcCollision();
    this.resolvePlayerTreeCollisions();
    this.resolvePlayerBenchCollisions();
    this.ensurePlayerInWalkPolygon();

    if (interactJustDown) {
      if (this.nearVicomte()) {
        if (!this.spoken) {
          this.spoken = true;
          this.dialogueBox.start(getDialogue('act4.vergerIntro'), () => this.openVergerMenu(), {
            hideSceneHud: this.sceneHudForOverlay(),
          });
        } else {
          this.openVergerMenu();
        }
      } else {
        this.info.setText('Rapprochez-vous du Vicomte des Murmures pour lui parler.');
      }
    }

    this.updateDepthSorting();
    this.inputState.commit();
  }

  private syncAct4AnecdoteQuest(count: number): void {
    gameState.setFlag(QuestFlags.act4AnecdoteDone, count > 0);
  }

  private syncAct4PhotoQuest(count: number): void {
    gameState.setFlag(QuestFlags.act4PhotoDone, count > 0);
  }

  private act4OffrandesSummary(): string {
    const p = quests.isDone(QuestFlags.act4PhotoDone);
    const a = quests.isDone(QuestFlags.act4AnecdoteDone);
    if (p && a) {
      return 'Vous avez partagé une photo et une anecdote. Vous pouvez cliquer sur Terminer.';
    }
    if (p) {
      return 'Photo reçue. L’anecdote est facultative — ou cliquez sur Terminer.';
    }
    if (a) {
      return 'Anecdote reçue. La photo est facultative — ou cliquez sur Terminer.';
    }
    return 'Déposez une photo, une anecdote, ou les deux, puis Terminer quand c’est prêt.';
  }

  private openAnecdoteForm(): void {
    if (this.formBox.active) return;
    void gameBackend.listAnecdotesForSelected().then((list) => {
      this.formBox.startTextFields({
        hideSceneHud: this.sceneHudForOverlay(),
        title: 'Confier une anecdote',
        subtitle: list.length
          ? 'Vos textes déjà reçus sont listés ci-dessus. Saisissez un nouveau message plus bas.'
          : undefined,
        existingAnecdotes: list,
        onDeleteAnecdote: async (id) => {
          await gameBackend.deleteAnecdoteForSelected(id);
          const again = await gameBackend.listAnecdotesForSelected();
          this.syncAct4AnecdoteQuest(again.length);
          try {
            void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
          } catch {}
          this.formBox.stop();
          this.time.delayedCall(0, () => {
            this.info.setText(this.act4OffrandesSummary());
            this.openAnecdoteForm();
          });
        },
        onCancel: () => {
          this.info.setText(this.act4OffrandesSummary());
          this.openVergerMenu();
        },
        fields: [
          {
            name: 'contenu',
            label: list.length ? 'Nouvelle anecdote' : 'Votre anecdote',
            placeholder: 'Une histoire, une rumeur, un souvenir…',
            multiline: true,
            maxLength: 8000,
          },
        ],
        validateBeforeSubmit: (values) => {
          const t = (values['contenu'] || '').trim();
          return t ? null : 'Écrivez au moins quelques mots avant d’enregistrer.';
        },
        onSubmit: (values) => {
          if (this.saving) return;
          const contenu = (values['contenu'] || '').trim();
          this.saving = true;
          this.info.setText('Le Vicomte consigne vos mots…');
          gameBackend
            .insertAnecdoteForSelected(contenu)
            .then(() => {
              return gameBackend.listAnecdotesForSelected();
            })
            .then((after) => {
              this.syncAct4AnecdoteQuest(after.length);
              try {
                void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
              } catch {}
              try {
                window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
              } catch {}
              this.info.setText(this.act4OffrandesSummary());
              this.time.delayedCall(150, () => this.openVergerMenu());
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

  private finishAct4ToDomain(): void {
    const photo = quests.isDone(QuestFlags.act4PhotoDone);
    const anecd = quests.isDone(QuestFlags.act4AnecdoteDone);
    if (!photo && !anecd) {
      this.info.setText('Déposez d’abord une photo ou une anecdote avant de terminer.');
      this.time.delayedCall(150, () => this.openVergerMenu());
      return;
    }
    this.info.setText('Retour au domaine…');
    this.time.delayedCall(650, () => {
      gameState.setAct('hub');
      this.scene.start('HubOpenWorldScene');
    });
  }

  private openVergerMenu(): void {
    if (this.formBox.active || this.photoBox.active) return;
    this.info.setText(this.act4OffrandesSummary());
    this.formBox.startChoiceMenu({
      hideSceneHud: this.sceneHudForOverlay(),
      title: 'Le coffret entre deux pommiers',
      actions: [
        { label: 'Déposer une photo', onSelect: () => this.openPhotoUpload() },
        { label: 'Confier une anecdote', onSelect: () => this.openAnecdoteForm() },
      ],
      onTerminer: () => this.finishAct4ToDomain(),
    });
  }

  private openPhotoUpload(): void {
    if (this.photoBox.active) return;
    sceneHudMaskPush(this, [this.info]);
    this.photoBox.start({
      title: 'Déposer un cliché',
      loadPhotos: () => gameBackend.listFamilyPhotosForSelected(),
      onDeletePhoto: async (key) => {
        await gameBackend.deleteFamilyPhotoForSelected(key);
        const n = (await gameBackend.listFamilyPhotosForSelected()).length;
        this.syncAct4PhotoQuest(n);
        try {
          void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
        } catch {}
      },
      onUpload: async (file) => {
        await gameBackend.uploadPhotoForSelected(file);
      },
      onUploadSuccess: () => {
        void gameBackend.listFamilyPhotosForSelected().then((photos) => {
          this.syncAct4PhotoQuest(photos.length);
        });
        try {
          void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
        } catch {}
        this.info.setText(this.act4OffrandesSummary());
      },
      onPanelClose: () => sceneHudMaskPop(this),
      onEnd: () => {
        this.info.setText(this.act4OffrandesSummary());
        this.openVergerMenu();
      },
    });
  }
}
