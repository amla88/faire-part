import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { COUNTDOWN_DEADLINE_LOCAL, isCountdownWindowActive } from 'src/app/services/countdown-window';

type Remaining = { totalMs: number; days: number; hours: number; minutes: number; seconds: number };

function computeRemaining(now: Date): Remaining {
  const totalMs = Math.max(0, COUNTDOWN_DEADLINE_LOCAL.getTime() - now.getTime());
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { totalMs, days, hours, minutes, seconds };
}

@Component({
  selector: 'app-decompte',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  template: `
    <div class="bg">
      <div class="wrap">
        <div class="hero">
          <div class="badge">Accès temporairement restreint</div>
          <h1>Vous pourrez vous enregistrer à partir de samedi 12h00</h1>
          <p class="sub">
            Désolé pour le retard, mais mes journées ne font malheureusement que 24h...
          </p>

          <div class="grid" aria-label="Compte à rebours">
            <div class="tile">
              <div class="num">{{ remaining.days }}</div>
              <div class="lab">jours</div>
            </div>
            <div class="tile">
              <div class="num">{{ remaining.hours }}</div>
              <div class="lab">heures</div>
            </div>
            <div class="tile">
              <div class="num">{{ remaining.minutes }}</div>
              <div class="lab">minutes</div>
            </div>
            <div class="tile">
              <div class="num">{{ remaining.seconds }}</div>
              <div class="lab">secondes</div>
            </div>
          </div>

          <div class="fine">
            <span>Le site refonctionnera automatiquement à l’heure indiquée. (Pour de vrais!)</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .bg {
        min-height: 100vh;
        position: relative;
        overflow: hidden;
        background: radial-gradient(900px 520px at 15% 10%, rgba(138, 243, 154, 0.18), transparent 60%),
          radial-gradient(800px 520px at 90% 30%, rgba(68, 136, 255, 0.20), transparent 55%),
          linear-gradient(180deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.45));
      }
      .bg::before {
        content: '';
        position: absolute;
        inset: -2px;
        background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        background-size: 14px 14px;
        opacity: 0.25;
        pointer-events: none;
        mask-image: radial-gradient(closest-side, rgba(0, 0, 0, 0.75), transparent);
      }
      .wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 28px 18px;
        position: relative;
        z-index: 1;
      }
      .hero {
        width: min(920px, 100%);
        border-radius: 22px;
        padding: 28px 22px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.10);
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(10px);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-size: 12px;
        color: rgba(244, 223, 191, 0.95);
        border: 1px solid rgba(244, 223, 191, 0.22);
        background: rgba(244, 223, 191, 0.06);
      }
      h1 {
        margin: 14px 0 10px;
        font-size: clamp(26px, 4.2vw, 44px);
        line-height: 1.08;
        letter-spacing: -0.02em;
        color: #f4dfbf;
      }
      .sub {
        margin: 0 0 18px;
        font-size: 14px;
        color: rgba(244, 223, 191, 0.82);
      }
      .grid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      .tile {
        border-radius: 12px;
        padding: 18px 12px;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.10);
        text-align: center;
      }
      .num {
        font-size: clamp(30px, 4.8vw, 52px);
        font-weight: 900;
        line-height: 1.1;
        color: #f4dfbf;
      }
      .lab {
        opacity: 0.8;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-top: 6px;
      }
      .fine {
        margin-top: 18px;
        font-size: 12px;
        opacity: 0.75;
        color: rgba(244, 223, 191, 0.8);
      }
      @media (max-width: 560px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .hero {
          padding: 22px 16px;
        }
      }
    `,
  ],
})
export class DecompteComponent implements OnInit, OnDestroy {
  remaining: Remaining = computeRemaining(new Date());
  private t?: number;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.tick();
    this.t = window.setInterval(() => this.tick(), 250);
  }

  ngOnDestroy(): void {
    if (this.t) window.clearInterval(this.t);
  }

  private tick(): void {
    const now = new Date();
    if (!isCountdownWindowActive(now)) {
      void this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    this.remaining = computeRemaining(now);
  }
}

