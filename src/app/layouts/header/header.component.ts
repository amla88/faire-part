import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material.module';
import { Router } from '@angular/router';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="toggleMobileNav.emit()" *ngIf="showToggle">
        <mat-icon>menu</mat-icon>
      </button>
      <span class="spacer"></span>
      <span class="user-info">{{ session.getSelectedPersonne()?.prenom }}</span>
      <button mat-icon-button [matMenuTriggerFor]="menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="changePerson()">
          <mat-icon>people</mat-icon>
          <span>Changer de personne</span>
        </button>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Se déconnecter</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .spacer {
      flex: 1 1 auto;
    }
    .user-info {
      margin-right: 12px;
      font-size: 14px;
    }
  `]
})
export class HeaderComponent {
  @Input() showToggle = false;
  @Output() toggleMobileNav = new EventEmitter<void>();

  constructor(
    public session: SessionService,
    private router: Router
  ) {}

  changePerson() {
    this.router.navigate(['/person']);
  }

  logout() {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}

