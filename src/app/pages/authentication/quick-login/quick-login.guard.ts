import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class QuickLoginGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router, private snackBar: MatSnackBar) {}

  async canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Promise<boolean> {
    const raw = (route.paramMap.get('code') || '').toString();
    const token = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!/^[A-Z0-9]{8}$/.test(token)) {
      // invalid format -> redirect to login page and replace history
      await this.router.navigate(['/authentication/login'], { replaceUrl: true });
      return false;
    }

    const res = await this.auth.loginWithTokenSilent(token);

    if (!res.success) {
      this.snackBar.open(res.error || 'Code invalide', 'OK', { duration: 4000 });
      await this.router.navigate(['/authentication/login'], { replaceUrl: true });
      return false;
    }

    const user = res.user!;
    if (user.personnes && user.personnes.length > 1) {
      await this.router.navigate(['/person'], { replaceUrl: true });
      return false;
    }

    // single or no persons -> go to root (dashboard)
    await this.router.navigate(['/'], { replaceUrl: true });
    return false;
  }
}
