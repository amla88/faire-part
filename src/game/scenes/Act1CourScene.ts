import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox, type ToggleOption } from '../ui/FormBox';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { SceneInput } from '../systems/SceneInput';
import { getDialogue } from '../data/dialogues.catalog';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';
import { registerRequestDomainMapListener } from '../core/open-domain-map';
import {
  LPC_DE_LA_PLUME_TEXTURE_KEY,
  LPC_PLAYER_IDLE_FIRST_FRAMES,
  LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES,
  type LpcFacing,
  playLpcPlayerIdle,
  playLpcPlayerWalk,
  resolveLpcPlayerTextureKey,
  setLpcWalkFirstCycleFrame,
} from '../data/lpc-garcon';

/** Zone de marche en bas d’écran (fractions de la taille du canvas). Overlay bleu = repère pour ajuster le décor. */
const ACT1_WALK_ZONE = {
  minXFrac: 0.00,
  maxXFrac: 1.0,
  minYFrac: 0.68,
  /** Réserve le bas pour les textes d’UI */
  bottomReservePx: 60,
};

function act1WalkBounds(width: number, height: number): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: width * ACT1_WALK_ZONE.minXFrac,
    maxX: width * ACT1_WALK_ZONE.maxXFrac,
    minY: height * ACT1_WALK_ZONE.minYFrac,
    maxY: height - ACT1_WALK_ZONE.bottomReservePx,
  };
}

/**
 * Carrosse : une seule image — tri par Y (plus bas = plus « devant »).
 * Bande verticale sur le sprite (0 = haut du bitmap, 1 = bas) : l’« épaisseur » est le segment
 * [bandTopFrac, bandBottomFrac] ; la ligne de tri utilisée est le milieu (réglable en élargissant la bande).
 */
const ACT1_CARRIAGE_DEPTH = {
  bandTopFrac: 0.58,
  bandBottomFrac: 0.96,
} as const;

/**
 * Hitbox solide : bande basse uniquement (fractions de la hauteur affichée du sprite, 0 = haut, 1 = bas).
 * Hauteur utile = 1 − insetTopFrac − insetBottomFrac → il faut **strictement** insetTopFrac + insetBottomFrac < 1.
 * Sinon la hauteur devient ≤ 0 (ou un reste minuscule) : plus de vraie collision, tu « traverses » le carrosse.
 * Ex. avec insetTopFrac 0.7, le bas ne peut pas dépasser ~0.29 sans réduire le haut.
 */
const ACT1_CARRIAGE_HITBOX = {
  insetXFrac: 0.06,
  /** Beaucoup d’air au-dessus : la collision ne couvre plus toute la hauteur du dessin. */
  insetTopFrac: 0.7,
  /** Rétrait depuis le bord bas du bitmap (garder la somme avec insetTopFrac < 1). */
  insetBottomFrac: 0.1,
} as const;

const ACT1_UI_DEPTH = 100_000;

/**
 * Zone de collision pieds ↔ carrosse (fractions du sprite joueur affiché), pas le corps entier.
 */
const ACT1_PLAYER_FEET_HITBOX = {
  widthFrac: 0.38,
  heightFrac: 0.12,
} as const;

/** Hitbox PNJ (corps / pieds, relatif au AABB du sprite). */
const ACT1_NPC_BODY_HITBOX = {
  widthFrac: 0.42,
  heightFrac: 0.34,
} as const;

const ACT1_NPC_INTERACT_RADIUS = 96;

export class Act1CourScene extends Phaser.Scene {
  private inputState!: SceneInput;

  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;

  private player!: Phaser.GameObjects.Sprite;
  private npc!: Phaser.GameObjects.Sprite;
  private npcLabel!: Phaser.GameObjects.Text;

  private hintText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;
  private choicesText!: Phaser.GameObjects.Text;
  private saving = false;
  private toChefQueued = false;
  private playerFacing: LpcFacing = 'down';
  private npcFacing: LpcFacing = 'down';

  private carriage!: Phaser.GameObjects.Image;
  /** Obstacle : le joueur ne peut pas marcher dans ce rectangle. */
  private carriageBlock!: Phaser.Geom.Rectangle;
  /** Ligne de tri du carrosse (même unité que les Y des pieds). */
  private carriageSortDepthY = 0;

  /** AABB pieds seuls (collision carrosse). */
  private readonly playerFeetBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  /** AABB PNJ (collision joueur). */
  private readonly npcBlock = new Phaser.Geom.Rectangle(0, 0, 0, 0);

