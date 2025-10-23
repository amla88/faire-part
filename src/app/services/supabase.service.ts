import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

function readMeta(name: string): string | null {
  const el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  return el?.content ?? null;
}

declare global {
  // eslint-disable-next-line no-var
  var __SB_CLIENTS__: Record<string, SupabaseClient> | undefined;
}

function getOrCreateSupabase(url: string, anon: string): SupabaseClient {
  const key = `${url}|${anon.slice(0, 12)}`;
  (globalThis as any).__SB_CLIENTS__ = (globalThis as any).__SB_CLIENTS__ || ({} as Record<string, SupabaseClient>);
  if ((globalThis as any).__SB_CLIENTS__[key]) return (globalThis as any).__SB_CLIENTS__[key];
  const client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Moins d'activité côté auth en dev réduit la contention, mais on conserve l'auto-refresh
    },
  });
  (globalThis as any).__SB_CLIENTS__[key] = client;
  return client;
}

@Injectable({ providedIn: 'root' })
export class NgSupabaseService {
  private client: SupabaseClient;

  constructor() {
    const url = environment.supabase.url || readMeta('supabase-url') || '';
    const anon = environment.supabase.anonKey || readMeta('supabase-anon-key') || '';
    if (!url || !anon) {
      // On ne jette pas d'erreur en dev pour ne pas bloquer l'UI
      console.warn('Clés Supabase non trouvées dans les meta tags');
    }
    this.client = getOrCreateSupabase(url, anon);
  }

  get supabase() {
    return this.client;
  }

  async getFamilleByToken(loginToken: string) {
    const rpcFam = await this.client.rpc('get_famille_by_token', { p_token: loginToken });
    if (!rpcFam.error && rpcFam.data) {
      const d = Array.isArray(rpcFam.data) ? (rpcFam.data[0] ?? null) : (rpcFam.data as any ?? null);
      if (d) return d;
    }
    // Rien trouvé
    return null;
  }

  async getPersonneByFamilleId(familleId: number) {
    const { data, error } = await this.client
      .from('personnes')
      .select('id, nom, prenom, famille_id')
      .eq('famille_id', familleId)
      .maybeSingle();
    if (error) throw error;
    return data as { id: number; nom?: string; prenom?: string; famille_id: number } | null;
  }

  async listPersonnesByToken(loginToken: string) {
    const { data, error } = await this.client.rpc('list_personnes_by_token', { p_token: loginToken });
    if (error) throw error;
    return (Array.isArray(data) ? data : (data ? [data] : [])) as Array<{ id: number; nom?: string; prenom?: string; famille_id: number }>;
  }

  async recordRsvp(familleId: number, payload: any) {
    const { data, error } = await this.client.rpc('record_rsvp', {
      p_famille_id: familleId,
      p_payload: payload
    });
    if (error) throw error;
    return data;
  }
}
