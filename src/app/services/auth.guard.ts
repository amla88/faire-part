import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
  CanMatchFn,
  CanActivateFn,
} from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route `/` : redirige sans rendre de composant.
 * - déconnecté -> login
 * - connecté -> unique page publique `/dashboard`
 */
export const landingRedirectGuard: CanMatchFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  if (!auth.isLoggedIn()) {
    return router.parseUrl('/authentication/login');
  }

  return router.parseUrl('/dashboard');
};

/** Partie publique : une seule page une fois connecté (`/dashboard`). */
export const guestPublicHomeGuard: CanActivateFn = (_route, state) => {
  const url = state.url.split('?')[0].split('#')[0];
  if (url === '/dashboard' || url.startsWith('/dashboard/')) {
    return true;
  }
  return inject(Router).parseUrl('/dashboard');
};

/** Page Anniversaire 40 ans : uniquement si la personne sélectionnée est invitée (`invite_anniversaire`). */
export const anniversaire40Guard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.canSeeAnniversaire40Page()) {
    return router.parseUrl('/dashboard');
  }
  return true;
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
