import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { initSupabaseClient } from './supabase.client';
import { Famille, Personne, RSVP } from '../../models';

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
   * Accès direct au client Supabase (pour les opérations non encapsulées)
   */
  get supabase(): SupabaseClient {
    return this.client;
  }

  /**
   * Récupère la famille associée à un token de connexion
   */
  async getFamilleByToken(loginToken: string): Promise<Famille | null> {
    const rpcFam = await this.client.rpc('get_famille_by_token', { p_token: loginToken });
    if (!rpcFam.error && rpcFam.data) {
      const d = Array.isArray(rpcFam.data) ? (rpcFam.data[0] ?? null) : rpcFam.data;
      if (d) return d as Famille;
    }
    return null;
  }

  /**
   * Récupère une personne spécifique par ID de famille
   */
  async getPersonneByFamilleId(familleId: number): Promise<Personne | null> {
    const { data, error } = await this.client
      .from('personnes')
      .select('id, nom, prenom, famille_id')
      .eq('famille_id', familleId)
      .maybeSingle();
    if (error) throw error;
    return data as Personne | null;
  }

  /**
   * Liste toutes les personnes associées à un token
   */
  async listPersonnesByToken(loginToken: string): Promise<Personne[]> {
    const { data, error } = await this.client.rpc('list_personnes_by_token', { p_token: loginToken });
    if (error) throw error;
    return (Array.isArray(data) ? data : (data ? [data] : [])) as Personne[];
  }

  /**
   * Enregistre la réponse RSVP
   */
  async recordRsvp(familleId: number, payload: Record<string, unknown>): Promise<RSVP> {
    const { data, error } = await this.client.rpc('record_rsvp', {
      p_famille_id: familleId,
      p_payload: payload
    });
    if (error) throw error;
    return data as RSVP;
  }
}
