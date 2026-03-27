import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { createGame } from 'src/game/core/create-game';
import { resetVirtualInputState, virtualInputState } from 'src/game/core/input-state';
import { gameState } from 'src/game/core/game-state';

@Component({
  selector: 'app-jeu',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './jeu.component.html',
  styleUrls: ['./jeu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JeuComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameHost', { static: true }) gameHost!: ElementRef<HTMLDivElement>;
  @ViewChild('gameShell', { static: true }) gameShell!: ElementRef<HTMLDivElement>;

  readonly showControls = signal(true);
  readonly showIntro = signal(true);
  readonly isPortrait = signal(false);
  readonly fullscreenAvailable = signal(
    typeof document !== 'undefined' && !!document.fullscreenEnabled
  );

  private game: import('phaser').Game | null = null;
  private resizeHandler = () => this.computeOrientation();
  readonly hasSave = signal(false);
  private userInteracted = false;

  ngAfterViewInit(): void {
    this.computeOrientation();
    window.addEventListener('resize', this.resizeHandler);
    this.hasSave.set(gameState.hasSave());
    this.game = createGame(this.gameHost.nativeElement);
    // Certains navigateurs n'autorisent le fullscreen qu'après un geste utilisateur.
    // On mémorise le premier pointerdown dans la zone du jeu.
    try {
      this.gameShell.nativeElement.addEventListener(
        'pointerdown',
        () => {
          this.userInteracted = true;
        },
        { passive: true }
      );
    } catch {}
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    resetVirtualInputState();
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }

  startGame(): void {
    // "Nouvelle partie" doit réellement démarrer une run fraîche.
    this.restartGame();
  }

  resumeGame(): void {
    this.showIntro.set(false);
    try {
      // relancer le boot pour reprendre à l'acte sauvegardé
      this.game?.scene.start('BootScene');
    } catch {}
  }

  restartGame(): void {
    gameState.reset();
    this.hasSave.set(false);
    this.showIntro.set(false);
    resetVirtualInputState();
    try {
      const game = this.game;
      if (!game) return;

      // Stopper toutes les scènes actives (sinon on peut rester sur l'acte courant en pratique)
      const activeScenes = game.scene.getScenes(true);
      for (const s of activeScenes) {
        try {
          game.scene.stop(s.scene.key);
        } catch {
          // ignore
        }
      }

      // Redémarrer depuis l'acte 0
      game.scene.start('Act0CarrosseScene');
    } catch {}
  }

  toggleControls(): void {
    this.showControls.set(!this.showControls());
    if (!this.showControls()) {
      resetVirtualInputState();
    }
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.fullscreenAvailable()) return;
    // Fullscreen sur le conteneur complet, pour garder l'UI overlay visible.
    const el = this.gameShell?.nativeElement ?? this.gameHost?.nativeElement;
    if (!document.fullscreenElement && el?.requestFullscreen) {
      await el.requestFullscreen();
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }

  pressDir(dir: 'up' | 'down' | 'left' | 'right', pressed: boolean): void {
    virtualInputState[dir] = pressed;
  }

  pressInteract(pressed: boolean): void {
    virtualInputState.interact = pressed;
  }

  pressConfirm(pressed: boolean): void {
    virtualInputState.confirm = pressed;
  }

  private computeOrientation(): void {
    const wasPortrait = this.isPortrait();
    const nowPortrait = window.innerHeight > window.innerWidth;
    this.isPortrait.set(nowPortrait);

    // Quand on repasse en paysage, tenter le fullscreen automatiquement.
    if (wasPortrait && !nowPortrait && this.userInteracted) {
      try {
        void this.toggleFullscreen();
      } catch {}
    }
  }
}

