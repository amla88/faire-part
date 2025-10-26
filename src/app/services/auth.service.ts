import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NgSupabaseService } from './ng-supabase.service';
import { AvatarService } from './avatar.service';

export interface PersonneSummary {
  id: number;
  nom: string;
  prenom: string;
}

export interface AppUser {
  famille_id: number;
  personne_principale_id?: number;
  personnes?: PersonneSummary[];
  selected_personne_id?: number | null;
  // cache local des avatars par personne
  avatars?: Record<number, { id?: number; seed?: string; options?: any; created_at?: string; updated_at?: string; imageDataUri?: string }>;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly STORAGE_KEY = 'app_user';
  // avatarDataUri is delegated to AvatarService for centralized handling
  public avatarDataUri!: () => string | null;

  constructor(private supabase: NgSupabaseService, private router: Router, private avatar: AvatarService) {
    // expose the avatar signal reference so templates using auth.avatarDataUri() still work
    this.avatarDataUri = this.avatar.avatarDataUri;
  }

  /** Valide le login_token côté DB et persiste l'objet user en localStorage */
  async loginWithToken(token: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    // Backwards-compatible wrapper that delegates to the silent variant
    try {
      const res = await this.loginWithTokenSilent(token);

      if (!res.success) return res;

      // Perform navigation according to personnes count (preserve previous behaviour)
      const user = res.user!;
      if (user.personnes && user.personnes.length > 1) {
        // multiple persons -> selection page
        this.router.navigate(['/person']);
      } else {
        // single or no persons -> go to root (dashboard)
        this.router.navigate(['/']);
      }

      return res;
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  /**
   * Validate a token, persist user in localStorage but DO NOT perform navigation.
   * This is useful for guards/resolvers that need to control navigation themselves.
   */
  async loginWithTokenSilent(token: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    try {
      const client = this.supabase.getClient();
      // Use RPC because RLS on `familles` requires either a JWT with special claims
      // or a SECURITY DEFINER RPC to lookup by token. get_famille_by_token is
      // implemented as SECURITY DEFINER in the DB and returns the matching row.
      const rpcRes = await client.rpc('get_famille_by_token', { p_token: token });
      let data = rpcRes.data as any;
      const error = rpcRes.error;
      // rpc may return an array (SETOF) or a single object depending on the function
      if (Array.isArray(data)) data = data[0] || null;

      if (error) {
        const errMsg = error?.message || (error && JSON.stringify(error)) || 'Erreur lors de la requête';
        return { success: false, error: errMsg };
      }

      if (!data) {
        return { success: false, error: 'Code invalide' };
      }

      // fetch personnes for this family via SECURITY DEFINER RPC to bypass RLS
      // (there is an RLS policy on `personnes` that only allows admin SELECT otherwise)
      const personnesRpc = await client.rpc('get_personnes_by_famille', { p_famille_id: data.id });
      if (personnesRpc.error) {
        console.error('[AuthService] personnes rpc error', personnesRpc.error);
        const errMsg = personnesRpc.error?.message || (personnesRpc.error && JSON.stringify(personnesRpc.error)) || 'Erreur lors de la récupération des personnes';
        return { success: false, error: errMsg };
      }
      const personnesData = personnesRpc.data as any[] | null;
      const personnes: PersonneSummary[] = (personnesData || []).map((p: any) => ({ id: p.id, nom: p.nom, prenom: p.prenom }));

      // Précharger les avatars pour chaque personne (via RPC sécurisé) et les attacher au user
      const avatarsMap: Record<number, any> = {};
      try {
        for (const p of personnes) {
          try {
            const avatarRpc = await client.rpc('get_avatar_for_token', { p_token: token, p_personne_id: p.id });
            if (avatarRpc.error) {
              // ignore error for this personne
              continue;
            }
            let avatarData = avatarRpc.data as any;
            if (Array.isArray(avatarData)) avatarData = avatarData[0] || null;
            if (avatarData) {
              avatarsMap[p.id] = {
                id: avatarData.id,
                seed: avatarData.seed,
                options: avatarData.options,
                created_at: avatarData.created_at,
                updated_at: avatarData.updated_at,
              };
            }
          } catch (e) {
            // per-person rpc failure - continue
            console.error('[AuthService] avatar rpc error for personne', p.id, e);
          }
        }
      } catch (e) {
        // overall avatars fetch issue - continue silently
        console.error('[AuthService] avatars prefetch error', e);
      }

      const user: AppUser = {
        famille_id: data.id,
        personne_principale_id: data.personne_principale || undefined,
        personnes,
        selected_personne_id: personnes.length === 1 ? personnes[0].id : null,
        avatars: Object.keys(avatarsMap).length ? avatarsMap : undefined,
      };

      // persist user and token locally so client can call token-based RPCs
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      try {
        localStorage.setItem('app_token', token);
      } catch {
        // ignore
      }

      // initialize avatar service from the loaded user (sets signal if available)
      try {
        this.avatar.initFromUser(user);
      } catch {}

      return { success: true, user };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    try {
      localStorage.removeItem('app_token');
    } catch {}
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  getUser(): AppUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  }

  /** Retourne le token d'invitation persisté (ou null) */
  getToken(): string | null {
    return localStorage.getItem('app_token');
  }

  /**
   * Sélectionne une personne dans l'objet user et persiste la sélection.
   * Récupère aussi l'avatar associé via RPC et le met en cache dans l'objet user.
   */
  async selectPerson(personneId: number): Promise<void> {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return;

    let user: AppUser;
    try {
      user = JSON.parse(raw) as AppUser;
    } catch {
      return;
    }

    user.selected_personne_id = personneId;
    // persist selection immediately
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));

    // If we already have an image cached for this personne, avoid blocking RPC.
    // We still trigger a background refresh to keep metadata up-to-date.
    try {
      const cached = this.avatar.getAvatarDataUri(personneId);
      if (cached) {
        // non-blocking refresh
        this.avatar.loadAvatarFromRpc(personneId).catch((err) => {
          console.debug('Avatar background refresh failed', err);
        });
        return;
      }

      // no cached image -> load synchronously so UI can update when available
      await this.avatar.loadAvatarFromRpc(personneId);
    } catch (err) {
      console.error('AuthService.selectPerson: erreur AvatarService.loadAvatarFromRpc', err);
    }
  }

  /**
   * Met à jour le cache d'avatar dans l'objet user pour la personne donnée.
   * Utilisé après un upsert réussi.
   */
  setAvatarInCache(personneId: number, avatarRow: any): void {
    // backward-compatible facade -> delegate to AvatarService
    this.avatar.setAvatarInCache(personneId, avatarRow);
  }

  /** Retourne le data URI PNG de l'avatar mis en cache pour la personne, ou null */
  getAvatarDataUri(personneId?: number | null): string | null {
    return this.avatar.getAvatarDataUri(personneId);
  }
}
