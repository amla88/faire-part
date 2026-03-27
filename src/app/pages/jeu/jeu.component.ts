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
import { gameBackend } from 'src/game/services/GameBackendBridge';

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
  readonly showMap = signal(false);
  readonly mapUnlocked = signal(false);
  readonly progressFlags = signal<Record<string, boolean>>({});

  private game: import('phaser').Game | null = null;
  private resizeHandler = () => this.computeOrientation();
  readonly hasSave = signal(false);
  private userInteracted = false;
  private mapEventHandler = () => {
    this.refreshProgress();
    this.mapUnlocked.set(true);
    this.showMap.set(true);
  };
  private progressUpdatedHandler = () => {
    this.refreshProgress();
    // Si tout est validé, basculer automatiquement vers le final.
    if (this.allStepsDone() && !this.isDone('final.seen')) {
      this.goTo('Act7FinalGazetteScene');
      // Marquer vu côté save locale.
      try {
        gameState.setFlag('final.seen', true);
      } catch {}
      this.refreshProgress();
    }
  };

  ngAfterViewInit(): void {
    this.computeOrientation();
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('fp-game-show-map', this.mapEventHandler as any);
    window.addEventListener('fp-game-progress-updated', this.progressUpdatedHandler as any);
    this.hasSave.set(gameState.hasSave());
    this.refreshProgress();
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
    window.removeEventListener('fp-game-show-map', this.mapEventHandler as any);
    window.removeEventListener('fp-game-progress-updated', this.progressUpdatedHandler as any);
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
    try {
      void gameBackend.resetGameProgressForSelected();
    } catch {}
    this.hasSave.set(false);
    this.showIntro.set(false);
    this.showMap.set(false);
    this.mapUnlocked.set(false);
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

  toggleMap(): void {
    this.refreshProgress();
    this.showMap.set(!this.showMap());
    if (!this.showMap()) resetVirtualInputState();
  }

  goTo(sceneKey: string): void {
    try {
      this.game?.scene.start(sceneKey);
    } catch {}
    // Fermer la carte après déplacement (UX).
    this.showMap.set(false);
    resetVirtualInputState();
  }

  isDone(flagKey: string): boolean {
    return this.progressFlags()?.[flagKey] === true;
  }

  allStepsDone(): boolean {
    // Étapes "validées" attendues pour déclencher le final.
    return (
      this.isDone('act1.register_done') &&
      this.isDone('act2.allergens_done') &&
      this.isDone('act3.avatar_done') &&
      (this.isDone('act4.anecdote_done') || this.isDone('act4.photo_done')) &&
      this.isDone('act5.idea_done') &&
      this.isDone('act6.music_done')
    );
  }

  private refreshProgress(): void {
    try {
      gameState.load();
    } catch {}
    const flags = (gameState.snapshot.flags || {}) as Record<string, boolean>;
    this.progressFlags.set({ ...flags });
    this.mapUnlocked.set(flags['hub.map_unlocked'] === true);

    // Best-effort: recharger la progression server et la refléter en local.
    try {
      void gameBackend.getGameProgressForSelected().then((remote) => {
        if (!remote || typeof remote !== 'object') return;
        for (const [k, v] of Object.entries(remote)) {
          if (v === true) gameState.setFlag(k, true);
        }
        const merged = (gameState.snapshot.flags || {}) as Record<string, boolean>;
        this.progressFlags.set({ ...merged });
        this.mapUnlocked.set(merged['hub.map_unlocked'] === true);
      });
    } catch {}
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

