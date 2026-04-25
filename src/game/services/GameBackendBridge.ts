import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { gameState, isPlayerArchetype, REMOTE_PROGRESS_PLAYER_KEY } from '../core/game-state';

type RpcResult<T> = { data: T | null; error: any };

export interface GamePersonneAnecdote {
  id: number;
  contenu: string;
  created_at: string;
}

export interface GamePersonneIdee {
  id: number;
  contenu: string;
  created_at: string;
}

export interface GamePersonneMusique {
  id: number;
  created_at: string;
  titre: string;
  auteur: string;
  lien: string;
  commentaire: string;
  status: 'pending' | 'approved' | 'rejected' | string;
}

/** Photo album (même forme que `src/app/services/photo.service` — liste PHP). */
export interface GameFamilyPhoto {
  key: string;
  name: string;
  url: string;
  size: number;
  lastModified: string | null;
}

export class GameBackendBridge {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const { url, key } = this.resolveConfig();
    if (!url || !key) throw new Error('Supabase non configuré (meta tags manquants).');
    this.client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'faire-part-supabase-auth' },
      global: { headers: { Accept: 'application/json' } },
    });
    return this.client;
  }

  private resolveConfig(): { url?: string; key?: string } {
    const metaUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || undefined;
    const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || undefined;
    return { url: metaUrl, key: metaKey };
  }

  private getToken(): string | null {
    try {
      return localStorage.getItem('app_token');
    } catch {
      return null;
    }
  }

  private getUser(): any | null {
    try {
      const raw = localStorage.getItem('app_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private resolveApiUrl(path: string): string {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  private getSelectedPersonneId(): number | null {
    const user = this.getUser();
    const personneId = Number(user?.selected_personne_id ?? user?.personne_principale_id);
    return Number.isFinite(personneId) ? personneId : null;
  }

  async getGameProgressForSelected(): Promise<Record<string, unknown>> {
    const token = this.getToken();
    if (!token) return {};
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return {};
    const res = await this.rpc<any>('get_game_progress_for_token', { p_token: token, p_personne_id: personneId });
    if (res.error) return {};
    const flags = res.data as any;
    if (!flags || typeof flags !== 'object') return {};
    return flags as Record<string, unknown>;
  }

  async upsertGameProgressForSelected(flags: Record<string, boolean>): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return;
    const remote = await this.getGameProgressForSelected();
    const remotePlayerRaw = remote[REMOTE_PROGRESS_PLAYER_KEY];
    const remotePlayer =
      typeof remotePlayerRaw === 'string' && isPlayerArchetype(remotePlayerRaw) ? remotePlayerRaw : undefined;
    const pl = gameState.snapshot.player ?? remotePlayer;
    const payload: Record<string, unknown> = { ...(flags || {}) };
    if (pl) payload[REMOTE_PROGRESS_PLAYER_KEY] = pl;
    const res = await this.rpc('upsert_game_progress_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_flags: payload,
    });
    if (res.error) throw res.error;
  }

  async resetGameProgressForSelected(): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return;
    const res = await this.rpc('reset_game_progress_for_token', { p_token: token, p_personne_id: personneId });
    if (res.error) throw res.error;
  }

  async rpc<T = any>(fn: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
    const client = this.getClient();
    const res = await client.rpc(fn, params as any);
    return res as any;
  }

  async getSelectedPersonneRow(): Promise<any | null> {
    const user = this.getUser();
    if (!user?.famille_id) return null;
    const familleId = Number(user.famille_id);
    const personneId = Number(user.selected_personne_id ?? user.personne_principale_id);
    if (!Number.isFinite(personneId)) return null;
    const res = await this.rpc<any[]>('get_personnes_by_famille', { p_famille_id: familleId });
    if (res.error) return null;
    const rows = (res.data || []) as any[];
    return rows.find((r) => Number(r.id) === personneId) ?? null;
  }

  async insertAnecdoteForSelected(contenu: string): Promise<number | null> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');
    const res = await this.rpc<number>('insert_anecdote_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_contenu: contenu,
    });
    if (res.error) throw res.error;
    return res.data != null ? Number(res.data) : null;
  }

  async listAnecdotesForSelected(): Promise<GamePersonneAnecdote[]> {
    const token = this.getToken();
    if (!token) return [];
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return [];
    const res = await this.rpc<GamePersonneAnecdote[]>('list_anecdotes_for_token', {
      p_token: token,
      p_personne_id: personneId,
    });
    if (res.error) return [];
    const rows = (res.data || []) as GamePersonneAnecdote[];
    return rows.map((r) => ({
      id: Number(r.id),
      contenu: String(r.contenu ?? ''),
      created_at: String(r.created_at ?? ''),
    }));
  }

  async deleteAnecdoteForSelected(anecdoteId: number): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const res = await this.rpc<boolean>('delete_anecdote_for_token', {
      p_token: token,
      p_anecdote_id: anecdoteId,
    });
    if (res.error) throw res.error;
  }

  async listIdeesForSelected(): Promise<GamePersonneIdee[]> {
    const token = this.getToken();
    if (!token) return [];
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return [];
    const res = await this.rpc<GamePersonneIdee[]>('list_idees_for_token', {
      p_token: token,
      p_personne_id: personneId,
    });
    if (res.error) return [];
    const rows = (res.data || []) as GamePersonneIdee[];
    return rows.map((r) => ({
      id: Number(r.id),
      contenu: String(r.contenu ?? ''),
      created_at: String(r.created_at ?? ''),
    }));
  }

  async deleteIdeeForSelected(ideeId: number): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const res = await this.rpc<boolean>('delete_idee_for_token', {
      p_token: token,
      p_idee_id: ideeId,
    });
    if (res.error) throw res.error;
  }

  async insertIdeeForSelected(contenu: string): Promise<number | null> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');
    const res = await this.rpc<number>('insert_idee_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_contenu: contenu,
    });
    if (res.error) throw res.error;
    return res.data != null ? Number(res.data) : null;
  }

  async insertMusiqueManualForSelected(args: {
    titre: string;
    auteur: string;
    lien: string;
    commentaire?: string;
  }): Promise<number | null> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');

    const res = await this.rpc<number>('insert_musique_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_titre: args.titre,
      p_auteur: args.auteur,
      p_lien: args.lien,
      p_commentaire: args.commentaire ?? '',
      p_spotify_track_id: null,
      p_spotify_uri: null,
      p_album_name: null,
      p_album_image_url: null,
      p_duration_ms: null,
      p_preview_url: null,
      p_artists_json: [args.auteur],
    });
    if (res.error) throw res.error;
    return res.data != null ? Number(res.data) : null;
  }

  async listMusiquesForSelected(): Promise<GamePersonneMusique[]> {
    const token = this.getToken();
    if (!token) return [];
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return [];
    const res = await this.rpc<Record<string, unknown>[]>('list_musiques_for_token', {
      p_token: token,
      p_personne_id: personneId,
    });
    if (res.error) return [];
    const rows = (res.data || []) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r['id']),
      created_at: String(r['created_at'] ?? ''),
      titre: String(r['titre'] ?? ''),
      auteur: String(r['auteur'] ?? ''),
      lien: String(r['lien'] ?? ''),
      commentaire: String(r['commentaire'] ?? ''),
      status: String(r['status'] ?? 'pending'),
    }));
  }

  async deleteMusiqueForSelected(musiqueId: number): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const res = await this.rpc<boolean>('delete_musique_for_token', {
      p_token: token,
      p_musique_id: musiqueId,
    });
    if (res.error) throw res.error;
  }

  async uploadPhotoForSelected(file: File): Promise<{ path?: string; publicUrl?: string } | null> {
    if (!file) throw new Error('Aucun fichier fourni');
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('personneId', String(personneId));

    const endpoint = this.resolveApiUrl('/api/photos-upload.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-app-token': token },
      body: fd,
      cache: 'no-store',
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = data?.error || `Échec de l'upload (HTTP ${res.status})`;
      throw new Error(msg);
    }
    return data as any;
  }

  private normalizeFamilyPhotoRow(row: Record<string, unknown>): GameFamilyPhoto | null {
    if (!row) return null;
    const key =
      typeof row['key'] === 'string' ? (row['key'] as string) : typeof row['path'] === 'string' ? (row['path'] as string) : null;
    if (!key) return null;
    const nameCandidate =
      typeof row['name'] === 'string' && (row['name'] as string)
        ? (row['name'] as string)
        : key.split('/').pop() || key;
    const size = typeof row['size'] === 'number' ? row['size'] : Number(row['size'] || 0) || 0;
    const lastModified =
      typeof row['lastModified'] === 'string' && (row['lastModified'] as string)
        ? (row['lastModified'] as string)
        : typeof row['last_modified'] === 'string'
          ? (row['last_modified'] as string)
          : null;
    const url = typeof row['url'] === 'string' && (row['url'] as string) ? (row['url'] as string) : null;
    if (!url) return null;
    return { key, name: nameCandidate, url, size, lastModified };
  }

  private sortFamilyPhotosByDateDesc(items: GameFamilyPhoto[]): GameFamilyPhoto[] {
    return [...items].sort((a, b) => {
      const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return timeB - timeA;
    });
  }

  private static sleepGame(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * En dev, le proxy vers l’hébergeur peut time-out; le PHP peut retourner 5xx. On retente sans boucler sur les 4xx.
   */
  async listFamilyPhotosForSelected(): Promise<GameFamilyPhoto[]> {
    const user = this.getUser();
    const token = this.getToken();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié (album).');
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');

    const endpoint = this.resolveApiUrl('/api/photos-list.php');
    const body = JSON.stringify({ personneId });

    let lastError = 'Impossible de récupérer les photos';
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await GameBackendBridge.sleepGame(300 * attempt);
      }
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'x-app-token': token,
            'content-type': 'application/json',
          },
          body,
          cache: 'no-store',
        });
      } catch (netErr) {
        lastError = (netErr as Error)?.message || "Problème réseau (time-out) vers l'album";
        if (attempt < 2) continue;
        throw new Error(lastError);
      }

      let payload: { items?: unknown; error?: string } | null = null;
      try {
        payload = (await res.json()) as { items?: unknown; error?: string };
      } catch {
        payload = null;
      }

      if (res.status >= 500 && res.status <= 599) {
        lastError = payload?.error || `Album indisponible (HTTP ${res.status})`;
        if (attempt < 2) continue;
        throw new Error(lastError);
      }
      if (res.status === 429) {
        lastError = 'Trop de requêtes, réessayez dans un instant.';
        if (attempt < 2) continue;
        throw new Error(lastError);
      }
      if (!res.ok) {
        throw new Error(payload?.error || 'Impossible de récupérer les photos');
      }
      const items = Array.isArray(payload?.items) ? payload?.items : [];
      const mapped = (items as Record<string, unknown>[])
        .map((item) => this.normalizeFamilyPhotoRow(item))
        .filter((p): p is GameFamilyPhoto => p != null);
      return this.sortFamilyPhotosByDateDesc(mapped);
    }
    throw new Error(lastError);
  }

  async deleteFamilyPhotoForSelected(key: string): Promise<void> {
    const user = this.getUser();
    const token = this.getToken();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié.');
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    if (!key) throw new Error('Clé photo manquante');
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');

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

    let payload: { error?: string } | null = null;
    try {
      payload = (await res.json()) as { error?: string };
    } catch {
      payload = null;
    }
    if (!res.ok) {
      throw new Error(payload?.error || `Suppression impossible (HTTP ${res.status})`);
    }
  }

  async getAvatarForSelected(): Promise<{ seed?: string; options?: any } | null> {
    const token = this.getToken();
    if (!token) return null;
    const user = this.getUser();
    const personneId = this.getSelectedPersonneId();
    if (!personneId) return null;

    const res = await this.rpc<any>('get_avatar_for_token', { p_token: token, p_personne_id: personneId });
    if (res.error) return null;
    let row = res.data as any;
    if (Array.isArray(row)) row = row[0] ?? null;
    if (!row) return null;
    return { seed: row.seed ?? undefined, options: row.options ?? undefined };
  }

  /**
   * Acte 1/2: mettre à jour présence/allergènes/régimes pour la personne sélectionnée.
   *
   * IMPORTANT: ne jamais "remettre par défaut" — on n'envoie que les champs explicitement fournis,
   * et on merge toujours avec l'existant côté DB.
   */
  async recordRsvpForSelected(opts: {
    present_reception?: boolean;
    present_repas?: boolean;
    present_soiree?: boolean;
    decline_invitation?: boolean;
    allergenes_alimentaires?: string;
    regimes_remarques?: string;
  }): Promise<void> {
    const user = this.getUser();
    if (!user?.famille_id) throw new Error('Famille introuvable (app_user).');
    const familleId = Number(user.famille_id);
    const personneId = Number(user.selected_personne_id ?? user.personne_principale_id);
    if (!Number.isFinite(personneId)) throw new Error('Personne sélectionnée introuvable.');

    const existing = await this.getSelectedPersonneRow();

    const next: Record<string, any> = { personne_id: personneId };

    if (typeof opts.present_reception === 'boolean') next['present_reception'] = opts.present_reception;
    if (typeof opts.present_repas === 'boolean') next['present_repas'] = opts.present_repas;
    if (typeof opts.present_soiree === 'boolean') next['present_soiree'] = opts.present_soiree;
    if (typeof opts.decline_invitation === 'boolean') next['decline_invitation'] = opts.decline_invitation;

    // Ne pas effacer: si vide, on n'envoie pas le champ (donc aucun overwrite en NULL).
    if (typeof opts.allergenes_alimentaires === 'string') {
      const v = opts.allergenes_alimentaires.trim();
      if (v.length > 0) next['allergenes_alimentaires'] = v;
    }
    if (typeof opts.regimes_remarques === 'string') {
      const v = opts.regimes_remarques.trim();
      if (v.length > 0) next['regimes_remarques'] = v;
    }

    // Merge final (belt & suspenders): préserver toute valeur existante si champ non envoyé.
    if (existing && typeof existing === 'object') {
      if (!('present_reception' in next) && typeof existing.present_reception === 'boolean')
        next['present_reception'] = existing.present_reception;
      if (!('present_repas' in next) && typeof existing.present_repas === 'boolean') next['present_repas'] = existing.present_repas;
      if (!('present_soiree' in next) && typeof existing.present_soiree === 'boolean')
        next['present_soiree'] = existing.present_soiree;
      if (!('decline_invitation' in next) && typeof existing.decline_invitation === 'boolean')
        next['decline_invitation'] = existing.decline_invitation;
      if (!('allergenes_alimentaires' in next) && typeof existing.allergenes_alimentaires === 'string')
        next['allergenes_alimentaires'] = existing.allergenes_alimentaires;
      if (!('regimes_remarques' in next) && typeof existing.regimes_remarques === 'string')
        next['regimes_remarques'] = existing.regimes_remarques;
    }

    const payload = [next];

    const res = await this.rpc('record_rsvp', { p_famille_id: familleId, p_payload: payload });
    if (res.error) {
      const alt = await this.rpc('upsert_rsvp', { p_famille_id: familleId, p_payload: payload });
      if (alt.error) throw alt.error;
    }
  }

  /** Acte 3: sauvegarder avatar via RPC token-based existant */
  async upsertAvatarForSelected(seed: string, options: any, imageDataUri?: string | null): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable.");
    const personneId = this.getSelectedPersonneId();
    if (!personneId) throw new Error('Personne sélectionnée introuvable.');
    const res = await this.rpc('upsert_avatar_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_seed: seed,
      p_options: options,
    });
    if (res.error) throw res.error;
    this.mergeAvatarIntoAppUserCache(personneId, { seed, options, imageDataUri: imageDataUri ?? undefined });
  }

  /** Aligné sur AvatarService.setAvatarInCache (aperçu PNG côté client). */
  private mergeAvatarIntoAppUserCache(
    personneId: number,
    row: { seed?: string; options?: any; imageDataUri?: string }
  ): void {
    try {
      const raw = localStorage.getItem('app_user');
      if (!raw) return;
      const user = JSON.parse(raw) as Record<string, any>;
      user['avatars'] = user['avatars'] || {};
      const av = user['avatars'] as Record<string, any>;
      const existing = av[personneId] ?? av[String(personneId)] ?? {};
      av[personneId] = {
        ...existing,
        seed: row.seed ?? existing.seed,
        options: row.options ?? existing.options,
        imageDataUri: row.imageDataUri ?? existing.imageDataUri,
      };
      localStorage.setItem('app_user', JSON.stringify(user));
    } catch {
      // ignore
    }
  }
}

export const gameBackend = new GameBackendBridge();

