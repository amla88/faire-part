import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';
import { gameState } from '../core/game-state';
import { DialogueBox } from '../ui/DialogueBox';
import { AvatarEditorBox } from '../ui/AvatarEditorBox';
import { getDialogue } from '../data/dialogues.catalog';
import {
  MODISTE_TEXTURE_KEY,
  playModisteEmoteDownOnce,
  setModisteIdleFrame,
} from '../data/act3-modiste';
import {
  LPC_PLAYER_IDLE_FIRST_FRAMES,
  type LpcFacing,
  playLpcPlayerIdle,
  resolveLpcPlayerTextureKey,
} from '../data/lpc-garcon';

const ACT3_TILE_SCALE = 2;
const ACT3_PLAYER_POS = { xFrac: 0.5, yFrac: 0.9 } as const;
/** PNJ : côté gauche, même bande verticale que le joueur. */
const ACT3_MODISTE_POS = { xFrac: 0.25, yFrac: 0.5 } as const;

const ACT3_UI_DEPTH = 100_000;

/** Portrait « plein cadre » avant l’éditeur (`portrait-modiste-grand.png`) : hauteur 90 % du canvas. */
function portraitModisteGrandDisplaySize(scene: Phaser.Scene): { width: number; height: number } {
  const h = Math.floor(scene.scale.height * 0.9);
  if (!scene.textures.exists('portrait-modiste-grand')) {
    return { width: Math.floor(h * 0.75), height: h };
  }
  const tex = scene.textures.get('portrait-modiste-grand');
  const src = tex.getSourceImage() as HTMLImageElement | undefined;
  const nw = src?.naturalWidth ?? tex.source[0].width;
  const nh = src?.naturalHeight ?? tex.source[0].height;
  const w = Math.max(80, Math.floor((nw / nh) * h));
  return { width: w, height: h };
}

