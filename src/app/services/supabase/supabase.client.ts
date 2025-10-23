import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Singleton pour initialiser et gérer le client Supabase.
 * Utilitaire pur, sans dépendance Angular.
 */

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
    },
  });
  (globalThis as any).__SB_CLIENTS__[key] = client;
  return client;
}

export function initSupabaseClient(): SupabaseClient {
  const url = environment.supabase.url || readMeta('supabase-url') || '';
  const anon = environment.supabase.anonKey || readMeta('supabase-anon-key') || '';
  
  if (!url || !anon) {
    console.warn('Clés Supabase non trouvées dans les meta tags');
  }
  
  return getOrCreateSupabase(url, anon);
}
