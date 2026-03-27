import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

  /** Acte 1/2: consigner présence + allergènes pour la personne sélectionnée */
  async recordRsvpForSelected(opts: {
    present_reception: boolean;
    present_repas: boolean;
    present_soiree: boolean;
    allergenes_alimentaires?: string;
    regimes_remarques?: string;
  }): Promise<void> {
    const user = this.getUser();
    if (!user?.famille_id) throw new Error('Famille introuvable (app_user).');
    const familleId = Number(user.famille_id);
    const personneId = Number(user.selected_personne_id ?? user.personne_principale_id);
    if (!Number.isFinite(personneId)) throw new Error('Personne sélectionnée introuvable.');

    const payload = [
      {
        personne_id: personneId,
        present_reception: !!opts.present_reception,
        present_repas: !!opts.present_repas,
        present_soiree: !!opts.present_soiree,
        allergenes_alimentaires: (opts.allergenes_alimentaires ?? '').trim(),
        regimes_remarques: (opts.regimes_remarques ?? '').trim(),
      },
    ];

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
    const user = this.getUser();
    const personneId = Number(user?.selected_personne_id ?? user?.personne_principale_id);
    if (!Number.isFinite(personneId)) throw new Error('Personne sélectionnée introuvable.');
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