  constructor() {
    super('Act1CourScene');
  }

  create(): void {
    gameState.setAct('act1');
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    const TILE_SCALE = 2;
    this.add
      .image(width / 2, height / 2, 'act1-courtyard')
      .setDisplaySize(width, height)
      .setDepth(-200);

    const walk = act1WalkBounds(width, height);
    const walkW = walk.maxX - walk.minX;
    const walkH = walk.maxY - walk.minY;
    const walkCx = walk.minX + walkW / 2;
    const walkCy = walk.minY + walkH / 2;

    const carriagePad = 12;
    this.carriage = this.add.image(carriagePad, height - carriagePad, 'act1-carosse').setOrigin(0, 1);
    const carriageMaxH = height * 0.32;
    this.carriage.setDisplaySize(
      (this.carriage.width / this.carriage.height) * carriageMaxH,
      carriageMaxH,
    );
    const carriageBottomY = height - carriagePad;
    const carriageTopY = carriageBottomY - this.carriage.displayHeight;
    const midFrac = (ACT1_CARRIAGE_DEPTH.bandTopFrac + ACT1_CARRIAGE_DEPTH.bandBottomFrac) / 2;
    this.carriageSortDepthY = carriageTopY + this.carriage.displayHeight * midFrac;

    const ix = this.carriage.displayWidth * ACT1_CARRIAGE_HITBOX.insetXFrac;
    const iyTop = this.carriage.displayHeight * ACT1_CARRIAGE_HITBOX.insetTopFrac;
    const iyBot = this.carriage.displayHeight * ACT1_CARRIAGE_HITBOX.insetBottomFrac;
    const blockH = Math.max(1, this.carriage.displayHeight - iyTop - iyBot);
    this.carriageBlock = new Phaser.Geom.Rectangle(
      this.carriage.x + ix,
      carriageTopY + iyTop,
      this.carriage.displayWidth - 2 * ix,
      blockH,
    );

    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    this.player = this.add
      .sprite(walk.minX + walkW * 0.28, walk.minY + walkH * 0.20, playerTex, LPC_PLAYER_IDLE_FIRST_FRAMES.down)
      .setScale(TILE_SCALE);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    const npcX = walk.minX + walkW * 0.75;
    const npcY = walk.minY + walkH * 0.20;
    this.npc = this.add
      .sprite(npcX, npcY, LPC_DE_LA_PLUME_TEXTURE_KEY, LPC_PLAYER_WALK_FIRST_CYCLE_FRAMES[this.npcFacing])
      .setScale(TILE_SCALE);
    setLpcWalkFirstCycleFrame(this.npc, this.npcFacing);

    this.npcLabel = this.add.text(npcX, npcY + 44, 'M. de La Plume', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f2dfc3',
    }).setOrigin(0.5, 0);

    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);
    this.inputState = new SceneInput(this);

    this.hintText = this.add.text(width / 2, height - 450, 'Parlez à M. de la Plume', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#f4dfbf',
      align: 'center',
    }).setOrigin(0.5).setDepth(ACT1_UI_DEPTH);

    this.add.text(18, 14, 'ACTE 1 — La Cour d\'Honneur', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f4dfbf',
    });

    this.questText = this.add.text(width / 2, height - 62, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8af39a',
      align: 'center',
    }).setOrigin(0.5).setDepth(ACT1_UI_DEPTH);

    this.choicesText = this.add.text(width / 2, height - 42, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f4dfbf',
      align: 'center',
    }).setOrigin(0.5).setDepth(ACT1_UI_DEPTH);

    this.refreshNpcBlock();
    this.syncNpcLabelPosition();
    this.updateAct1DepthSorting();

    registerRequestDomainMapListener(this, () => {
      this.dialogueBox.forceAbort();
      this.formBox.stop();
    });
  }

  private refreshNpcBlock(): void {
    const n = this.npc;
    const b = n.getBounds();
    const w = Math.max(24, b.width * ACT1_NPC_BODY_HITBOX.widthFrac);
    const h = Math.max(28, b.height * ACT1_NPC_BODY_HITBOX.heightFrac);
    this.npcBlock.setTo(n.x - w / 2, b.bottom - h, w, h);
  }

  private syncNpcLabelPosition(): void {
    const pad = 6;
    this.npcLabel.setPosition(this.npc.x, this.npc.getBounds().bottom + pad);
  }

  /** Oriente le PNJ vers le joueur (4 directions LPC). */
  private updateNpcFacingTowardPlayer(): void {
    const dx = this.player.x - this.npc.x;
    const dy = this.player.y - this.npc.y;
    if (Math.abs(dx) >= 6 || Math.abs(dy) >= 6) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.npcFacing = dx > 0 ? 'right' : 'left';
      } else {
        this.npcFacing = dy > 0 ? 'down' : 'up';
      }
    }
    setLpcWalkFirstCycleFrame(this.npc, this.npcFacing);
    this.syncNpcLabelPosition();
  }

  /** Repousse les pieds du joueur hors du corps du PNJ. */
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

      const { width, height } = this.scale;
      const w = act1WalkBounds(width, height);
      this.player.x = Phaser.Math.Clamp(this.player.x, w.minX, w.maxX);
      this.player.y = Phaser.Math.Clamp(this.player.y, w.minY, w.maxY);
    }
  }

  /**
   * Repousse le joueur hors du carrosse (hitbox pieds ↔ bande verte), puis re-clamp la zone de marche.
   * Le tri en profondeur reste visuel uniquement : dès qu’il y a chevauchement, on bloque (tous les côtés).
   */
  private resolvePlayerCarriageCollision(): void {
    const block = this.carriageBlock;
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

      const { width, height } = this.scale;
      const w = act1WalkBounds(width, height);
      this.player.x = Phaser.Math.Clamp(this.player.x, w.minX, w.maxX);
      this.player.y = Phaser.Math.Clamp(this.player.y, w.minY, w.maxY);
    }
  }

  /** Bande au sol sous le sprite (collision carrosse). */
  private refreshPlayerFeetBlock(): void {
    const p = this.player;
    const full = p.getBounds();
    const fw = Math.max(10, p.displayWidth * ACT1_PLAYER_FEET_HITBOX.widthFrac);
    const fh = Math.max(6, p.displayHeight * ACT1_PLAYER_FEET_HITBOX.heightFrac);
    const bottom = full.bottom;
    this.playerFeetBlock.setTo(p.x - fw / 2, bottom - fh, fw, fh);
  }

  /** Pieds ≈ bas du AABB ; plus le Y est grand, plus le sprite est dessiné devant. */
  private updateAct1DepthSorting(): void {
    this.updateNpcFacingTowardPlayer();
    this.refreshNpcBlock();

    const playerFeetY = this.player.getBounds().bottom;
    const npcFeetY = this.npc.getBounds().bottom;

    this.carriage.setDepth(this.carriageSortDepthY);
    this.player.setDepth(playerFeetY);
    this.npc.setDepth(npcFeetY);
    this.npcLabel.setDepth(npcFeetY + 0.1);
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;

    const moveLeft = this.inputState.moveLeft;
    const moveRight = this.inputState.moveRight;
    const moveUp = this.inputState.moveUp;
    const moveDown = this.inputState.moveDown;

    const interactJustDown = this.inputState.actionJustDown();

    if (this.dialogueBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      if (interactJustDown) this.dialogueBox.next();
      this.updateAct1DepthSorting();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.formBox.handleToggleInput({
        up: this.inputState.upJustDown(),
        down: this.inputState.downJustDown(),
        left: this.inputState.leftJustDown(),
        right: this.inputState.rightJustDown(),
        action: interactJustDown,
      });
      this.updateAct1DepthSorting();
      this.inputState.commit();
      return;
    }

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

      const { width, height } = this.scale;
      const { minX, maxX, minY, maxY } = act1WalkBounds(width, height);

      this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed * dt, minX, maxX);
      this.player.y = Phaser.Math.Clamp(this.player.y + vy * speed * dt, minY, maxY);
    } else {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
    }

    this.resolvePlayerCarriageCollision();
    this.resolvePlayerNpcCollision();

    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y);
    const closeEnough = dist < ACT1_NPC_INTERACT_RADIUS;
    if (closeEnough && interactJustDown) {
      this.choicesText.setText('Consultation du registre…');
      gameBackend
        .getSelectedPersonneRow()
        .then((row) => {
          this.choicesText.setText('');
          const defaults = row
            ? {
                present_reception: row.present_reception === true,
                present_repas: row.present_repas === true,
                present_soiree: row.present_soiree === true,
                decline_invitation: row.decline_invitation === true,
                invite_reception: row.invite_reception === true,
                invite_repas: row.invite_repas === true,
                invite_soiree: row.invite_soiree === true,
              }
            : undefined;

          // IMPORTANT: même si "tout est false", on doit préremplir depuis la DB
          // pour éviter de réécrire des valeurs par défaut.
          const alreadyHasAnything =
            !!row &&
            (row.present_reception === true ||
              row.present_repas === true ||
              row.present_soiree === true ||
              row.decline_invitation === true ||
              String(row.allergenes_alimentaires || '').trim().length > 0 ||
              String(row.regimes_remarques || '').trim().length > 0);

          const dlg = alreadyHasAnything ? getDialogue('act1.already') : getDialogue('act1.register');
          const hud = this.act1HudForOverlay();
          this.dialogueBox.start(
            dlg,
            () => {
              if (alreadyHasAnything) {
                this.questText.setText('Registre déjà rempli (modifiable).');
                this.hintText.setText('Vous pouvez confirmer ou ajuster.');
              } else {
                this.questText.setText('');
                this.hintText.setText('Parlez à M. de la Plume');
              }
              this.openRegisterChoices(defaults);
            },
            { hideSceneHud: hud },
          );
        })
        .catch(() => {
          this.choicesText.setText('');
          this.dialogueBox.start(getDialogue('act1.register'), () => this.openRegisterChoices(), {
            hideSceneHud: this.act1HudForOverlay(),
          });
        });
    }

    this.updateAct1DepthSorting();
    this.inputState.commit();
  }

  private openRegisterChoices(defaults?: {
    present_reception?: boolean;
    present_repas?: boolean;
    present_soiree?: boolean;
    decline_invitation?: boolean;
    invite_reception?: boolean;
    invite_repas?: boolean;
    invite_soiree?: boolean;
  }): void {
    const declined = defaults?.decline_invitation === true;
    const invR = defaults?.invite_reception !== false;
    const invP = defaults?.invite_repas !== false;
    const invS = defaults?.invite_soiree !== false;
    const pr = declined ? false : defaults?.present_reception === true;
    const pp = declined ? false : defaults?.present_repas === true;
    const ps = declined ? false : defaults?.present_soiree === true;

    const toggles: ToggleOption[] = [];
    if (invR) toggles.push({ key: 'present_reception', label: 'Réception', value: pr });
    if (invP) toggles.push({ key: 'present_repas', label: 'Repas', value: pp });
    if (invS) toggles.push({ key: 'present_soiree', label: 'Soirée', value: ps });
    toggles.push({
      key: 'decline_invitation',
      label: 'Ne participe pas (refus)',
      value: declined,
    });

    this.formBox.startToggles({
      hideSceneHud: this.act1HudForOverlay(),
      title: 'Présence au domaine',
      toggles,
      onSubmit: (values) => {
        if (this.saving) return;
        this.saving = true;
        this.choicesText.setText('Enregistrement en cours…');
        const decline = !!values['decline_invitation'];
        gameBackend
          .recordRsvpForSelected({
            decline_invitation: decline,
            present_reception: decline || !invR ? false : !!values['present_reception'],
            present_repas: decline || !invP ? false : !!values['present_repas'],
            present_soiree: decline || !invS ? false : !!values['present_soiree'],
          })
          .then(() => {
            quests.done(QuestFlags.act1RegisterDone);
            try {
              void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
            } catch {}
            this.questText.setText('Présence consignée dans le registre !');
            this.hintText.setText('Un dernier message…');
            this.choicesText.setText('');
            this.playToChefThenGoAct2();
          })
          .catch((e) => {
            this.choicesText.setText('');
            this.hintText.setText('Erreur en sauvegardant. Réessayez.');
            this.questText.setText(String(e?.message || e));
          })
          .finally(() => {
            this.saving = false;
          });
      },
    });
  }

  private playToChefThenGoAct2(): void {
    if (this.toChefQueued) return;
    this.toChefQueued = true;
    this.dialogueBox.start(
      getDialogue('act1.toChef'),
      () => {
        this.time.delayedCall(200, () => {
          if (quests.isDone(QuestFlags.hubMapUnlocked)) {
            gameState.setAct('hub');
            this.scene.start('HubOpenWorldScene');
            return;
          }
          gameState.setAct('act2');
          this.scene.start('Act2OfficeScene');
        });
      },
      { hideSceneHud: this.act1HudForOverlay() },
    );
  }

  private act1HudForOverlay(): Phaser.GameObjects.GameObject[] {
    return [this.hintText, this.questText, this.choicesText];
  }
}

