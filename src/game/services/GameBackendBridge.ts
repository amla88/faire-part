import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { gameState, isPlayerArchetype, REMOTE_PROGRESS_PLAYER_KEY } from '../core/game-state';

type RpcResult<T> = { data: T | null; error: any };

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
  async upsertAvatarForSelected(seed: string, options: any): Promise<void> {
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
  }
}

export const gameBackend = new GameBackendBridge();

