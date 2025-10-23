import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MaterialModule } from '../../shared/material.module';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent, NavItem } from '../sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { filter } from 'rxjs/operators';

const GUEST_NAV_ITEMS: NavItem[] = [
  { displayName: 'Sélecteur', route: '/person', icon: 'people' },
  { displayName: 'Jeu', route: '/game', icon: 'games' },
  { displayName: 'Avatar', route: '/avatar', icon: 'person' },
  { displayName: 'RSVP', route: '/rsvp', icon: 'event' },
  { displayName: 'Musiques', route: '/music', icon: 'music_note' },
  { displayName: 'Photos', route: '/photos', icon: 'photo' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { displayName: 'Tableau de Bord', route: '/admin', icon: 'dashboard' },
  { displayName: 'Assets Avatar', route: '/admin/assets', icon: 'imagesearch_roller' },
  { displayName: 'Modération Musiques', route: '/admin/music', icon: 'music_note' },
  { displayName: 'Modération Photos', route: '/admin/photos', icon: 'photo' },
];

@Component({
  selector: 'app-full-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    HeaderComponent,
    SidebarComponent,
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav 
        #sidenav 
        [mode]="isOver ? 'over' : 'side'"
        [opened]="!isOver"
        [fixedInViewport]="isOver"
        fixedTopGap="56"
      >
        <app-sidebar 
          [navItems]="navItems" 
          [showToggle]="isOver"
          (toggleMobileNav)="sidenav.toggle()"
        ></app-sidebar>
      </mat-sidenav>

      <mat-sidenav-content>
        <app-header 
          [showToggle]="!isOver"
          (toggleMobileNav)="sidenav.toggle()"
        ></app-header>

        <main class="main-content">
          <router-outlet></router-outlet>
        </main>

        <footer class="footer text-center p-4">
          <p>&copy; 2025 Faire-part de Mariage</p>
        </footer>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container {
      height: 100vh;
    }
    mat-sidenav {
      width: 250px;
    }
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .footer {
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      background-color: #f5f5f5;
      margin-top: auto;
    }
    .text-center {
      text-align: center;
    }
    .p-4 {
      padding: 16px;
    }
  `]
})
export class FullLayoutComponent implements OnInit {
  @ViewChild('sidenav') sidenav?: MatSidenav;
  
  navItems: NavItem[] = GUEST_NAV_ITEMS;
  isOver = false;
  isAdmin = false;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private router: Router,
    private session: SessionService
  ) {}

  ngOnInit() {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe(result => {
        this.isOver = result.matches;
      });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateNavItems();
      });
  }

  private updateNavItems() {
    const url = this.router.url;
    this.isAdmin = url.startsWith('/admin');
    this.navItems = this.isAdmin ? ADMIN_NAV_ITEMS : GUEST_NAV_ITEMS;
  }
}

