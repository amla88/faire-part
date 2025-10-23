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

  // Nouveau: familles remplace users
  async getFamilleByToken(loginToken: string) {
    // Essaye d'abord la RPC moderne
    try {
      const { data, error } = await this.client.rpc('get_famille_by_token', { p_token: loginToken });
      if (error) throw error;
      return Array.isArray(data) ? (data[0] ?? null) : (data as any ?? null);
    } catch {
      // Fallback: lecture directe si la RPC n'existe pas encore
      const { data, error } = await this.client
        .from('familles')
        .select('*')
        .eq('login_token', loginToken)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    }
  }

  // Compat: ancien nom conservé quelques temps
  async getUserByToken(loginToken: string) {
    return this.getFamilleByToken(loginToken);
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

  async listPersonnesByFamilleId(familleId: number) {
    const { data, error } = await this.client
      .from('personnes')
      .select('id, nom, prenom, famille_id')
      .eq('famille_id', familleId)
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || []) as Array<{ id: number; nom?: string; prenom?: string; famille_id: number }>;
  }

  async recordRsvp(familleId: number, payload: any) {
    // Tente la RPC si disponible, sinon fallback upsert direct
    try {
      const { data, error } = await this.client.rpc('record_rsvp', {
        p_famille_id: familleId,
        p_payload: payload
      });
      if (error) throw error;
      return data;
    } catch (e) {
      const { data, error } = await this.client
        .from('rsvp')
        .upsert({ famille_id: familleId, ...payload }, { onConflict: 'famille_id' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  }
}
