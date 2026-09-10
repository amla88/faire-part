import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface RsvpChangeRequestPayload {
  message: string;
  contactEmail?: string;
}

@Injectable({ providedIn: 'root' })
export class RsvpChangeRequestService {
  constructor(private readonly auth: AuthService) {}

  async send(payload: RsvpChangeRequestPayload): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      throw new Error('Session expirée — veuillez vous reconnecter.');
    }
    const message = payload.message.trim();
    if (message.length < 8) {
      throw new Error('Écrivez quelques mots pour préciser la modification.');
    }

    const endpoint = this.resolveApiUrl('/api/rsvp-change-request.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-token': token,
      },
      body: JSON.stringify({
        message,
        contactEmail: (payload.contactEmail || '').trim(),
      }),
      cache: 'no-store',
    });

    let data: { ok?: boolean; error?: string } | null = null;
    try {
      data = (await res.json()) as { ok?: boolean; error?: string };
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error(data?.error || `Envoi impossible (HTTP ${res.status})`);
    }
  }

  private resolveApiUrl(path: string): string {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }
}
