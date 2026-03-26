import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface PhotoUploadResult {
  path: string;
  publicUrl?: string;
  familleId?: number;
  personneId?: number;
}

export interface FamilyPhoto {
  key: string;
  name: string;
  url: string;
  size: number;
  lastModified: string | null;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private auth = inject(AuthService);

  private resolvePersonneId(): number {
    const user = this.auth.getUser();
    const pid = user?.selected_personne_id ?? user?.personne_principale_id ?? null;
    const n = typeof pid === 'number' ? pid : pid ? Number(pid) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('Aucune personne sélectionnée');
    }
    return n;
  }

  /**
   * Upload une image vers le serveur IONOS (PHP) sous /api/.
   * Le serveur revalide le token invité via une RPC Supabase (clé anon).
   */
  async uploadGuestPhoto(file: File): Promise<PhotoUploadResult> {
    if (!file) throw new Error('Aucun fichier fourni');

    const user = this.auth.getUser();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié');

    const token = this.auth.getToken();
    if (!token) throw new Error('Token invité manquant');
    const personneId = this.resolvePersonneId();

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('personneId', String(personneId));

    const endpoint = this.resolveApiUrl('/api/photos-upload.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-app-token': token,
      },
      body: fd,
      cache: 'no-store',
    });

    let data: any = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const message = data?.error || `Échec de l'upload (HTTP ${res.status})`;
      throw new Error(message);
    }

    // data doit contenir { path, publicUrl? }
    return data as PhotoUploadResult;
  }

  /**
   * Liste les photos de la personne sélectionnée via le serveur IONOS (PHP) sous /api/.
   */
  async listFamilyPhotos(): Promise<FamilyPhoto[]> {
    const user = this.auth.getUser();
    const token = this.auth.getToken();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié');
    if (!token) throw new Error("Jeton d'invitation introuvable");
    const personneId = this.resolvePersonneId();

    const endpoint = this.resolveApiUrl('/api/photos-list.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-app-token': token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ personneId }),
      cache: 'no-store',
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {}

    if (!res.ok) {
      const message = payload?.error || 'Impossible de récupérer les photos';
      throw new Error(message);
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    const mapped = items
      .map((item: Record<string, unknown>) => this.normalizeEdgePhoto(item))
      .filter((photo: FamilyPhoto | null): photo is FamilyPhoto => !!photo);

    return this.sortByDateDesc(mapped);
  }

  async deleteFamilyPhoto(key: string): Promise<void> {
    const user = this.auth.getUser();
    const token = this.auth.getToken();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié');
    if (!token) throw new Error("Jeton d'invitation introuvable");
    if (!key) throw new Error('Clé photo manquante');
    const personneId = this.resolvePersonneId();

    const endpoint = this.resolveApiUrl('/api/photos-delete.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-app-token': token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ key, personneId }),
      cache: 'no-store',
    });

    let payload: any = null;
    try { payload = await res.json(); } catch {}
    if (!res.ok) {
      const message = payload?.error || `Suppression impossible (HTTP ${res.status})`;
      throw new Error(message);
    }
  }

  private resolveApiUrl(path: string): string {
    const base = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  private normalizeEdgePhoto(row: any): FamilyPhoto | null {
    if (!row) return null;
    const key = typeof row.key === 'string' ? row.key : typeof row.path === 'string' ? row.path : null;
    if (!key) return null;

    const nameCandidate = typeof row.name === 'string' && row.name ? row.name : key.split('/').pop() || key;
    const size = typeof row.size === 'number' ? row.size : Number(row.size || 0) || 0;
    const lastModified = typeof row.lastModified === 'string' && row.lastModified ? row.lastModified : typeof row.last_modified === 'string' ? row.last_modified : null;

    // La Edge Function `list-photos` doit renvoyer une URL publique directe.
    const url = typeof row.url === 'string' && row.url ? row.url : null;
    if (!url) return null;

    return {
      key,
      name: nameCandidate,
      url,
      size,
      lastModified,
    };
  }

  private sortByDateDesc(items: FamilyPhoto[]): FamilyPhoto[] {
    return [...items].sort((a, b) => {
      const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return timeB - timeA;
    });
  }

}
