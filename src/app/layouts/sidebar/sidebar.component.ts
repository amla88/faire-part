import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material.module';
import { RouterModule } from '@angular/router';

export interface NavItem {
  displayName: string;
  route?: string;
  icon?: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterModule],
  template: `
    <div class="sidebar-header">
      <h2 class="logo">Faire-part</h2>
      <button mat-icon-button (click)="toggleMobileNav.emit()" *ngIf="showToggle">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <nav>
      <mat-nav-list>
        <mat-list-item *ngFor="let item of navItems" [routerLink]="item.route">
          <mat-icon matListItemIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
          <span matListItemTitle>{{ item.displayName }}</span>
        </mat-list-item>
      </mat-nav-list>
    </nav>
  `,
  styles: [`
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }
    .logo {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }
    nav {
      flex: 1;
      overflow-y: auto;
    }
  `]
})
export class SidebarComponent {
  @Input() navItems: NavItem[] = [];
  @Input() showToggle = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
}
