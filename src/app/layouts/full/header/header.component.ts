import {
  Component,
  Output,
  EventEmitter,
  Input,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AuthService } from 'src/app/services/auth.service';
import { AdminAuthService } from 'src/app/services/admin-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  // provide AuthService to access cached avatar
  auth = inject(AuthService);
  adminAuth = inject(AdminAuthService);
  private router = inject(Router);

  /**
   * Logout handler that works for both normal users (token-based local session)
   * and admin users (Supabase session).
   */
  async logout(): Promise<void> {
    // If admin session exists, sign out from Supabase and clear admin profile
    try {
      if (this.adminAuth.session()) {
        await this.adminAuth.signOut();
        // redirect to admin login
        await this.router.navigate(['/admin-login']);
        return;
      }
    } catch (e) {
      // continue with normal logout if admin signOut fails
      console.error('Admin signOut failed', e);
    }

    // Normal app user logout: clear local storage and go to auth login
    try {
      this.auth.logout();
    } catch (e) {
      console.error('AuthService.logout failed', e);
    }
    await this.router.navigate(['/authentication/login']);
  }
}