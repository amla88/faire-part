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
  ACT2_NPC_BODY_RADIUS,
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

const PLAYER_R = ACT2_NPC_BODY_RADIUS;
const NPC_R = ACT2_NPC_BODY_RADIUS;

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
  private wandererBounds!: Phaser.Geom.Rectangle;
  private wandererTarget = { x: 0, y: 0 };
  private wandererFacing: LpcFacing = 'down';
  private wandererPauseUntil = 0;

  private chefLabel!: Phaser.GameObjects.Text;
  private chefSpoken = false;
  private playerFacing: LpcFacing = 'right';

  private chefWatering = false;
  private chefNextWaterAt = 0;

  constructor() {
    super('Act2OfficeScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(18, 14, 'ACTE 2 — L’Office des saveurs', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0xffffff, 0.18);
    this.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.78, 0x000000, 0.04).setStrokeStyle(2, 0xabbca6, 0.25);
    this.add.rectangle(width * 0.22, height * 0.35, 220, 46, 0xabbca6, 0.1).setStrokeStyle(1, 0x2a3228, 0.18);
    this.add.rectangle(width * 0.76, height * 0.36, 220, 46, 0xabbca6, 0.1).setStrokeStyle(1, 0x2a3228, 0.18);

    const TILE_SCALE = 2;
    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    this.player = this.add
      .sprite(width / 2 - 180, height / 2 + 70, playerTex, LPC_PLAYER_IDLE_FIRST_FRAMES[this.playerFacing])
      .setScale(TILE_SCALE);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    const chefX = width / 2 + 160;
    const chefY = height / 2 - 20;
    this.chef = this.add
      .sprite(chefX, chefY, ACT2_CHEF_TEXTURE_KEY, act2KitchenIdleFirstFrame('up'))
      .setScale(TILE_SCALE);
    setAct2KitchenIdleFrame(this.chef, 'up');

    this.cookA = this.add
      .sprite(width * 0.26, height * 0.56, ACT2_CUISINIER_TEXTURE_KEY, act2KitchenIdleFirstFrame('down'))
      .setScale(TILE_SCALE);
    this.cookB = this.add
      .sprite(width * 0.52, height * 0.4, ACT2_CUISINIER_TEXTURE_KEY, act2KitchenIdleFirstFrame('left'))
      .setScale(TILE_SCALE);

    this.wandererBounds = new Phaser.Geom.Rectangle(
      width * 0.32,
      height * 0.54,
      width * 0.16,
      height * 0.18
    );
    this.wanderer = this.add
      .sprite(this.wandererBounds.centerX, this.wandererBounds.centerY, ACT2_CUISINIER_TEXTURE_KEY, act2KitchenIdleFirstFrame('down'))
      .setScale(TILE_SCALE);
    this.pickWandererTarget();
    this.wandererPauseUntil = this.time.now + 400;

    this.chefLabel = this.add.text(chefX, chefY + 44, "L'Intendant", {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#2c2433',
    }).setOrigin(0.5, 0);

    this.chefNextWaterAt = this.time.now + Phaser.Math.Between(2000, 4500);

    this.info = this.add.text(width / 2, height - 72, "Parlez au chef (Espace / Parler).", {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
      align: 'center',
    }).setOrigin(0.5);

    this.refreshDepths();
  }

  override update(_: number, delta: number): void {
    const dt = delta / 1000;

    if (this.formBox.active) {
      this.info.setVisible(false);
      this.interruptChefWateringForEngagement();
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateChefFacingEngaged();
      this.updateStaticCooks();
      this.refreshDepths();
      this.inputState.commit();
      return;
    }
    this.info.setVisible(true);

    const act = this.inputState.actionJustDown();
    if (this.dialogueBox.active) {
      this.interruptChefWateringForEngagement();
      playLpcPlayerIdle(this, this.player, this.playerFacing);
      this.updateChefFacingEngaged();
      this.updateStaticCooks();
      this.updateWanderer(dt);
      this.refreshDepths();
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

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
      const { width, height } = this.scale;
      const minX = 24;
      const maxX = width - 24;
      const minY = 24;
      const maxY = height - 24;
      let nx = Phaser.Math.Clamp(this.player.x + vx * speed * dt, minX, maxX);
      let ny = Phaser.Math.Clamp(this.player.y + vy * speed * dt, minY, maxY);
      const separated = this.resolveCircleSeparation(nx, ny, PLAYER_R, this.npcObstaclesForPlayer());
      nx = Phaser.Math.Clamp(separated.x, minX, maxX);
      ny = Phaser.Math.Clamp(separated.y, minY, maxY);
      this.player.setPosition(nx, ny);
    } else {
      playLpcPlayerIdle(this, this.player, this.playerFacing);
    }

    this.updateWanderer(dt);
    this.updateChefRoutine();
    this.updateStaticCooks();
    this.refreshDepths();

    if (!quests.isDone(QuestFlags.act2AllergensDone)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chef.x, this.chef.y);
      const closeEnough = dist < 82;

      if (closeEnough && act && !this.chefSpoken) {
        this.chefSpoken = true;
        this.dialogueBox.start(getDialogue('act2.chefIntro'), () => {
          this.openHealthForm();
        });
      } else if (closeEnough && act && this.chefSpoken) {
        this.openHealthForm();
      }
    }

    this.inputState.commit();
  }

  private npcObstaclesForPlayer(): { x: number; y: number; r: number }[] {
    return [
      { x: this.chef.x, y: this.chef.y, r: NPC_R },
      { x: this.cookA.x, y: this.cookA.y, r: NPC_R },
      { x: this.cookB.x, y: this.cookB.y, r: NPC_R },
      { x: this.wanderer.x, y: this.wanderer.y, r: NPC_R },
    ];
  }

  private resolveCircleSeparation(
    x: number,
    y: number,
    selfR: number,
    others: { x: number; y: number; r: number }[]
  ): { x: number; y: number } {
    let ox = x;
    let oy = y;
    for (let iter = 0; iter < 4; iter++) {
      for (const o of others) {
        const dx = ox - o.x;
        const dy = oy - o.y;
        const d = Math.hypot(dx, dy);
        const minD = selfR + o.r;
        if (d < minD) {
          if (d < 0.001) {
            ox += minD;
          } else {
            const push = minD - d;
            ox += (dx / d) * push;
            oy += (dy / d) * push;
          }
        }
      }
    }
    return { x: ox, y: oy };
  }

  private interruptChefWateringForEngagement(): void {
    if (!this.chefWatering) return;
    this.chefWatering = false;
    this.chef.anims.stop();
    this.chefNextWaterAt = this.time.now + Phaser.Math.Between(4500, 9500);
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

  private updateStaticCooks(): void {
    setAct2KitchenIdleFrame(this.cookA, 'down');
    setAct2KitchenIdleFrame(this.cookB, 'left');
  }

  private pickWandererTarget(): void {
    const b = this.wandererBounds;
    const statics = [
      { x: this.chef.x, y: this.chef.y, r: NPC_R },
      { x: this.cookA.x, y: this.cookA.y, r: NPC_R },
      { x: this.cookB.x, y: this.cookB.y, r: NPC_R },
    ];
    for (let i = 0; i < 30; i++) {
      const tx = Phaser.Math.FloatBetween(b.x + NPC_R, b.right - NPC_R);
      const ty = Phaser.Math.FloatBetween(b.y + NPC_R, b.bottom - NPC_R);
      let ok = true;
      for (const s of statics) {
        if (Phaser.Math.Distance.Between(tx, ty, s.x, s.y) < NPC_R + s.r - 4) ok = false;
      }
      if (ok) {
        this.wandererTarget.x = tx;
        this.wandererTarget.y = ty;
        return;
      }
    }
    this.wandererTarget.x = b.centerX;
    this.wandererTarget.y = b.centerY;
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

    const obstacles: { x: number; y: number; r: number }[] = [
      { x: this.chef.x, y: this.chef.y, r: NPC_R },
      { x: this.cookA.x, y: this.cookA.y, r: NPC_R },
      { x: this.cookB.x, y: this.cookB.y, r: NPC_R },
      { x: this.player.x, y: this.player.y, r: PLAYER_R },
    ];
    const separated = this.resolveCircleSeparation(nx, ny, NPC_R, obstacles);
    nx = separated.x;
    ny = separated.y;

    const b = this.wandererBounds;
    nx = Phaser.Math.Clamp(nx, b.x + NPC_R, b.right - NPC_R);
    ny = Phaser.Math.Clamp(ny, b.y + NPC_R, b.bottom - NPC_R);

    if (Phaser.Math.Distance.Between(nx, ny, wx, wy) < 0.5) {
      this.wandererPauseUntil = now + 400;
      this.pickWandererTarget();
      setAct2KitchenIdleFrame(this.wanderer, this.wandererFacing);
      return;
    }

    this.wanderer.setPosition(nx, ny);
    playAct2KitchenWalk(this, this.wanderer, this.wandererFacing);
  }

  private refreshDepths(): void {
    for (const s of [this.player, this.chef, this.cookA, this.cookB, this.wanderer]) {
      s.setDepth(s.y);
    }
    this.chefLabel.setDepth(this.chef.y + 1);
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
          title: 'Santé & bien-être',
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
          title: 'Santé & bien-être',
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
}
