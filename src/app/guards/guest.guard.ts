import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { SessionService } from '../services/session.service';

export async function guestGuard(): Promise<boolean | UrlTree> {
  const router = inject(Router);
  const session = inject(SessionService);
  await session.init();
  if (session.error || !session.getSelectedPersonneId()) {
    // Redirige vers login; on pourrait aussi ajouter un query param pour feedback
    return router.parseUrl('/login');
  }
  return true;
}
