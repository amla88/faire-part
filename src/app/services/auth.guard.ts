import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
  CanMatchFn,
} from '@angular/router';
import { AuthService } from './auth.service';
import { isCountdownWindowActive } from './countdown-window';

/**
 * Route `/` : redirige sans rendre de composant.
 * - déconnecté -> login
 * - connecté + fenêtre décompte active -> `/decompte`
 * - connecté sinon -> `/dashboard`
 */
export const landingRedirectGuard: CanMatchFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  if (!auth.isLoggedIn()) {
    return router.parseUrl('/authentication/login');
  }

  if (isCountdownWindowActive()) {
    return router.parseUrl('/decompte');
  }

  return router.parseUrl('/dashboard');
};

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    if (this.auth.isLoggedIn()) return true;
    // Redirect to login and preserve attempted URL if needed
    return this.router.parseUrl('/authentication/login');
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.canActivate(route, state);
  }
}
