import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { registerRequestDomainMapListener } from '../core/open-domain-map';
import {
  ACT5_BARONNE_FACING,
  ACT5_BARONNE_INTERACT_RADIUS,
  ACT5_BARONNE_POS_FRAC,
  ACT5_BARONNE_TEXTURE_KEY,
  ACT5_Gloriette,
  ACT5_LPC_TILE_SCALE,
  act5DefaultPlayerPos,
  act5WalkBounds,
} from '../data/act5-baronne';
import { getDialogue } from '../data/dialogues.catalog';
import {
  LPC_PLAYER_IDLE_FIRST_FRAMES,
  LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES,
  type LpcFacing,
  playLpcPlayerIdle,
  playLpcPlayerWalk,
  resolveLpcPlayerTextureKey,
  setLpcWalkFirstCycleFrame,
} from '../data/lpc-garcon';
import { gameBackend } from '../services/GameBackendBridge';
import { SceneInput } from '../systems/SceneInput';
import { QuestFlags } from '../systems/QuestSystem';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';

const ACT5_UI_DEPTH = 100_000;
const ACT5_TITLE_STYLE = {
  fontFamily: 'monospace',
  fontSize: '20px',
  color: '#f4dfbf',
} as const;
const ACT5_SUBTITLE_STYLE = {
  fontFamily: 'monospace',
  fontSize: '20px',
  color: '#f4dfbf',
  align: 'center' as const,
};
const ACT5_HINT_STYLE = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#8af39a',
  align: 'center' as const,
};
const ACT5_NPC_LABEL_STYLE = {
  fontFamily: 'monospace',
  fontSize: '15px',
  color: '#f2dfc3',
  align: 'center' as const,
};

/** Hitbox PNJ (AABB relatif au sprite), même logique simplifiée que l’acte 1. */
const ACT5_BARONNE_BODY_HITBOX = {
  widthFrac: 0.42,
  heightFrac: 0.34,
} as const;
/** Bande « pieds » du joueur pour repousser le PNJ. */
const ACT5_PLAYER_FEET_HITBOX = {
  widthFrac: 0.38,
  heightFrac: 0.12,
} as const;
const ACT5_WALK_SPEED = 160;
const ACT5_WALK_ZONE_DEPTH = -6;
/** Zone de marche : remplissage / contour bleus translucides. */
const ACT5_WALK_ZONE_FILL = 0x2563b8;
const ACT5_WALK_ZONE_FILL_ALPHA = 0.2;
const ACT5_WALK_ZONE_STROKE = 0x6eb6ff;
const ACT5_WALK_ZONE_STROKE_ALPHA = 0.45;
/** `true` = repère rectangulaire bleu translucide pour la zone de marche. */
const ACT5_SHOW_WALK_ZONE_OVERLAY = false;

