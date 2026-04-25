import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { registerRequestDomainMapListener } from '../core/open-domain-map';
import {
  ACT6_ECURIE_BG_KEY,
  ACT6_LPC_TILE_SCALE,
  ACT6_MAESTRO_INTERACT_RADIUS,
  ACT6_MAESTRO_POS_FRAC,
  ACT6_MAESTRO_ROUTINE_KEYS,
  ACT6_MAESTRO_TEXTURE_KEY,
  act6DefaultPlayerPos,
  act6WalkBounds,
} from '../data/act6-ecurie';
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
import { quests, QuestFlags } from '../systems/QuestSystem';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';

const ACT6_ROUTINE_ANIM_SET = new Set<string>(ACT6_MAESTRO_ROUTINE_KEYS);

const ACT6_UI_DEPTH = 100_000;
const ACT6_WALK_ZONE_DEPTH = -6;
/** Mettre à `false` pour masquer le repère de zone de marche. */
const ACT6_SHOW_WALK_ZONE_OVERLAY = false;
const ACT6_WALK_ZONE_FILL = 0x2563b8;
const ACT6_WALK_ZONE_FILL_ALPHA = 0.2;
const ACT6_WALK_ZONE_STROKE = 0x6eb6ff;
const ACT6_WALK_ZONE_STROKE_ALPHA = 0.45;
const ACT6_WALK_SPEED = 160;

const ACT6_TITLE_STYLE = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#f4dfbf',
} as const;
const ACT6_HINT_STYLE = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#8af39a',
  align: 'center' as const,
};
const ACT6_NPC_LABEL_STYLE = {
  fontFamily: 'monospace',
  fontSize: '15px',
  color: '#f2dfc3',
  align: 'center' as const,
};

const ACT6_MAESTRO_BODY_HITBOX = { widthFrac: 0.42, heightFrac: 0.34 } as const;
const ACT6_PLAYER_FEET_HITBOX = { widthFrac: 0.38, heightFrac: 0.12 } as const;

