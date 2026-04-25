import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { gameBackend } from '../services/GameBackendBridge';
import { quests, QuestFlags } from '../systems/QuestSystem';

export class Act7FinalGazetteScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private panelBg?: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private introText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private thanksText!: Phaser.GameObjects.Text;
  private target: Date | null = null;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Act7FinalGazetteScene');
  }

  create(): void {
    gameState.setAct('act7');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);

    this.bg = this.add.image(0, 0, 'act7-gazette').setOrigin(0, 0).setDepth(-20);
    this.layoutBackground(width, height);
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      this.panelBg?.destroy();
      this.panelBg = undefined;
    });

    this.add.text(18, 14, 'ACTE 7 — La Gazette', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.titleText = this.add.text(0, 0, 'La Gazette', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#2c2433',
      align: 'center',
    });
    this.titleText.setOrigin(0.5);

    this.introText = this.add.text(
      0,
      0,
      "Très chers lecteurs,\nles cuisines sont alertées,\nles musiciens accordés…\nTout est prêt pour l’union\nla plus attendue de l’année.",
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#2c2433',
        align: 'center',
        lineSpacing: 6,
      }
    );
    this.introText.setOrigin(0.5);

    this.thanksText = this.add.text(0, 0, 'Merci…', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
      align: 'center',
      lineSpacing: 5,
    });
    this.thanksText.setOrigin(0.5);

    this.countdownText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#2c2433',
      align: 'center',
    }).setOrigin(0.5);

    this.applyPanelLayout(width, height);

    this.target = this.resolveTargetDate();
    this.renderCountdown();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.renderCountdown(),
    });

    // Remerciements personnalisés (best-effort)
    this.loadThanks();

    // Marque le final comme “vu” pour la progression / hub (best-effort).
    try {
      quests.done(QuestFlags.finalSeen);
      void gameBackend.upsertGameProgressForSelected(gameState.snapshot.flags);
    } catch {}

    const kb = this.input.keyboard;
    if (kb) {
      this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }
  }

  private onResize = (gameSize: Phaser.Structs.Size): void => {
    this.layoutBackground(gameSize.width, gameSize.height);
    this.applyPanelLayout(gameSize.width, gameSize.height);
  };

  /**
   * Mise en page du “panel” + textes.
   *
   * Pour repositionner correctement :
   * - bouge le panel : ajuste `PANEL_X_FRAC` / `PANEL_Y_FRAC`
   * - change sa taille : ajuste `PANEL_W_FRAC` / `PANEL_H_FRAC`
   *
   * Les textes suivent automatiquement le panel (offsets internes).
   */
  private applyPanelLayout(width: number, height: number): void {
    const PANEL_SHOW_BG = false;
    const PANEL_X_FRAC = 0.70;
    const PANEL_Y_FRAC = 0.48;
    const PANEL_W_FRAC = 0.30;
    const PANEL_H_FRAC = 0.72;

    const cx = width * PANEL_X_FRAC;
    const cy = height * PANEL_Y_FRAC;
    const pw = width * PANEL_W_FRAC;
    const ph = height * PANEL_H_FRAC;

    if (PANEL_SHOW_BG) {
      if (!this.panelBg || !this.panelBg.active) {
        this.panelBg?.destroy();
        this.panelBg = this.add
          .rectangle(cx, cy, pw, ph, 0x2563b8, 0.18)
          .setStrokeStyle(2, 0x6eb6ff, 0.35)
          .setDepth(-6);
      } else {
        this.panelBg.setPosition(cx, cy);
        this.panelBg.setSize(pw, ph);
      }
    } else {
      this.panelBg?.setVisible(false);
    }

    // Offsets internes au panel (fractions de sa hauteur).
    this.titleText.setPosition(cx, cy - ph * 0.40);
    this.introText.setPosition(cx, cy - ph * 0.19);
    this.thanksText.setPosition(cx, cy + ph * 0.12);
    this.countdownText.setPosition(cx, cy + ph * 0.40);
  }

  private layoutBackground(width: number, height: number): void {
    const tex = this.textures.get('act7-gazette').getSourceImage() as HTMLImageElement;
    const srcW = Math.max(1, tex?.width || 1);
    const srcH = Math.max(1, tex?.height || 1);
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setScale(scale);
    this.bg.setPosition((width - srcW * scale) / 2, (height - srcH * scale) / 2);
  }

  override update(): void {
    if (!this.keySpace) return;
    const back =
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keyEsc);
    if (!back) return;

    gameState.setAct('hub');
    this.scene.start('HubOpenWorldScene');
  }

  private loadThanks(): void {
    try {
      void gameBackend.getSelectedPersonneRow().then((row) => {
        const prenom = String(row?.prenom || '').trim();
        const nom = String(row?.nom || '').trim();
        const who = (prenom || nom) ? `${prenom} ${nom}`.trim() : 'cher invité';
        this.thanksText.setText(
          `Merci, ${who}.\nVos réponses sont consignées.\nLa carte demeure à votre disposition,\nrevenez ajuster un détail\nou utilisez le menu de gauche.`
        );
      });
    } catch {
      // ignore
    }
  }

  private resolveTargetDate(): Date | null {
    // Date cible fixe demandée : 12 septembre 2026 (midi heure FR pour éviter les effets DST/minuit).
    // Format ISO avec offset +02:00 (France en été).
    const fixed = new Date('2026-09-12T12:00:00+02:00');
    if (!Number.isNaN(fixed.getTime())) return fixed;
    return null;
  }

  private renderCountdown(): void {
    if (!this.countdownText) return;
    if (!this.target) {
      this.countdownText.setText('Compte à rebours: date à définir.');
      return;
    }

    const now = new Date();
    const target = this.target;
    if (target.getTime() - now.getTime() <= 0) {
      this.countdownText.setText('C’est aujourd’hui.');
      return;
    }

    // Diff “calendaire” en mois + jours + heures.
    // Méthode: on avance mois par mois depuis `now` jusqu'à dépasser `target`.
    const start = new Date(now.getTime());
    start.setMinutes(0, 0, 0);
    const end = new Date(target.getTime());
    end.setMinutes(0, 0, 0);

    let months = 0;
    const cursor = new Date(start.getTime());
    while (months < 1200) {
      const next = new Date(cursor.getTime());
      next.setMonth(next.getMonth() + 1);
      if (next.getTime() <= end.getTime()) {
        cursor.setTime(next.getTime());
        months += 1;
        continue;
      }
      break;
    }

    const remainingMs = Math.max(0, end.getTime() - cursor.getTime());
    const remainingHoursTotal = Math.floor(remainingMs / 3600000);
    const days = Math.floor(remainingHoursTotal / 24);
    const hours = remainingHoursTotal % 24;

    this.countdownText.setText(`Temps restant\navant le grand jour\n${months} mois\n${days} jours\n${hours} heures`);
  }
}

