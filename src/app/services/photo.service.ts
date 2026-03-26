import { Injectable, inject } from '@angular/core';
import { NgSupabaseService } from './ng-supabase.service';
import { AuthService } from './auth.service';

export interface PhotoUploadResult {
  path: string;
  publicUrl?: string;
  familleId?: number;
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
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);

  /**
   * Upload une image vers Oracle Object Storage via l'Edge Function `upload-photo`.
   * L'edge signe la requête (S3 SigV4) après avoir validé le token invité.
   */
  async uploadGuestPhoto(file: File): Promise<PhotoUploadResult> {
    if (!file) throw new Error('Aucun fichier fourni');

    const user = this.auth.getUser();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié');

    const { url, key } = this.resolveSupabaseConfig();
    if (!url || !key) throw new Error('Configuration Supabase manquante');

    const token = this.auth.getToken();
    if (!token) throw new Error('Token invité manquant');

    const fd = new FormData();
    fd.append('file', file, file.name);

    const endpoint = `${url.replace(/\/$/, '')}/functions/v1/upload-photo`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'x-app-token': token,
      },
      body: fd,
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
   * Liste les photos d'une famille en interrogeant l'Edge Function `list-photos` (Oracle Object Storage).
   */
  async listFamilyPhotos(): Promise<FamilyPhoto[]> {
    const user = this.auth.getUser();
    const token = this.auth.getToken();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié');
    if (!token) throw new Error("Jeton d'invitation introuvable");

    const { url, key } = this.resolveSupabaseConfig();
    if (!url || !key) throw new Error('Configuration Supabase manquante');

    const endpoint = `${url.replace(/\/$/, '')}/functions/v1/list-photos`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'x-app-token': token,
        'content-type': 'application/json',
      },
      body: '{}',
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

  private resolveSupabaseConfig(): { url?: string; key?: string } {
    try {
      const win = window as any;
      if (win && win.__env) {
        const url = win.__env.SUPABASE_URL || win.__env.supabaseUrl || win.__env.SUPABASE_API_URL;
        const key = win.__env.SUPABASE_ANON_KEY || win.__env.supabaseAnonKey || win.__env.SUPABASE_ANON;
        if (url && key) return { url, key };
      }
    } catch {}
    try {
      const metaUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || undefined;
      const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || undefined;
      if (metaUrl && metaKey) return { url: metaUrl, key: metaKey };
    } catch {}
    try {
      const win = window as any;
      const url = win.SUPABASE_URL || win.supabaseUrl;
      const key = win.SUPABASE_ANON_KEY || win.supabaseAnonKey;
      if (url && key) return { url, key };
    } catch {}
    return {};
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