export class Act6EcurieScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private info!: Phaser.GameObjects.Text;
  private actTitle!: Phaser.GameObjects.Text;
  private bg!: Phaser.GameObjects.Image;
  private maestro!: Phaser.GameObjects.Sprite;
  private maestroLabel!: Phaser.GameObjects.Text;
  private player!: Phaser.GameObjects.Sprite;
  private playerFacing: LpcFacing = 'up';
  private walkZoneFill?: Phaser.GameObjects.Rectangle;
  private walkZoneStroke?: Phaser.GameObjects.Rectangle;
  private readonly maestroBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private readonly playerFeetBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private maestroRoutineTimer?: Phaser.Time.TimerEvent;
  private prevMaestroWatch = false;
  private saving = false;
  private spoken = false;

  private readonly onMaestroAnimComplete = (animation: Phaser.Animations.Animation) => {
    if (!ACT6_ROUTINE_ANIM_SET.has(animation.key)) return;
    if (this.maestroWatchesPlayer()) return;
    setLpcWalkFirstCycleFrame(this.maestro, 'up');
    this.scheduleMaestroRoutineGap();
  };

  constructor() {
    super('Act6EcurieScene');
  }

  create(): void {
    gameState.setAct('act6');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.bg = this.add.image(0, 0, ACT6_ECURIE_BG_KEY).setOrigin(0, 0).setDepth(-20);
    this.layoutBackground(width, height);
    this.layoutWalkZone(width, height);

    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      this.maestro?.off('animationcomplete', this.onMaestroAnimComplete);
      this.maestroRoutineTimer?.remove(false);
      this.walkZoneFill?.destroy();
      this.walkZoneStroke?.destroy();
      this.walkZoneFill = undefined;
      this.walkZoneStroke = undefined;
    });

    this.actTitle = this.add
      .text(18, 14, 'ACTE 6 — L’Écurie musicale', ACT6_TITLE_STYLE)
      .setDepth(ACT6_UI_DEPTH);

    this.maestro = this.add
      .sprite(
        width * ACT6_MAESTRO_POS_FRAC.x,
        height * ACT6_MAESTRO_POS_FRAC.y,
        ACT6_MAESTRO_TEXTURE_KEY,
        LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES.up,
      )
      .setScale(ACT6_LPC_TILE_SCALE);
    setLpcWalkFirstCycleFrame(this.maestro, 'up');
    this.maestro.on('animationcomplete', this.onMaestroAnimComplete);

    const spawn = act6DefaultPlayerPos(width, height);
    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    this.player = this.add
      .sprite(spawn.x, spawn.y, playerTex, LPC_PLAYER_IDLE_FIRST_FRAMES[this.playerFacing])
      .setScale(ACT6_LPC_TILE_SCALE);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    this.maestroLabel = this.add
      .text(0, 0, 'Chef d’orchestre', ACT6_NPC_LABEL_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(ACT6_UI_DEPTH);

    this.info = this.add
      .text(width / 2, height - 70, '', ACT6_HINT_STYLE)
      .setOrigin(0.5)
      .setDepth(ACT6_UI_DEPTH)
      .setVisible(false);

    this.syncMaestroLabel();
    this.refreshMaestroBlock();
    this.updateAct6DepthSorting();

    this.prevMaestroWatch = this.maestroWatchesPlayer();
    if (!this.prevMaestroWatch) {
      this.scheduleMaestroRoutineGap();
    }

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    registerRequestDomainMapListener(this, () => {
      this.dialogueBox.forceAbort();
      this.formBox.stop();
    });
  }

  private maestroWatchesPlayer(): boolean {
    if (this.dialogueBox?.active || this.formBox?.active) return true;
    return (
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.maestro.x, this.maestro.y) <
      ACT6_MAESTRO_INTERACT_RADIUS
    );
  }

  private scheduleMaestroRoutineGap(): void {
    if (!this.maestro?.active) return;
    if (this.maestroWatchesPlayer()) return;
    this.maestroRoutineTimer?.remove(false);
    this.maestroRoutineTimer = this.time.delayedCall(Phaser.Math.Between(800, 2400), () => {
      this.maestroRoutineTimer = undefined;
      this.tryPlayMaestroRoutine();
    });
  }

  private tryPlayMaestroRoutine(): void {
    if (!this.maestro?.active || this.maestroWatchesPlayer()) return;
    const key = Phaser.Math.RND.pick([...ACT6_MAESTRO_ROUTINE_KEYS]);
    if (this.anims.exists(key)) {
      this.maestro.play(key);
    } else {
      this.scheduleMaestroRoutineGap();
    }
  }

  private sceneHudForOverlay(): Phaser.GameObjects.GameObject[] {
    const walk =
      ACT6_SHOW_WALK_ZONE_OVERLAY && this.walkZoneFill?.active && this.walkZoneStroke?.active
        ? [this.walkZoneFill, this.walkZoneStroke]
        : [];
    return [
      ...(walk as Phaser.GameObjects.GameObject[]),
      this.maestro,
      this.player,
      this.maestroLabel,
      this.actTitle,
      this.info,
    ];
  }

  private setAct6Info(msg: string): void {
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
    this.info?.setPosition(gameSize.width / 2, gameSize.height - 70);
    this.maestro.setPosition(
      gameSize.width * ACT6_MAESTRO_POS_FRAC.x,
      gameSize.height * ACT6_MAESTRO_POS_FRAC.y,
    );
    {
      const b = act6WalkBounds(gameSize.width, gameSize.height);
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x, b.minX, b.maxX),
        Phaser.Math.Clamp(this.player.y, b.minY, b.maxY),
      );
    }
    this.syncMaestroLabel();
    this.refreshMaestroBlock();
    this.updateAct6DepthSorting();
  };

  private applyWalkZoneOverlayVisibility(): void {
    if (!this.walkZoneFill?.active || !this.walkZoneStroke?.active) return;
    this.walkZoneFill.setVisible(ACT6_SHOW_WALK_ZONE_OVERLAY);
    this.walkZoneStroke.setVisible(ACT6_SHOW_WALK_ZONE_OVERLAY);
  }

  private layoutWalkZone(width: number, height: number): void {
    const w = act6WalkBounds(width, height);
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
        .rectangle(cx, cy, rw, rh, ACT6_WALK_ZONE_FILL, ACT6_WALK_ZONE_FILL_ALPHA)
        .setDepth(ACT6_WALK_ZONE_DEPTH);
      this.walkZoneStroke = this.add
        .rectangle(cx, cy, rw, rh, 0x000000, 0)
        .setStrokeStyle(2, ACT6_WALK_ZONE_STROKE, ACT6_WALK_ZONE_STROKE_ALPHA)
        .setDepth(ACT6_WALK_ZONE_DEPTH);
    }
    this.applyWalkZoneOverlayVisibility();
  }

  private layoutBackground(width: number, height: number): void {
    const tex = this.textures.get(ACT6_ECURIE_BG_KEY).getSourceImage() as HTMLImageElement;
    const srcW = Math.max(1, tex?.width || 1);
    const srcH = Math.max(1, tex?.height || 1);
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setScale(scale);
    this.bg.setPosition((width - srcW * scale) / 2, (height - srcH * scale) / 2);
  }

  private syncMaestroLabel(): void {
    const pad = 4;
    this.maestroLabel.setPosition(this.maestro.x, this.maestro.getBounds().bottom + pad);
  }

  private refreshMaestroBlock(): void {
    const n = this.maestro;
    const b = n.getBounds();
    const w = Math.max(24, b.width * ACT6_MAESTRO_BODY_HITBOX.widthFrac);
    const h = Math.max(28, b.height * ACT6_MAESTRO_BODY_HITBOX.heightFrac);
    this.maestroBlock.setTo(n.x - w / 2, b.bottom - h, w, h);
  }

  private refreshPlayerFeetBlock(): void {
    const p = this.player;
    const full = p.getBounds();
    const fw = Math.max(10, p.displayWidth * ACT6_PLAYER_FEET_HITBOX.widthFrac);
    const fh = Math.max(6, p.displayHeight * ACT6_PLAYER_FEET_HITBOX.heightFrac);
    const bottom = full.bottom;
    this.playerFeetBlock.setTo(p.x - fw / 2, bottom - fh, fw, fh);
  }

  private clampPlayerToWalkZone(): void {
    const { width, height } = this.scale;
    const w = act6WalkBounds(width, height);
    this.player.x = Phaser.Math.Clamp(this.player.x, w.minX, w.maxX);
    this.player.y = Phaser.Math.Clamp(this.player.y, w.minY, w.maxY);
  }

  private resolvePlayerMaestroCollision(): void {
    this.refreshMaestroBlock();
    const block = this.maestroBlock;
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

  private updateMaestroFacingTowardPlayer(): void {
    const dx = this.player.x - this.maestro.x;
    const dy = this.player.y - this.maestro.y;
    if (Math.abs(dx) >= 4 || Math.abs(dy) >= 4) {
      let f: LpcFacing = 'down';
      if (Math.abs(dx) > Math.abs(dy)) {
        f = dx > 0 ? 'right' : 'left';
      } else {
        f = dy > 0 ? 'down' : 'up';
      }
      setLpcWalkFirstCycleFrame(this.maestro, f);
    }
  }

  private updateAct6DepthSorting(): void {
    if (this.maestroWatchesPlayer()) {
      this.updateMaestroFacingTowardPlayer();
    }
    this.syncMaestroLabel();
    this.refreshMaestroBlock();
    const pBottom = this.player.getBounds().bottom;
    const mBottom = this.maestro.getBounds().bottom;
    this.player.setDepth(pBottom);
    this.maestro.setDepth(mBottom);
    this.maestroLabel.setDepth(ACT6_UI_DEPTH);
  }

  private syncMaestroWatchTransitions(): void {
    const watch = this.maestroWatchesPlayer();
    if (watch === this.prevMaestroWatch) return;
    this.prevMaestroWatch = watch;
    if (watch) {
      this.maestroRoutineTimer?.remove(false);
      this.maestroRoutineTimer = undefined;
      const cur = this.maestro.anims.currentAnim?.key;
      if (cur && ACT6_ROUTINE_ANIM_SET.has(cur)) {
        this.maestro.anims.stop();
      }
      this.updateMaestroFacingTowardPlayer();
    } else {
      setLpcWalkFirstCycleFrame(this.maestro, 'up');
      this.scheduleMaestroRoutineGap();
    }
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;
    const act = this.inputState.actionJustDown();
    const moveL = this.inputState.moveLeft;
    const moveR = this.inputState.moveRight;
    const moveU = this.inputState.moveUp;
    const moveD = this.inputState.moveDown;
    const moving = moveL || moveR || moveU || moveD;

    this.syncMaestroWatchTransitions();

    if (this.dialogueBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateMaestroFacingTowardPlayer();
      if (act) this.dialogueBox.next();
      this.updateAct6DepthSorting();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateMaestroFacingTowardPlayer();
      this.updateAct6DepthSorting();
      this.inputState.commit();
      return;
    }

    if (this.maestroWatchesPlayer()) {
      this.updateMaestroFacingTowardPlayer();
    } else if (!this.maestro.anims.isPlaying) {
      setLpcWalkFirstCycleFrame(this.maestro, 'up');
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
      const b = act6WalkBounds(width, height);
      this.player.x = Phaser.Math.Clamp(
        this.player.x + vx * ACT6_WALK_SPEED * dt,
        b.minX,
        b.maxX,
      );
      this.player.y = Phaser.Math.Clamp(
        this.player.y + vy * ACT6_WALK_SPEED * dt,
        b.minY,
        b.maxY,
      );
    } else {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
    }

    this.resolvePlayerMaestroCollision();
    this.updateAct6DepthSorting();

    {
      const d2 = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.maestro.x,
        this.maestro.y,
      );
      if (d2 < ACT6_MAESTRO_INTERACT_RADIUS && this.info.visible && this.info.text.includes('Rapprochez')) {
        this.setAct6Info('');
      }
    }

    if (act) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.maestro.x,
        this.maestro.y,
      );
      if (dist >= ACT6_MAESTRO_INTERACT_RADIUS) {
        this.setAct6Info('Rapprochez-vous du Maestro (flèches / ZQSD), puis Espace / Enter.');
      } else if (!this.spoken) {
        this.spoken = true;
        this.dialogueBox.start(getDialogue('act6.ecurieIntro'), () => this.openMusicForm(), {
          hideSceneHud: this.sceneHudForOverlay(),
        });
      } else {
        this.openMusicForm();
      }
    }

    this.inputState.commit();
  }

  private openMusicForm(): void {
    if (this.formBox.active) return;
    void gameBackend.listMusiquesForSelected().then((list) => {
      if (!this.scene.isActive('Act6EcurieScene')) return;
      if (this.formBox.active) return;
      this.formBox.startTextFields({
        closeOnSubmit: false,
        hideSceneHud: this.sceneHudForOverlay(),
        title: 'Air du bal (Acte 6)',
        musiqueSlots: {
          items: list,
          max: 3,
          onDelete: async (id) => {
            await gameBackend.deleteMusiqueForSelected(id);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
            } catch {}
            this.formBox.stop();
            this.time.delayedCall(0, () => this.openMusicForm());
          },
        },
        validateBeforeSubmit: (values) => {
          if (list.length >= 3) {
            return 'Les trois places sont prises. Retirez une proposition en attente ou refusée pour en ajouter une autre.';
          }
          const lien = String(values['lien'] || '').trim();
          if (lien && !/^https?:\/\/.+/i.test(lien)) {
            return 'Le lien doit commencer par http:// ou https://';
          }
          return null;
        },
        fields: [
          { name: 'titre', label: 'Titre', placeholder: 'Ex: Dancing Queen', multiline: false, maxLength: 200 },
          { name: 'auteur', label: 'Auteur / Artiste', placeholder: 'Ex: ABBA', multiline: false, maxLength: 200 },
          { name: 'lien', label: 'Lien', placeholder: 'Spotify / YouTube / Deezer…', multiline: false, maxLength: 2000 },
          { name: 'commentaire', label: 'Commentaire (optionnel)', placeholder: 'Pourquoi ce choix ?', multiline: true, maxLength: 2000 },
        ],
        onSubmit: async (values) => {
          if (this.saving) return;
          const titre = (values['titre'] || '').trim();
          const auteur = (values['auteur'] || '').trim();
          const lien = (values['lien'] || '').trim();
          const commentaire = (values['commentaire'] || '').trim();

          if (!titre || !auteur || !lien) {
            this.setAct6Info('Titre, auteur et lien sont requis.');
            return;
          }
          if (!/^https?:\/\/.+/i.test(lien)) {
            this.setAct6Info('Lien invalide : commencez par http:// ou https://');
            return;
          }

          this.saving = true;
          this.setAct6Info('Le Maestro note votre proposition…');
          try {
            await gameBackend.insertMusiqueManualForSelected({ titre, auteur, lien, commentaire });
            quests.done(QuestFlags.act6MusicDone);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            try {
              window.dispatchEvent(new CustomEvent('fp-game-progress-updated'));
            } catch {}

            const after = await gameBackend.listMusiquesForSelected();
            this.formBox.stop();

            if (after.length >= 3) {
              this.setAct6Info('Les trois airs sont notés. Merci !');
              this.time.delayedCall(650, () => {
                gameState.setAct('hub');
                this.scene.start('HubOpenWorldScene');
              });
            } else {
              this.setAct6Info(`${after.length}/3 titre(s) enregistré(s). Vous pouvez en proposer d’autres (Espace près du Maestro).`);
              this.time.delayedCall(0, () => this.openMusicForm());
            }
          } catch (e: unknown) {
            const msg = String((e as Error)?.message || e);
            if (msg.includes('musique_limit_reached')) {
              this.setAct6Info('Limite de trois titres atteinte.');
              this.formBox.stop();
              this.time.delayedCall(0, () => this.openMusicForm());
            } else if (msg.includes('check_valid_url') || msg.includes('violates check constraint')) {
              this.setAct6Info('Lien invalide : commencez par http:// ou https://');
            } else {
              this.setAct6Info('Erreur: ' + msg);
            }
          } finally {
            this.saving = false;
          }
        },
      });
    });
  }
}
