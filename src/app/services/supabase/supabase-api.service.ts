import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { initSupabaseClient } from './supabase.client';

/**
 * Service Angular pour l'API Supabase.
 * Encapsule les appels RPC et requêtes à la base de données.
 */

@Injectable({ providedIn: 'root' })
export class SupabaseApiService {
  private client: SupabaseClient;

  constructor() {
    this.client = initSupabaseClient();
  }

  /**
   * Récupère la famille associée à un token de connexion
   */
  async getFamilleByToken(loginToken: string) {
    const rpcFam = await this.client.rpc('get_famille_by_token', { p_token: loginToken });
    if (!rpcFam.error && rpcFam.data) {
      const d = Array.isArray(rpcFam.data) ? (rpcFam.data[0] ?? null) : (rpcFam.data as any ?? null);
      if (d) return d;
    }
    return null;
  }

  /**
   * Récupère une personne spécifique par ID de famille
   */
  async getPersonneByFamilleId(familleId: number) {
    const { data, error } = await this.client
      .from('personnes')
      .select('id, nom, prenom, famille_id')
      .eq('famille_id', familleId)
      .maybeSingle();
    if (error) throw error;
    return data as { id: number; nom?: string; prenom?: string; famille_id: number } | null;
  }

  /**
   * Liste toutes les personnes associées à un token
   */
  async listPersonnesByToken(loginToken: string) {
    const { data, error } = await this.client.rpc('list_personnes_by_token', { p_token: loginToken });
    if (error) throw error;
    return (Array.isArray(data) ? data : (data ? [data] : [])) as Array<{ id: number; nom?: string; prenom?: string; famille_id: number }>;
  }

  /**
   * Enregistre la réponse RSVP
   */
  async recordRsvp(familleId: number, payload: any) {
    const { data, error } = await this.client.rpc('record_rsvp', {
      p_famille_id: familleId,
      p_payload: payload
    });
    if (error) throw error;
    return data;
  }
}
