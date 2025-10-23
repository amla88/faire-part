import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionService } from '../services/session.service';

export async function guestGuard(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
  const router = inject(Router);
  const session = inject(SessionService);
  await session.init();
  // Si session invalide, renvoyer vers login
  if (session.error || !session.getSelectedPersonneId()) {
    return router.parseUrl('/login');
  }
  // Si on a un uuid en session mais pas dans l'URL, l'ajouter en conservant les autres params
  const uuid = session.getUuid();
  const hasUuid = route.queryParamMap.has('uuid');
  if (uuid && !hasUuid) {
    const path = state.url.split('?')[0] || '/';
    return router.createUrlTree([path], { queryParams: { ...route.queryParams, uuid } });
  }
  return true;
}
