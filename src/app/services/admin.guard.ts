import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

/**
 * Guard de correspondance pour l'espace admin.
 * - Redirige vers /admin-login si non connecté
 */
export const adminGuard: CanMatchFn = async () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  await auth.initialized;

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/authentication/admin-login');
  }
  return true;
};
