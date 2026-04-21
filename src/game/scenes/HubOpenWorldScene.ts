import Phaser from 'phaser';
import { gameState } from '../core/game-state';
import { QuestFlags, quests } from '../systems/QuestSystem';

type HubTravelTarget =
  | 'Act0CarrosseScene'
  | 'Act1CourScene'
  | 'Act2OfficeScene'
  | 'Act3GrangeScene'
  | 'Act4VergerScene'
  | 'Act5GlorietteScene'
  | 'Act6EcurieScene'
  | 'Act7FinalGazetteScene';

type HubTravelNodeDef = {
  id: string;
  scene: HubTravelTarget;
  x: number;
  y: number;
  label: string;
  /** Destination atteignable (sinon pastille rouge translucide + non cliquable). */
  unlocked: () => boolean;
  /** Étape “zone” complétée (pastille verte). */
  done: () => boolean;
};

export class HubOpenWorldScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private halo!: Phaser.GameObjects.Graphics;
  private haloTween?: Phaser.Tweens.Tween;

  private nodes: {
    def: HubTravelNodeDef;
    hit: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  }[] = [];

  private selectedIndex = 0;
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    q: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super('HubOpenWorldScene');
  }

  create(): void {
    gameState.setAct('hub');
    const { width, height } = this.scale;

    // Fond carte (servie sous `/assets/...` via `PreloadScene`).
    this.bg = this.add.image(0, 0, 'hub-domain-map').setOrigin(0, 0).setDepth(-20);
    this.layoutBackground(width, height);

    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      try {
        this.haloTween?.stop();
      } catch {}
      this.haloTween = undefined;
    });

    const defs = this.buildTravelDefs();
    this.nodes = defs.map((def) => {
      const hit = this.add
        .circle(def.x, def.y, 18, 0xf4dfbf, 0.92)
        .setStrokeStyle(2, 0x2c2433, 0.55)
        .setDepth(2);

      const label = this.add
        .text(def.x, def.y + 34, def.label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#2c2433',
          align: 'center',
          backgroundColor: 'rgba(250, 246, 241, 0.78)',
          padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(3);

      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        const idx = this.nodes.findIndex((n) => n.def.id === def.id);
        if (idx < 0) return;
        if (!this.nodes[idx]!.def.unlocked()) return;
        this.setSelectedIndex(idx);
      });
      hit.on('pointerdown', () => {
        const idx = this.nodes.findIndex((n) => n.def.id === def.id);
        if (idx < 0) return;
        if (!this.nodes[idx]!.def.unlocked()) return;
        this.setSelectedIndex(idx);
        this.tryTravelSelected();
      });

      return { def, hit, label };
    });

    this.halo = this.add.graphics().setDepth(-5);
    this.startHaloPulse();

    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      q: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    this.selectedIndex = this.pickInitialSelectableIndex();
    this.refreshTravelVisuals();
    this.updateHalo();
  }

  private onResize = (gameSize: Phaser.Structs.Size): void => {
    this.layoutBackground(gameSize.width, gameSize.height);
    this.updateHalo();
  };

  private layoutBackground(width: number, height: number): void {
    if (!this.bg) return;
    const tex = this.textures.get('hub-domain-map').getSourceImage() as HTMLImageElement;
    const srcW = Math.max(1, tex?.width || 1);
    const srcH = Math.max(1, tex?.height || 1);
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setScale(scale);
    this.bg.setPosition((width - srcW * scale) / 2, (height - srcH * scale) / 2);
  }

  private buildTravelDefs(): HubTravelNodeDef[] {
    const hubUnlocked = quests.isDone(QuestFlags.hubMapUnlocked);

    const allStepsDone = () =>
      quests.isDone(QuestFlags.act1RegisterDone) &&
      quests.isDone(QuestFlags.act2AllergensDone) &&
      quests.isDone(QuestFlags.act3AvatarDone) &&
      (quests.isDone(QuestFlags.act4AnecdoteDone) || quests.isDone(QuestFlags.act4PhotoDone)) &&
      quests.isDone(QuestFlags.act5IdeaDone) &&
      quests.isDone(QuestFlags.act6MusicDone);

    // Placement volontairement “artistique” (coords en 960x540).
    return [
      {
        id: 'act0',
        scene: 'Act0CarrosseScene',
        x: 150,
        y: 480,
        label: 'Acte 0 - Carrosse',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act0IntroSeen),
        done: () => quests.isDone(QuestFlags.act0IntroSeen),
      },
      {
        id: 'act1',
        scene: 'Act1CourScene',
        x: 480,
        y: 480,
        label: 'Acte 1 - Cour',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act0IntroSeen),
        done: () => quests.isDone(QuestFlags.act1RegisterDone),
      },
      {
        id: 'act2',
        scene: 'Act2OfficeScene',
        x: 110,
        y: 300,
        label: 'Acte 2 - Office des saveurs',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act1RegisterDone),
        done: () => quests.isDone(QuestFlags.act2AllergensDone),
      },
      {
        id: 'act3',
        scene: 'Act3GrangeScene',
        x: 840,
        y: 380,
        label: 'Acte 3 - Grande grange',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act2AllergensDone),
        done: () => quests.isDone(QuestFlags.act3AvatarDone),
      },
      {
        id: 'act4',
        scene: 'Act4VergerScene',
        x: 900,
        y: 250,
        label: 'Acte 4 - Verger',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act3AvatarDone),
        done: () => quests.isDone(QuestFlags.act4AnecdoteDone) || quests.isDone(QuestFlags.act4PhotoDone),
      },
      {
        id: 'act5',
        scene: 'Act5GlorietteScene',
        x: 270,
        y: 200,
        label: 'Acte 5 - Gloriette',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act3AvatarDone),
        done: () => quests.isDone(QuestFlags.act5IdeaDone),
      },
      {
        id: 'act6',
        scene: 'Act6EcurieScene',
        x: 650,
        y: 200,
        label: 'Acte 6 - Écurie',
        unlocked: () => hubUnlocked && quests.isDone(QuestFlags.act3AvatarDone),
        done: () => quests.isDone(QuestFlags.act6MusicDone),
      },
      {
        id: 'act7',
        scene: 'Act7FinalGazetteScene',
        x: 480,
        y: 120,
        label: 'Acte 7 - Gazette',
        unlocked: () => hubUnlocked && allStepsDone(),
        done: () => quests.isDone(QuestFlags.finalSeen),
      },
    ];
  }

  private pickInitialSelectableIndex(): number {
    const first = this.nodes.findIndex((n) => n.def.unlocked());
    return first >= 0 ? first : 0;
  }

  private selectableIndices(): number[] {
    return this.nodes.map((n, i) => (n.def.unlocked() ? i : -1)).filter((i) => i >= 0);
  }

  private setSelectedIndex(next: number): void {
    if (!this.nodes.length) return;
    const wrapped = Phaser.Math.Wrap(next, 0, this.nodes.length);
    this.selectedIndex = wrapped;
    this.refreshTravelVisuals();
    this.updateHalo();
  }

  private refreshTravelVisuals(): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const unlocked = n.def.unlocked();
      const done = n.def.done();
      const selected = i === this.selectedIndex;

      if (unlocked) {
        if (!n.hit.input) {
          n.hit.setInteractive({ useHandCursor: true });
        } else {
          (n.hit.input as unknown as { useHandCursor?: boolean }).useHandCursor = true;
        }
      } else {
        n.hit.disableInteractive();
      }

      // Couleurs demandées:
      // - vert: complété
      // - bleu: accessible mais pas complété
      // - rouge translucide: verrouillé
      let fill = 0x1976d2;
      let fillAlpha = 1;
      if (!unlocked) {
        fill = 0xd32f2f;
        fillAlpha = 0.22;
      } else if (done) {
        fill = 0x2e7d32;
        fillAlpha = 1;
      }

      n.hit.setFillStyle(fill, fillAlpha);
      n.hit.setStrokeStyle(2, selected ? 0xffffff : 0x2c2433, selected ? 0.95 : unlocked ? 0.35 : 0.18);
      if (n.hit.input) {
        // Phaser typings: `useHandCursor` existe en runtime sur les objets interactifs.
        (n.hit.input as unknown as { useHandCursor?: boolean }).useHandCursor = unlocked;
      }

      n.label.setAlpha(unlocked ? 1 : 0.45);
      if (!unlocked) {
        n.label.setColor('#5a5a5a');
        n.label.setBackgroundColor('rgba(250, 246, 241, 0.35)');
      } else if (done) {
        n.label.setColor('#ffffff');
        n.label.setBackgroundColor('rgba(15, 59, 20, 0.92)');
      } else {
        n.label.setColor('#ffffff');
        n.label.setBackgroundColor('rgba(11, 47, 90, 0.92)');
      }
    }
  }

  private updateHalo(): void {
    if (!this.halo) return;
    const n = this.nodes[this.selectedIndex];
    if (!n || !n.def.unlocked() || n.def.done()) {
      this.halo.clear();
      return;
    }

    const { x, y } = n.hit;
    const r = 46;
    this.halo.clear();

    // Halo doux (plusieurs disques concentriques).
    for (let i = 0; i < 6; i++) {
      const rr = r + i * 10;
      const a = 0.14 - i * 0.018;
      this.halo.fillStyle(0xfff2c6, Math.max(0, a));
      this.halo.fillCircle(x, y, rr);
    }
  }

  private startHaloPulse(): void {
    try {
      this.haloTween?.stop();
    } catch {}
    this.haloTween = this.tweens.add({
      targets: this.halo,
      alpha: { from: 0.55, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private tryTravelSelected(): void {
    const n = this.nodes[this.selectedIndex];
    if (!n) return;
    if (!n.def.unlocked()) return;
    this.scene.start(n.def.scene);
  }

  override update(): void {
    if (!this.keys) return;

    const left =
      Phaser.Input.Keyboard.JustDown(this.keys.left) || Phaser.Input.Keyboard.JustDown(this.keys.q);
    const right =
      Phaser.Input.Keyboard.JustDown(this.keys.right) || Phaser.Input.Keyboard.JustDown(this.keys.d);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keys.space);

    const selectable = this.selectableIndices();
    if (selectable.length) {
      const pos = selectable.indexOf(this.selectedIndex);
      const curPos = pos >= 0 ? pos : 0;

      if (left) {
        const nextPos = Phaser.Math.Wrap(curPos - 1, 0, selectable.length);
        this.setSelectedIndex(selectable[nextPos]!);
      } else if (right) {
        const nextPos = Phaser.Math.Wrap(curPos + 1, 0, selectable.length);
        this.setSelectedIndex(selectable[nextPos]!);
      }
    }

    if (confirm) {
      this.tryTravelSelected();
    }
  }
}

