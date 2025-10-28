import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

/**
 * Guard de correspondance pour l'espace admin.
 * - Redirige vers /admin-login si non connecté
 * - Redirige vers / si connecté mais non admin
 */
export const adminGuard: CanMatchFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  const isLoggedIn = !!auth.session();
  if (!isLoggedIn) {
    return router.parseUrl('/admin-login');
  }
  if (!auth.isAdmin()) {
    return router.parseUrl('/');
  }
  return true;
};