export class Act3GrangeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private info!: Phaser.GameObjects.Text;
  private actTitle!: Phaser.GameObjects.Text;
  private dialogueBox!: DialogueBox;
  private avatarEditorBox!: AvatarEditorBox;
  private opening = false;
  private player!: Phaser.GameObjects.Sprite;
  private modiste?: Phaser.GameObjects.Sprite;
  private playerFacing: LpcFacing = 'up';
  /** Séquence PNJ (gauche → bas → emote) terminée ; le dialogue peut s’afficher. */
  private introSequenceComplete = false;

  constructor() {
    super('Act3GrangeScene');
  }

  create(): void {
    gameState.setAct('act3');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.add
      .image(width / 2, height / 2, 'acte3-grange')
      .setDisplaySize(width, height)
      .setDepth(-200);

    const playerTex = resolveLpcPlayerTextureKey(gameState.snapshot.player);
    this.player = this.add
      .sprite(width * ACT3_PLAYER_POS.xFrac, height * ACT3_PLAYER_POS.yFrac, playerTex, LPC_PLAYER_IDLE_FIRST_FRAMES.up)
      .setScale(ACT3_TILE_SCALE);
    playLpcPlayerIdle(this, this.player, this.playerFacing);

    this.actTitle = this.add.text(18, 14, 'ACTE 3 — La Grande Grange', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f4dfbf',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.avatarEditorBox = new AvatarEditorBox(this);
    this.info = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#2c2433',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(ACT3_UI_DEPTH);

    if (quests.isDone(QuestFlags.act3AvatarDone)) {
      this.introSequenceComplete = true;
      this.info.setText('Acte 3 déjà validé. Merci !');
      return;
    }

    this.modiste = this.add
      .sprite(width * ACT3_MODISTE_POS.xFrac, height * ACT3_MODISTE_POS.yFrac, MODISTE_TEXTURE_KEY, 0)
      .setScale(ACT3_TILE_SCALE);
    setModisteIdleFrame(this.modiste, 'left');

    this.info.setVisible(false);
    this.runAct3IntroSequence();
  }

  private sceneHudForDialogue(): Phaser.GameObjects.GameObject[] {
    const list: Phaser.GameObjects.GameObject[] = [this.player, this.info, this.actTitle];
    if (this.modiste) list.push(this.modiste);
    return list;
  }

  /** PNJ : gauche → 1,5 s → bas → 1 s → emote (2× vitesse) → 1,5 s sur dernière frame → dialogue. */
  private runAct3IntroSequence(): void {
    this.time.delayedCall(1500, () => {
      if (!this.modiste?.active) return;
      setModisteIdleFrame(this.modiste, 'down');
    });
    this.time.delayedCall(2500, () => {
      if (!this.modiste?.active) return;
      playModisteEmoteDownOnce(
        this.modiste,
        () => {
          this.introSequenceComplete = true;
          this.startChromatiqueDialogue();
        },
        1500,
      );
    });
  }

  private startChromatiqueDialogue(): void {
    if (this.dialogueBox.active || this.avatarEditorBox.active || this.opening) return;
    const portraitSize = portraitModisteGrandDisplaySize(this);
    this.dialogueBox.start(
      {
        steps: [
          {
            speaker: 'Madame Chromatique',
            portraitTexture: 'portrait-modiste-grand',
            portraitDisplaySize: portraitSize,
            text:
              "Quelle silhouette charmante… mais il lui manque ce je-ne-sais-quoi numérique ! Approchez : votre portrait doit être aussi mémorable qu’une rumeur.",
          },
        ],
      },
      () => {
        this.beginAvatarEditorFlow();
      },
      { hideSceneHud: this.sceneHudForDialogue() },
    );
  }

  private beginAvatarEditorFlow(): void {
    if (this.opening) return;
    this.opening = true;
    this.info.setText('Préparation du miroir…');
    this.info.setVisible(true);
    gameBackend
      .getAvatarForSelected()
      .then((avatarRow) => {
        this.info.setText('');
        void this.openPhaserAvatarEditor(avatarRow).then((saved) => {
          this.opening = false;
          if (!saved) {
            this.info.setText('Appuyez sur Espace / Valider pour reprendre le miroir.');
            this.info.setVisible(true);
            return;
          }
          quests.done(QuestFlags.act3AvatarDone);
          quests.done(QuestFlags.hubMapUnlocked);
          try {
            void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
          } catch {}
          this.info.setText('Acte 3 validé.');
          this.info.setVisible(true);
          this.dialogueBox.start(
            getDialogue('act3.mapUnlock'),
            () => {
              try {
                window.dispatchEvent(new CustomEvent('fp-game-show-map'));
              } catch {}
              try {
                gameState.setAct('hub');
                this.scene.start('HubOpenWorldScene');
              } catch {
                // Si la scène hub n'existe pas encore, on reste ici.
              }
            },
            {
              hideSceneHud: [this.info, this.player, this.actTitle, ...(this.modiste ? [this.modiste] : [])],
            },
          );
        });
      })
      .catch((e) => {
        this.opening = false;
        this.info.setText('Erreur: ' + String(e?.message || e));
        this.info.setVisible(true);
      });
  }

  /**
   * Les sprites de scène sont créés après les Graphics de l’éditeur : sans masquage, ils restent au-dessus.
   * On cache le HUD scène pendant l’éditeur et on restaure la visibilité d’origine à la fermeture.
   */
  private openPhaserAvatarEditor(initial: { seed?: string; options?: unknown } | null): Promise<boolean> {
    type VisibleGo = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;
    const hud: VisibleGo[] = [this.player, this.actTitle, this.info, ...(this.modiste ? [this.modiste] : [])];
    const visibilitySnap = hud.map((o) => ({ o, wasVisible: o.visible }));
    for (const o of hud) o.setVisible(false);

    return new Promise<boolean>((resolve) => {
      this.avatarEditorBox.start({
        initial,
        onClose: (saved) => {
          for (const s of visibilitySnap) {
            try {
              s.o.setVisible(s.wasVisible);
            } catch {
              // objet détruit avec la scène
            }
          }
          resolve(saved);
        },
      });
    });
  }

  override update(): void {
    const act = this.inputState.actionJustDown();

    if (this.avatarEditorBox.active) {
      this.inputState.commit();
      return;
    }

    if (this.dialogueBox.active) {
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (quests.isDone(QuestFlags.act3AvatarDone)) {
      this.inputState.commit();
      return;
    }

    if (!this.introSequenceComplete) {
      this.inputState.commit();
      return;
    }

    if (act && !this.opening) {
      this.startChromatiqueDialogue();
    }

    this.inputState.commit();
  }
}
