import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-admin-layout',
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="admin-layout">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .admin-layout {
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
  `]
})
export class AdminLayoutComponent {}
