import Phaser from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../core/game-colors';
import { gameState } from '../core/game-state';
import { gameBackend } from '../services/GameBackendBridge';

export class Act7FinalGazetteScene extends Phaser.Scene {
  private countdownText!: Phaser.GameObjects.Text;
  private thanksText!: Phaser.GameObjects.Text;
  private target: Date | null = null;

  constructor() {
    super('Act7FinalGazetteScene');
  }

  create(): void {
    gameState.setAct('act7');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(18, 14, 'ACTE 7 — La Gazette', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    const title = this.add.text(width / 2, height * 0.33, 'La Gazette', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#2c2433',
      align: 'center',
    });
    title.setOrigin(0.5);

    this.add.text(
      width / 2,
      height * 0.45,
      "Très chers lecteurs,\nles cuisines sont alertées, les musiciens accordés…\nTout est prêt pour l’union la plus attendue de l’année.",
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#2c2433',
        align: 'center',
        lineSpacing: 6,
      }
    ).setOrigin(0.5);

    this.thanksText = this.add.text(width / 2, height * 0.58, 'Merci…', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
      align: 'center',
      lineSpacing: 5,
    });
    this.thanksText.setOrigin(0.5);

    this.countdownText = this.add.text(width / 2, height * 0.68, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#2c2433',
      align: 'center',
    }).setOrigin(0.5);

    this.target = this.resolveTargetDate();
    this.renderCountdown();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.renderCountdown(),
    });

    // Remerciements personnalisés (best-effort)
    this.loadThanks();
  }

  private loadThanks(): void {
    try {
      void gameBackend.getSelectedPersonneRow().then((row) => {
        const prenom = String(row?.prenom || '').trim();
        const nom = String(row?.nom || '').trim();
        const who = (prenom || nom) ? `${prenom} ${nom}`.trim() : 'cher invité';
        this.thanksText.setText(
          `Merci, ${who}.\nVos réponses sont consignées.\nLa carte demeure à votre disposition — au besoin, revenez ajuster un détail.`
        );
      });
    } catch {
      // ignore
    }
  }

  private resolveTargetDate(): Date | null {
    // Optionnel: <meta name="wedding-date-iso" content="2026-08-30T14:00:00+02:00">
    const raw = document.querySelector('meta[name="wedding-date-iso"]')?.getAttribute('content') || '';
    const v = raw.trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private renderCountdown(): void {
    if (!this.countdownText) return;
    if (!this.target) {
      this.countdownText.setText("Compte à rebours: date à définir (meta 'wedding-date-iso').");
      return;
    }

    const ms = this.target.getTime() - Date.now();
    if (ms <= 0) {
      this.countdownText.setText('C’est aujourd’hui.');
      return;
    }

    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    this.countdownText.setText(`Compte à rebours\n${days}j ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`);
  }
}

