import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service singleton fournissant un client Supabase initialisé.
 *
 * Ordre de lecture des informations de connexion :
 * 1. window.__env?.SUPABASE_URL / SUPABASE_ANON_KEY (optionnel, injection côté index.html)
 * 2. meta tags <meta name="supabase-url" content="..."> et <meta name="supabase-anon-key" content="...">
 *
 * Remarque : pour la sécurité, préférez fournir les variables via les fichiers d'environnement build-time
 * ou via un mécanisme sécurisé côté serveur. Ce service assume que la clé anonyme est OK côté client.
 */

@Injectable({ providedIn: 'root' })
export class NgSupabaseService {
  private client: SupabaseClient | null = null;

  constructor() {
    const { url, key } = this.resolveConfig();
    if (!url || !key) {
      // Do not throw during construction to allow app to boot; throw when trying to use client instead.
      console.warn('[NgSupabaseService] supabase config not found (url/key). Some features will fail until configured.');
      return;
    }

    this.client = createClient(url, key, {
      // adjust options here if needed (e.g. auth persistence)
      auth: { persistSession: true },
    });
  }

  /** Retourne le client Supabase initialisé ou lance une erreur si absent */
  getClient(): SupabaseClient {
    if (!this.client) {
      const { url, key } = this.resolveConfig();
      throw new Error(`Supabase client not initialized. Missing config. url=${url ? 'yes' : 'no'} key=${key ? 'yes' : 'no'}`);
    }
    return this.client;
  }

  /** Petite API utilitaire : wrapper pour les appels RPC */
  async rpc<T = any>(fn: string, params?: Record<string, unknown>) {
    const client = this.getClient();
    const res = await client.rpc(fn, params as any);
    return res as any as { data: T | null; error: any };
  }

  /** Expose quelques helpers d'auth */
  async signInWithPassword(email: string, password: string) {
    const client = this.getClient();
    return client.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    const client = this.getClient();
    return client.auth.signOut();
  }

  private resolveConfig(): { url?: string; key?: string } {
    // 1) window.__env (convention utile pour injection côté index.html)
    try {
      const win = window as any;
      if (win && win.__env) {
        const url = win.__env.SUPABASE_URL || win.__env.supabaseUrl || win.__env.SUPABASE_API_URL;
        const key = win.__env.SUPABASE_ANON_KEY || win.__env.supabaseAnonKey || win.__env.SUPABASE_ANON;
        if (url && key) return { url, key };
      }
    } catch (e) {
      // ignore
    }

    // 2) meta tags
    try {
      const metaUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || undefined;
      const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || undefined;
      if (metaUrl && metaKey) return { url: metaUrl, key: metaKey };
    } catch (e) {
      // ignore
    }

    // 3) fallback: try window['SUPABASE_URL'] etc.
    try {
      const win = window as any;
      const url = win.SUPABASE_URL || win.supabaseUrl;
      const key = win.SUPABASE_ANON_KEY || win.supabaseAnonKey;
      if (url && key) return { url, key };
    } catch (e) {
      // ignore
    }

    return {};
  }
}