export class Act5GlorietteScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private bg!: Phaser.GameObjects.Image;
  private baronne!: Phaser.GameObjects.Sprite;
  private player!: Phaser.GameObjects.Sprite;
  private playerFacing: LpcFacing = 'up';
  private baronneLabel!: Phaser.GameObjects.Text;
  private walkZoneFill?: Phaser.GameObjects.Rectangle;
  private walkZoneStroke?: Phaser.GameObjects.Rectangle;
  private readonly baronneBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly playerFeetBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private actTitle!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private saving = false;
  private spoken = false;

  constructor() {
    super('Act5GlorietteScene');
  }

  create(): void {
    gameState.setAct('act5');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.actTitle = this.add
      .text(18, 14, 'ACTE 5 — La Gloriette aux souhaits', ACT5_TITLE_STYLE)
      .setDepth(ACT5_UI_DEPTH);

    this.bg = this.add.image(0, 0, ACT5_Gloriette.bg).setOrigin(0, 0).setDepth(-20);
    this.layoutBackground(width, height);
    this.layoutWalkZone(width, height);
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      this.walkZoneFill?.destroy();
      this.walkZoneStroke?.destroy();
      this.walkZoneFill = undefined;
      this.walkZoneStroke = undefined;
    });

    this.baronne = this.add
      .sprite(
        width * ACT5_BARONNE_POS_FRAC.x,
        height * ACT5_BARONNE_POS_FRAC.y,
        ACT5_BARONNE_TEXTURE_KEY,
        LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES[ACT5_BARONNE_FACING],
      )
      .setScale(ACT5_LPC_TILE_SCALE);
    this.baronne.setDepth(0);
    setLpcWalkFirstCycleFrame(this.baronne, ACT5_BARONNE_FACING);

    const spawn = act5DefaultPlayerPos(width, height);
    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    this.player = this.add
      .sprite(
        spawn.x,
        spawn.y,
        playerTex,
        LPC_PLAYER_IDLE_FIRST_FRAMES[this.playerFacing],
      )
      .setScale(ACT5_LPC_TILE_SCALE);
    this.player.setDepth(1);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    this.baronneLabel = this.add
      .text(0, 0, 'Baronne', ACT5_NPC_LABEL_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(ACT5_UI_DEPTH);

    this.subtitle = this.add
      .text(width / 2, height * 0.1, 'La Gloriette aux souhaits', ACT5_SUBTITLE_STYLE)
      .setOrigin(0.5)
      .setDepth(ACT5_UI_DEPTH);

    this.info = this.add
      .text(width / 2, height - 70, '', ACT5_HINT_STYLE)
      .setOrigin(0.5)
      .setDepth(ACT5_UI_DEPTH)
      .setVisible(false);

    this.syncBaronneLabel();
    this.refreshBaronneBlock();
    this.updateAct5DepthSorting();

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    registerRequestDomainMapListener(this, () => {
      this.dialogueBox.forceAbort();
      this.formBox.stop();
    });

    void gameBackend.listIdeesForSelected().then((list) => {
      this.syncAct5IdeaQuest(list.length);
      try {
        void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
      } catch {}
    });
  }

  /** Bandeau bas : uniquement messages ponctuels (erreur, « rapprochez-vous », etc.). */
  private setAct5Info(msg: string): void {
    if (!this.info) return;
    const t = msg.trim();
    if (!t.length) {
      this.info.setText('');
      this.info.setVisible(false);
      return;
    }
    this.info.setText(t);
    this.info.setVisible(true);
  }

  private onResize = (gameSize: Phaser.Structs.Size): void => {
    this.layoutBackground(gameSize.width, gameSize.height);
    this.layoutWalkZone(gameSize.width, gameSize.height);
    this.subtitle.setPosition(gameSize.width / 2, gameSize.height * 0.1);
    this.info?.setPosition(gameSize.width / 2, gameSize.height - 70);
    this.baronne.setPosition(
      gameSize.width * ACT5_BARONNE_POS_FRAC.x,
      gameSize.height * ACT5_BARONNE_POS_FRAC.y,
    );
    {
      const b = act5WalkBounds(gameSize.width, gameSize.height);
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x, b.minX, b.maxX),
        Phaser.Math.Clamp(this.player.y, b.minY, b.maxY),
      );
    }
    this.syncBaronneLabel();
    this.refreshBaronneBlock();
    this.updateAct5DepthSorting();
  };

  private applyWalkZoneOverlayVisibility(): void {
    if (!this.walkZoneFill?.active || !this.walkZoneStroke?.active) return;
    this.walkZoneFill.setVisible(ACT5_SHOW_WALK_ZONE_OVERLAY);
    this.walkZoneStroke.setVisible(ACT5_SHOW_WALK_ZONE_OVERLAY);
  }

  private layoutWalkZone(width: number, height: number): void {
    const w = act5WalkBounds(width, height);
    const rw = w.maxX - w.minX;
    const rh = w.maxY - w.minY;
    const cx = w.minX + rw / 2;
    const cy = w.minY + rh / 2;
    const ok =
      this.walkZoneFill &&
      this.walkZoneStroke &&
      this.walkZoneFill.active &&
      this.walkZoneStroke.active;
    if (ok) {
      this.walkZoneFill!.setPosition(cx, cy);
      this.walkZoneFill!.setSize(rw, rh);
      this.walkZoneStroke!.setPosition(cx, cy);
      this.walkZoneStroke!.setSize(rw, rh);
    } else {
      this.walkZoneFill?.destroy();
      this.walkZoneStroke?.destroy();
      this.walkZoneFill = this.add
        .rectangle(cx, cy, rw, rh, ACT5_WALK_ZONE_FILL, ACT5_WALK_ZONE_FILL_ALPHA)
        .setDepth(ACT5_WALK_ZONE_DEPTH);
      this.walkZoneStroke = this.add
        .rectangle(cx, cy, rw, rh, 0x000000, 0)
        .setStrokeStyle(2, ACT5_WALK_ZONE_STROKE, ACT5_WALK_ZONE_STROKE_ALPHA)
        .setDepth(ACT5_WALK_ZONE_DEPTH);
    }
    this.applyWalkZoneOverlayVisibility();
  }

  private layoutBackground(width: number, height: number): void {
    const tex = this.textures.get(ACT5_Gloriette.bg).getSourceImage() as HTMLImageElement;
    const srcW = Math.max(1, tex?.width || 1);
    const srcH = Math.max(1, tex?.height || 1);
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setScale(scale);
    this.bg.setPosition((width - srcW * scale) / 2, (height - srcH * scale) / 2);
  }

  private syncBaronneLabel(): void {
    const pad = 4;
    this.baronneLabel.setPosition(this.baronne.x, this.baronne.getBounds().bottom + pad);
  }

  private refreshBaronneBlock(): void {
    const n = this.baronne;
    const b = n.getBounds();
    const w = Math.max(24, b.width * ACT5_BARONNE_BODY_HITBOX.widthFrac);
    const h = Math.max(28, b.height * ACT5_BARONNE_BODY_HITBOX.heightFrac);
    this.baronneBlock.setTo(n.x - w / 2, b.bottom - h, w, h);
  }

  private refreshPlayerFeetBlock(): void {
    const p = this.player;
    const full = p.getBounds();
    const fw = Math.max(10, p.displayWidth * ACT5_PLAYER_FEET_HITBOX.widthFrac);
    const fh = Math.max(6, p.displayHeight * ACT5_PLAYER_FEET_HITBOX.heightFrac);
    const bottom = full.bottom;
    this.playerFeetBlock.setTo(p.x - fw / 2, bottom - fh, fw, fh);
  }

  private clampPlayerToWalkZone(): void {
    const { width, height } = this.scale;
    const w = act5WalkBounds(width, height);
    this.player.x = Phaser.Math.Clamp(this.player.x, w.minX, w.maxX);
    this.player.y = Phaser.Math.Clamp(this.player.y, w.minY, w.maxY);
  }

  private resolvePlayerBaronneCollision(): void {
    this.refreshBaronneBlock();
    const block = this.baronneBlock;
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
      this.clampPlayerToWalkZone();
    }
  }

  private updateBaronneFacingTowardPlayer(): void {
    const dx = this.player.x - this.baronne.x;
    const dy = this.player.y - this.baronne.y;
    if (Math.abs(dx) >= 4 || Math.abs(dy) >= 4) {
      let f: LpcFacing = 'down';
      if (Math.abs(dx) > Math.abs(dy)) {
        f = dx > 0 ? 'right' : 'left';
      } else {
        f = dy > 0 ? 'down' : 'up';
      }
      setLpcWalkFirstCycleFrame(this.baronne, f);
    }
  }

  /** Plus bas = plus « devant ». */
  private updateAct5DepthSorting(): void {
    this.updateBaronneFacingTowardPlayer();
    this.syncBaronneLabel();
    this.refreshBaronneBlock();
    const pBottom = this.player.getBounds().bottom;
    const nBottom = this.baronne.getBounds().bottom;
    this.player.setDepth(pBottom);
    this.baronne.setDepth(nBottom);
    this.baronneLabel.setDepth(ACT5_UI_DEPTH);
  }

  private sceneHudForOverlay(): Phaser.GameObjects.GameObject[] {
    const walk =
      ACT5_SHOW_WALK_ZONE_OVERLAY && this.walkZoneFill?.active && this.walkZoneStroke?.active
        ? [this.walkZoneFill, this.walkZoneStroke]
        : [];
    return [
      ...walk,
      this.baronne,
      this.player,
      this.baronneLabel,
      this.subtitle,
      this.info,
      this.actTitle,
    ];
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;
    const act = this.inputState.actionJustDown();
    const moveL = this.inputState.moveLeft;
    const moveR = this.inputState.moveRight;
    const moveU = this.inputState.moveUp;
    const moveD = this.inputState.moveDown;
    const moving = moveL || moveR || moveU || moveD;

    if (this.dialogueBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      if (act) this.dialogueBox.next();
      this.updateAct5DepthSorting();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateAct5DepthSorting();
      this.inputState.commit();
      return;
    }

    if (moving) {
      let vx = 0;
      let vy = 0;
      if (moveL) vx -= 1;
      if (moveR) vx += 1;
      if (moveU) vy -= 1;
      if (moveD) vy += 1;
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
      const { width, height } = this.scale;
      const b = act5WalkBounds(width, height);
      this.player.x = Phaser.Math.Clamp(
        this.player.x + vx * ACT5_WALK_SPEED * dt,
        b.minX,
        b.maxX,
      );
      this.player.y = Phaser.Math.Clamp(
        this.player.y + vy * ACT5_WALK_SPEED * dt,
        b.minY,
        b.maxY,
      );
    } else {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
    }

    this.resolvePlayerBaronneCollision();
    this.updateAct5DepthSorting();

    {
      const d2 = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.baronne.x,
        this.baronne.y,
      );
      if (this.info && d2 < ACT5_BARONNE_INTERACT_RADIUS && this.info.visible && this.info.text.startsWith('Rapprochez')) {
        this.setAct5Info('');
      }
    }

    if (act) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.baronne.x,
        this.baronne.y,
      );
      if (dist >= ACT5_BARONNE_INTERACT_RADIUS) {
        this.setAct5Info('Rapprochez-vous de la Baronne (flèches / ZQSD).');
      } else if (!this.spoken) {
        this.spoken = true;
        this.dialogueBox.start(
          getDialogue('act5.glorietteIntro'),
          () => this.openIdeaForm(),
          { hideSceneHud: this.sceneHudForOverlay() },
        );
      } else {
        this.openIdeaForm();
      }
    }

    this.inputState.commit();
  }

  /** Comme l’acte 4 (anecdotes) : l’acte 5 est validé dès qu’au moins une idée est enregistrée côté serveur. */
  private syncAct5IdeaQuest(count: number): void {
    gameState.setFlag(QuestFlags.act5IdeaDone, count > 0);
  }

  private openIdeaForm(): void {
    if (this.formBox.active) return;
    void gameBackend.listIdeesForSelected().then((list) => {
      this.formBox.startTextFields({
        hideSceneHud: this.sceneHudForOverlay(),
        title: 'Boîte à idées (Acte 5)',
        subtitle:
          'Enregistre l’idée et la place dans la liste. Terminer valide l’acte et ramène à la carte (au moins une idée).',
        closeOnSubmit: false,
        onTerminer: async (): Promise<boolean | string> => {
          const after = await gameBackend.listIdeesForSelected();
          if (after.length === 0) {
            return 'Enregistrez au moins une idée avant de terminer.';
          }
          this.syncAct5IdeaQuest(after.length);
          try {
            void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
          } catch {}
          this.setAct5Info('À bientôt dans l’esprit du jardin !');
          gameState.setAct('hub');
          this.time.delayedCall(0, () => {
            this.scene.start('HubOpenWorldScene');
          });
          return true;
        },
        existingIdees: list,
        onDeleteIdee: async (id) => {
          await gameBackend.deleteIdeeForSelected(id);
          const again = await gameBackend.listIdeesForSelected();
          this.syncAct5IdeaQuest(again.length);
          try {
            void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
          } catch {}
          this.formBox.stop();
          this.time.delayedCall(0, () => {
            this.setAct5Info('');
            this.openIdeaForm();
          });
        },
        fields: [
          {
            name: 'contenu',
            label: list.length ? 'Nouvelle idée' : 'Votre idée',
            placeholder: 'Une suggestion pour le mariage…',
            multiline: true,
            maxLength: 8000,
          },
        ],
        onSubmit: (values) => {
          if (this.saving) return;
          const contenu = (values['contenu'] || '').trim();
          if (!contenu) {
            this.setAct5Info('Écrivez au moins quelques mots.');
            return;
          }
          this.saving = true;
          this.setAct5Info('La Baronne recueille votre inspiration…');
          gameBackend
            .insertIdeeForSelected(contenu)
            .then(() => gameBackend.listIdeesForSelected())
            .then((after) => {
              this.syncAct5IdeaQuest(after.length);
              try {
                void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
              } catch {}
              try {
                window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
              } catch {}
              this.setAct5Info('Idée enregistrée. Vous pouvez en ajouter d’autres ou terminer.');
              this.formBox.stop();
              this.time.delayedCall(0, () => {
                this.openIdeaForm();
              });
            })
            .catch((e) => {
              this.setAct5Info('Erreur: ' + String(e?.message || e));
            })
            .finally(() => {
              this.saving = false;
            });
        },
      });
    });
  }
}
