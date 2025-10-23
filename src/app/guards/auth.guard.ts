import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';

/**
 * Guard pour protéger les routes qui nécessitent une authentification guest
 * Redirige vers /login si pas loggé
 */
export const guestAuthGuard: CanActivateFn = async (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  await sessionService.init();

  if (!sessionService.initialized || sessionService.error) {
    return router.createUrlTree(['/login']);
  }

  return true;
};

/**
 * Guard pour protéger les routes publiques (login, admin-login)
 * Redirige vers /person si déjà loggé en guest
 */
export const publicGuard: CanActivateFn = async (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  await sessionService.init();

  if (sessionService.initialized && !sessionService.error) {
    return router.createUrlTree(['/person']);
  }

  return true;
};

/**
 * Guard pour protéger les routes admin
 * À implémenter selon la logique d'authentification admin
 */
export const adminAuthGuard: CanActivateFn = async (route, state) => {
  // TODO: Implémenter la logique d'authentification admin
  return true;
};
