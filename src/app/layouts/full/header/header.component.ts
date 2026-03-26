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
import { AvatarMacaronComponent } from 'src/app/shared/avatar-macaron/avatar-macaron.component';
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
    AvatarMacaronComponent,
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

  get isAdminContext(): boolean {
    return this.router.url.startsWith('/admin');
  }

  /**
   * Logout handler that works for both normal users (token-based local session)
   * and admin users (Supabase session).
   */
  async logout(): Promise<void> {
    const isAdminContext = this.router.url.startsWith('/admin');

    try {
      if (isAdminContext) {
        // Admin context: sign out from Supabase and clear admin profile
        await this.adminAuth.signOut();
        await this.router.navigate(['/authentication/admin-login']);
      } else {
        // Public context: clear local storage and go to public login
        this.auth.logout();
        await this.router.navigate(['/authentication/login']);
      }
    } catch (e) {
      console.error(`Logout failed in ${isAdminContext ? 'admin' : 'public'} context`, e);
      // As a fallback, try to navigate to the appropriate login page
      const fallbackUrl = isAdminContext ? '/authentication/admin-login' : '/authentication/login';
      await this.router.navigate([fallbackUrl]);
    }
  }
}