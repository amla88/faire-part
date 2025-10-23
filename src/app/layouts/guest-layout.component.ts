import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  standalone: true,
  selector: 'app-guest-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav #sidenav class="sidenav" mode="side" opened="true">
        <nav mat-nav-list class="nav-list">
          <a mat-list-item *ngFor="let item of navItems" [routerLink]="item.route" routerLinkActive="active">
            <mat-icon matListIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        </nav>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container {
      height: calc(100vh - 64px);
      display: flex;
    }

    .sidenav {
      width: 250px;
      border-right: 1px solid rgba(0, 0, 0, 0.12);
    }

    .nav-list {
      padding: 0;
    }

    ::ng-deep .nav-list .mdc-list-item {
      border-left: 3px solid transparent;
      transition: all 0.3s ease;
    }

    ::ng-deep .nav-list .mdc-list-item.active {
      background-color: rgba(63, 81, 181, 0.1);
      border-left-color: #3f51b5;
    }

    .content {
      flex: 1;
      padding: 16px;
      overflow: auto;
    }

    @media (max-width: 768px) {
      .sidenav {
        width: 200px;
      }

      .content {
        padding: 12px;
      }
    }
  `]
})
export class GuestLayoutComponent {
  navItems: NavItem[] = [
    { label: 'Lancer le jeu', route: '/game', icon: 'sports_esports' },
    { label: 'Changer de personne', route: '/person', icon: 'switch_account' },
    { label: 'Éditer mon avatar', route: '/avatar', icon: 'face' },
    { label: 'Proposer des musiques', route: '/music', icon: 'library_music' },
    { label: 'Envoyer une photo', route: '/photos/upload', icon: 'cloud_upload' },
    { label: 'Galerie photos', route: '/photos', icon: 'photo_library' },
    { label: 'RSVP', route: '/rsvp', icon: 'done_all' }
  ];
}
