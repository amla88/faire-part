import { AfterViewInit, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../services/session.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ElementRef, ViewChild, OnDestroy } from '@angular/core';
import Phaser from 'phaser';
import MainScene from './phaser/MainScene';

@Component({
  standalone: true,
  selector: 'app-game',
  imports: [CommonModule, RouterModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  status: string | null = 'Initialisation…';
  private game: Phaser.Game | null = null;

  constructor(private session: SessionService) {}

  async ngAfterViewInit() {
    await this.session.init();
    if (this.session.error) { this.status = this.session.error; return; }
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      pixelArt: true,
      width: 360,
      height: 240,
      backgroundColor: '#10141f',
      parent: this.host.nativeElement,
      scene: [MainScene as any],
      dom: { createContainer: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { x:0, y:0 }, debug: false } },
    };
    this.status = 'Chargement du jeu…';
    this.game = new Phaser.Game(config);
    setTimeout(() => { this.status = null; }, 50);
  }

  ngOnDestroy() {
    if (this.game) { try { this.game.destroy(true); } catch {} this.game = null; }
  }
}
