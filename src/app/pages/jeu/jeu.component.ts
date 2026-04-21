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
import {
  GAME_TOUCH_OVERLAY_BLOCK_EVENT,
  GAME_TOUCH_OVERLAY_UNBLOCK_EVENT,
  resetGameModalTouchOverlayBlockDepth,
} from 'src/game/core/modal-touch-overlay-bridge';
import { gameState, isPlayerArchetype, REMOTE_PROGRESS_PLAYER_KEY, type ActId } from 'src/game/core/game-state';
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
  /** Masque les contrôles tactiles Angular pendant dialogue / formulaire Phaser. */
  readonly gameModalBlocksTouchOverlay = signal(false);
  /** Acte courant (Phaser `gameState.setAct`) — l’acte 3 n’affiche pas le pad directionnel / Parler. */
  readonly currentAct = signal<ActId>(gameState.snapshot.act);

  private game: import('phaser').Game | null = null;
  private hostResizeObserver: ResizeObserver | null = null;
  private resizeHandler = () => {
    this.computeOrientation();
    this.refreshPhaserScale();
  };
  readonly hasSave = signal(false);
  private userInteracted = false;
  private mapEventHandler = () => {
    this.refreshProgress();
    this.mapUnlocked.set(true);
    this.showMap.set(true);
  };

  private touchOverlayBlockHandler = () => {
    this.gameModalBlocksTouchOverlay.set(true);
    resetVirtualInputState();
  };

  private touchOverlayUnblockHandler = () => {
    this.gameModalBlocksTouchOverlay.set(false);
  };

  private actChangedHandler = (e: Event) => {
    const d = (e as CustomEvent<{ act: ActId }>).detail;
    if (d?.act) this.currentAct.set(d.act);
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
    window.addEventListener(GAME_TOUCH_OVERLAY_BLOCK_EVENT, this.touchOverlayBlockHandler as any);
    window.addEventListener(GAME_TOUCH_OVERLAY_UNBLOCK_EVENT, this.touchOverlayUnblockHandler as any);
    window.addEventListener('fp-game-act-changed', this.actChangedHandler);
    // Démarrer Phaser tout de suite pour que les clics sur "Commencer" /
    // "Recommencer" puissent agir immédiatement, sans attendre le réseau.
    void this.bootstrapGame();
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

  /**
   * Crée le jeu Phaser immédiatement, puis charge la sauvegarde + progression serveur
   * en arrière-plan. Cela évite qu'un clic rapide sur "Commencer/Recommencer"
   * se produise alors que `this.game` est encore nul.
   */
  private async bootstrapGame(): Promise<void> {
    // Créer le jeu en premier : synchronisé avec le DOM, sans attendre le réseau.
    if (!this.game) {
      this.game = createGame(this.gameHost.nativeElement);
      this.attachHostResizeObserver();
      // La topbar ajuste `--topstrip-offset` après layout/fonts sans forcément déclencher `resize`.
      // On force un recalcul Phaser sur les prochains frames.
      requestAnimationFrame(() => this.refreshPhaserScale());
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.refreshPhaserScale());
      });
    }

    try {
      gameState.load();
    } catch {}
    this.syncProgressSignalsFromGameState();
    try {
      const remote = await gameBackend.getGameProgressForSelected();
      this.applyRemoteGameProgress(remote);
      this.syncProgressSignalsFromGameState();
      requestAnimationFrame(() => this.refreshPhaserScale());
    } catch {}
  }

  private applyRemoteGameProgress(remote: Record<string, unknown>): void {
    if (!remote || typeof remote !== 'object') return;
    for (const [k, v] of Object.entries(remote)) {
      if (k === REMOTE_PROGRESS_PLAYER_KEY && typeof v === 'string' && isPlayerArchetype(v)) {
        if (!gameState.snapshot.player) gameState.setPlayer(v);
        continue;
      }
      if (v === true) gameState.setFlag(k, true);
    }
  }

  private syncProgressSignalsFromGameState(): void {
    const flags = (gameState.snapshot.flags || {}) as Record<string, boolean>;
    this.progressFlags.set({ ...flags });
    this.mapUnlocked.set(flags['hub.map_unlocked'] === true);
    this.hasSave.set(gameState.hasSave());
    this.currentAct.set(gameState.snapshot.act);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('fp-game-show-map', this.mapEventHandler as any);
    window.removeEventListener('fp-game-progress-updated', this.progressUpdatedHandler as any);
    window.removeEventListener(GAME_TOUCH_OVERLAY_BLOCK_EVENT, this.touchOverlayBlockHandler as any);
    window.removeEventListener(GAME_TOUCH_OVERLAY_UNBLOCK_EVENT, this.touchOverlayUnblockHandler as any);
    window.removeEventListener('fp-game-act-changed', this.actChangedHandler);
    resetGameModalTouchOverlayBlockDepth();
    this.gameModalBlocksTouchOverlay.set(false);
    resetVirtualInputState();
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
    this.detachHostResizeObserver();
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
    requestAnimationFrame(() => this.refreshPhaserScale());
  }

  restartGame(): void {
    gameState.reset();
    this.currentAct.set(gameState.snapshot.act);
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
    requestAnimationFrame(() => this.refreshPhaserScale());
  }

  toggleControls(): void {
    this.showControls.set(!this.showControls());
    if (!this.showControls()) {
      resetVirtualInputState();
    }
  }

  toggleMap(): void {
    this.refreshProgress();
    if (this.currentAct() === 'hub') {
      // Sur la carte du domaine, l'UI Angular est masquée : le bouton renvoie vers Phaser.
      this.showMap.set(false);
      resetVirtualInputState();
      try {
        this.game?.scene.start('HubOpenWorldScene');
      } catch {}
      requestAnimationFrame(() => this.refreshPhaserScale());
      return;
    }
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

  mapHubUnlocked(): boolean {
    return this.isDone('hub.map_unlocked');
  }

  mapAct1Locked(): boolean {
    return !this.isDone('act0.intro_seen');
  }

  mapAct2Locked(): boolean {
    return !this.isDone('act1.register_done');
  }

  mapAct3Locked(): boolean {
    return !this.isDone('act2.allergens_done');
  }

  mapAct4Locked(): boolean {
    return !this.isDone('act3.avatar_done');
  }

  mapAct5Locked(): boolean {
    return !this.isDone('act3.avatar_done');
  }

  mapAct6Locked(): boolean {
    return !this.isDone('act3.avatar_done');
  }

  mapAct7Locked(): boolean {
    return !this.allStepsDone();
  }

  /** Règles détaillées : docs/Scénario.md (section « Progression technique »). */
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
    this.syncProgressSignalsFromGameState();

    try {
      void gameBackend.getGameProgressForSelected().then((remote) => {
        this.applyRemoteGameProgress(remote);
        this.syncProgressSignalsFromGameState();
      });
    } catch {}
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.fullscreenAvailable()) return;
    // Fullscreen sur le conteneur complet, pour garder l'UI overlay visible.
    const el = this.gameShell?.nativeElement ?? this.gameHost?.nativeElement;
    if (!document.fullscreenElement && el?.requestFullscreen) {
      await el.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    requestAnimationFrame(() => this.refreshPhaserScale());
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

    this.refreshPhaserScale();
  }

  private attachHostResizeObserver(): void {
    this.detachHostResizeObserver();
    if (typeof ResizeObserver === 'undefined') return;
    // Observer le shell plutôt que le host : la topbar / le layout peuvent
    // décaler le contenu sans changer la bbox du host (height en vh fixe).
    const el = this.gameShell?.nativeElement ?? this.gameHost?.nativeElement;
    if (!el) return;

    this.hostResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.refreshPhaserScale());
    });
    try {
      this.hostResizeObserver.observe(el);
    } catch {
      this.hostResizeObserver.disconnect();
      this.hostResizeObserver = null;
    }
  }

  private detachHostResizeObserver(): void {
    try {
      this.hostResizeObserver?.disconnect();
    } catch {
      // ignore
    }
    this.hostResizeObserver = null;
  }

  private refreshPhaserScale(): void {
    const game = this.game;
    if (!game) return;
    try {
      // Phaser FIT dépend de la taille parent au boot; un relayout (topbar, sidenav, fonts)
      // peut changer la bbox sans `window.resize`.
      game.scale.refresh();
    } catch {
      // ignore
    }
  }
}
