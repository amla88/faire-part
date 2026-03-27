import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { NgSupabaseService } from './ng-supabase.service';

export interface MusiqueRow {
  id: number;
  created_at: string;
  titre: string;
  auteur: string;
  lien: string;
  commentaire: string;
  status: 'pending' | 'approved' | 'rejected';
  spotify_track_id: string | null;
  spotify_uri: string | null;
  album_name: string | null;
  album_image_url: string | null;
  duration_ms: number | null;
  preview_url: string | null;
  artists_json: unknown | null;
}

export interface SpotifySearchTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  artist_label: string;
  album_name: string;
  album_image_url: string | null;
  duration_ms: number | null;
  external_url: string;
  preview_url: string | null;
}

export interface ManualTrackInput {
  title: string;
  artist: string;
  url: string;
  comment?: string;
}

@Injectable({ providedIn: 'root' })
export class MusiqueService {
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);

  private getToken(): string | null {
    try {
      return localStorage.getItem('app_token');
    } catch {
      return null;
    }
  }

  private resolveApiUrl(path: string): string {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  async listForPersonne(personneId: number): Promise<MusiqueRow[]> {
    const token = this.getToken();
    if (!token) return [];
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('list_musiques_for_token', {
      p_token: token,
      p_personne_id: personneId,
    });
    if (error) {
      console.error('list_musiques_for_token', error);
      throw new Error(this.mapRpcError(error.message));
    }
    const rows = (data || []) as MusiqueRow[];
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
    }));
  }

  async insert(personneId: number, track: SpotifySearchTrack, commentaire: string): Promise<number | null> {
    const token = this.getToken();
    if (!token) return null;
    const lien = track.external_url?.trim() || `https://open.spotify.com/track/${track.id}`;
    const artistNames = track.artists.map((a) => a.name);
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('insert_musique_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_titre: track.name.trim(),
      p_auteur: track.artist_label.trim(),
      p_lien: lien,
      p_commentaire: commentaire.trim(),
      p_spotify_track_id: track.id,
      p_spotify_uri: track.uri,
      p_album_name: track.album_name || null,
      p_album_image_url: track.album_image_url || null,
      p_duration_ms: track.duration_ms ?? null,
      p_preview_url: track.preview_url || null,
      p_artists_json: artistNames,
    });
    if (error) {
      console.error('insert_musique_for_token', error);
      throw new Error(this.mapRpcError(error.message));
    }
    const id = data as number | null;
    return id != null ? Number(id) : null;
  }

  async insertManual(personneId: number, manual: ManualTrackInput): Promise<number | null> {
    const token = this.getToken();
    if (!token) return null;
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('insert_musique_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_titre: manual.title.trim(),
      p_auteur: manual.artist.trim(),
      p_lien: manual.url.trim(),
      p_commentaire: (manual.comment || '').trim(),
      p_spotify_track_id: null,
      p_spotify_uri: null,
      p_album_name: null,
      p_album_image_url: null,
      p_duration_ms: null,
      p_preview_url: null,
      p_artists_json: [manual.artist.trim()],
    });
    if (error) {
      console.error('insert_musique_for_token(manual)', error);
      throw new Error(this.mapRpcError(error.message));
    }
    const id = data as number | null;
    return id != null ? Number(id) : null;
  }

  async delete(musiqueId: number): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('delete_musique_for_token', {
      p_token: token,
      p_musique_id: musiqueId,
    });
    if (error) {
      console.error('delete_musique_for_token', error);
      throw new Error(this.mapRpcError(error.message));
    }
    return data === true;
  }

  async searchSpotify(query: string): Promise<SpotifySearchTrack[]> {
    const token = this.auth.getToken();
    if (!token) throw new Error("Jeton d'invitation introuvable");
    const endpoint = this.resolveApiUrl('/api/spotify-search.php');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-token': token,
      },
      body: JSON.stringify({ q: query.trim() }),
      cache: 'no-store',
    });
    let payload: { tracks?: SpotifySearchTrack[]; error?: string } | null = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) {
      const message = payload?.error || `Recherche impossible (HTTP ${res.status})`;
      throw new Error(message);
    }
    return Array.isArray(payload?.tracks) ? payload!.tracks! : [];
  }

  private mapRpcError(msg: string): string {
    const m = (msg || '').toLowerCase();
    if (m.includes('musique_limit_reached')) {
      return 'Vous avez déjà trois propositions pour cette personne (maximum atteint).';
    }
    if (m.includes('duplicate_track')) {
      return 'Ce titre figure déjà dans vos propositions.';
    }
    if (m.includes('empty_fields')) {
      return 'Informations incomplètes.';
    }
    if (m.includes('invalid_token')) {
      return 'Session invalide, reconnectez-vous.';
    }
    if (m.includes('personne_not_in_famille')) {
      return 'Cette personne ne correspond pas à votre invitation.';
    }
    return msg || 'Opération impossible';
  }
}
