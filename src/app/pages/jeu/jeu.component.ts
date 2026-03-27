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

  readonly showControls = signal(true);
  readonly showIntro = signal(true);
  readonly isPortrait = signal(false);
  readonly fullscreenAvailable = signal(
    typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  );

  private game: import('phaser').Game | null = null;
  private resizeHandler = () => this.computeOrientation();

  ngAfterViewInit(): void {
    this.computeOrientation();
    window.addEventListener('resize', this.resizeHandler);
    this.game = createGame(this.gameHost.nativeElement);
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
    this.showIntro.set(false);
  }

  toggleControls(): void {
    this.showControls.set(!this.showControls());
    if (!this.showControls()) {
      resetVirtualInputState();
    }
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.fullscreenAvailable()) return;
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  pressDir(dir: 'up' | 'down' | 'left' | 'right', pressed: boolean): void {
    virtualInputState[dir] = pressed;
  }

  private computeOrientation(): void {
    this.isPortrait.set(window.innerHeight > window.innerWidth);
  }
}

