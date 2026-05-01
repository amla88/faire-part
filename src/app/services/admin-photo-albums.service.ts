import { Injectable, inject } from '@angular/core';
import type { FamilyPhoto } from './photo.service';

/** Réponse de `photos-admin-albums.php`. */
export interface AdminPhotoAlbumsBatchResponse {
  albums: Array<{ personneId: number; items: FamilyPhoto[] }>;
}

@Injectable({ providedIn: 'root' })
export class AdminPhotoAlbumsService {
  /**
   * Liste les fichiers album pour les personnes données (session admin Supabase).
   */
  async fetchAlbumsForPersonnes(accessToken: string, personneIds: number[]): Promise<Map<number, FamilyPhoto[]>> {
    const out = new Map<number, FamilyPhoto[]>();
    if (!accessToken || personneIds.length === 0) {
      return out;
    }

    const endpoint = this.resolveApiUrl('/api/photos-admin-albums.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ personneIds }),
      cache: 'no-store',
    });

    let payload: AdminPhotoAlbumsBatchResponse | { error?: string } | null = null;
    try {
      payload = (await res.json()) as AdminPhotoAlbumsBatchResponse;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const errBody = payload as unknown as { error?: string } | null;
      const msg =
        (errBody && typeof errBody.error === 'string' && errBody.error) ||
        `Échec du chargement des albums (HTTP ${res.status})`;
      throw new Error(msg);
    }

    const albums = Array.isArray((payload as AdminPhotoAlbumsBatchResponse)?.albums)
      ? (payload as AdminPhotoAlbumsBatchResponse).albums
      : [];

    for (const row of albums) {
      const pid = Number(row.personneId);
      if (!Number.isFinite(pid)) continue;
      const items = Array.isArray(row.items)
        ? row.items
            .map((item: unknown) => this.normalizePhoto(item))
            .filter((p): p is FamilyPhoto => p != null)
        : [];
      out.set(pid, items);
    }

    return out;
  }

  private resolveApiUrl(path: string): string {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  private normalizePhoto(row: unknown): FamilyPhoto | null {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const key =
      typeof r['key'] === 'string' ? r['key'] : typeof r['path'] === 'string' ? (r['path'] as string) : null;
    if (!key) return null;
    const nameCandidate =
      typeof r['name'] === 'string' && r['name'] ? r['name'] : key.split('/').pop() || key;
    const size = typeof r['size'] === 'number' ? r['size'] : Number(r['size'] || 0) || 0;
    const lastModified =
      typeof r['lastModified'] === 'string' && r['lastModified']
        ? r['lastModified']
        : typeof r['last_modified'] === 'string'
          ? r['last_modified']
          : null;
    const url = typeof r['url'] === 'string' && r['url'] ? r['url'] : null;
    if (!url) return null;
    return { key, name: nameCandidate, url, size, lastModified };
  }
}
