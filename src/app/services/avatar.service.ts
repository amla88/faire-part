import { Injectable, signal } from '@angular/core';
import { NgSupabaseService } from './ng-supabase.service';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

export interface AvatarRow {
  id?: number;
  seed?: string | null;
  options?: any | null;
  created_at?: string | null;
  updated_at?: string | null;
  imageDataUri?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly STORAGE_KEY = 'app_user';

  // signal exposed for templates: auth.avatarDataUri() is still supported via delegation
  public avatarDataUri = signal<string | null>(null);

  /**
   * Génère une dataURI PNG via DiceBear pour le style/seed/size donnés.
   * Retourne null en cas d'erreur.
   */
  public generateDataUri(options?: any): string | null {
    try {
      const avatar = createAvatar(avataaars, options);
      return avatar.toDataUri();
    } catch {
      return null;
    }
  }

  constructor(private supabase: NgSupabaseService) {
    // initialize from local storage if possible
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const user = JSON.parse(raw) as any;
      const selected = user?.selected_personne_id ?? null;
      const img =
        selected != null ? this.getCachedAvatarEntry(selected)?.imageDataUri ?? null : null;
      if (img) this.avatarDataUri.set(img);
    } catch {
      // ignore
    }
  }

  private readUser(): any | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private writeUser(user: any): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('AvatarService.writeUser error', e);
    }
  }

  /**
   * Résout une entrée avatar dans le cache (localStorage sérialise les clés d'objet en string :
   * `avatars[5]` peut échouer si la clé stockée est `"5"` selon le chemin d'écriture).
   */
  private getCachedAvatarEntry(personneId: unknown): AvatarRow | null {
    const u = this.readUser();
    if (!u?.avatars || personneId == null || personneId === '') return null;
    const av = u.avatars as Record<string, AvatarRow>;
    const n = Number(personneId);
    if (Number.isFinite(n)) {
      const hit = av[n] ?? av[String(n)];
      if (hit) return hit;
    }
    return av[String(personneId)] ?? null;
  }

  /** Retourne le data URI PNG mis en cache pour la personne */
  getAvatarDataUri(personneId?: number | null | string | bigint): string | null {
    if (personneId == null || personneId === '') return null;
    const entry = this.getCachedAvatarEntry(personneId);
    const uri = entry?.imageDataUri;
    if (uri == null) return null;
    const t = String(uri).trim();
    return t.length > 0 ? t : null;
  }

  /** Met à jour le cache d'avatar dans l'objet user pour la personne donnée. */
  setAvatarInCache(personneId: number, avatarRow: AvatarRow): void {
    const user = this.readUser();
    if (!user) return;
    const pid = Number(personneId);
    if (!Number.isFinite(pid)) return;
    user.avatars = user.avatars || {};
    // preserve existing cached fields (notably imageDataUri) when incoming row
    // doesn't include them. This prevents overwriting a client-generated PNG
    // stored in localStorage with a null from the RPC.
    const existing = user.avatars[pid] ?? user.avatars[String(pid)] ?? {};
    user.avatars[pid] = {
      id: avatarRow.id ?? existing.id ?? undefined,
      seed: avatarRow.seed ?? existing.seed ?? undefined,
      options: avatarRow.options ?? existing.options ?? undefined,
      created_at: avatarRow.created_at ?? existing.created_at ?? undefined,
      updated_at: avatarRow.updated_at ?? existing.updated_at ?? undefined,
      // keep previous imageDataUri if new row doesn't provide one
      imageDataUri: avatarRow.imageDataUri ?? existing.imageDataUri ?? undefined,
    };
    this.writeUser(user);

    try {
      if (Number(user.selected_personne_id) === pid) {
        const img = user.avatars[pid].imageDataUri;
        if (img) this.avatarDataUri.set(img);
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Supprime l'entrée avatar en cache (localStorage) pour cette personne.
   * À appeler lorsque la base ne contient plus de ligne `avatars` pour cet id.
   */
  removeAvatarFromCache(personneId: number): void {
    const user = this.readUser();
    if (!user?.avatars) return;
    const pid = Number(personneId);
    if (!Number.isFinite(pid)) return;
    delete user.avatars[pid];
    delete user.avatars[String(pid)];
    if (Object.keys(user.avatars).length === 0) {
      delete user.avatars;
    }
    this.writeUser(user);
    if (Number(user.selected_personne_id) === pid) {
      this.avatarDataUri.set(null);
    }
  }

  /** Charge l'avatar depuis le RPC sécurisé et l'enregistre en cache */
  async loadAvatarFromRpc(personneId: number): Promise<AvatarRow | null> {
    const token = localStorage.getItem('app_token');
    if (!token) return null;
    try {
      const client = this.supabase.getClient();
      const rpcRes = await client.rpc('get_avatar_for_token', { p_token: token, p_personne_id: personneId });
      if (rpcRes.error) {
        return null;
      }
      let data: any = rpcRes.data;
      if (Array.isArray(data)) data = data[0] || null;
      /* Pas de ligne en base (ou réponse vide) : invalider le cache local */
      if (!data || data.id == null) {
        this.removeAvatarFromCache(personneId);
        return null;
      }
      // build a row but avoid forcing imageDataUri to null if RPC doesn't return it.
      const rowFromRpc: AvatarRow = {
        id: data.id,
        seed: data.seed ?? null,
        options: data.options ?? null,
        created_at: data.created_at ?? null,
        updated_at: data.updated_at ?? null,
        // do NOT set imageDataUri to null here if absent; keep undefined to allow
        // setAvatarInCache to preserve any existing client-side image.
        imageDataUri: data.imageDataUri !== undefined ? data.imageDataUri : undefined,
      };

      // If RPC returned seed/options but no imageDataUri, generate a preview client-side
      try {
        if (!rowFromRpc.imageDataUri && rowFromRpc.options) {
          const generated = this.generateDataUri(rowFromRpc.options);
          if (generated) rowFromRpc.imageDataUri = generated;
        }
      } catch {
        // ignore preview generation failures
      }

      this.setAvatarInCache(personneId, rowFromRpc);
      // return merged entry (read from cache) so callers get the effective state
      return this.getCachedAvatarEntry(personneId);
    } catch (e) {
      console.error('AvatarService.loadAvatarFromRpc error', e);
      return null;
    }
  }

  /** Appelle le RPC 'upsert_avatar_for_token' puis met en cache le résultat. imageDataUri est optionnel (généré côté client si présent). */
  async saveAvatar(seed: string | null, options: any | null, personneId: number, imageDataUri?: string | null): Promise<AvatarRow | null> {
    const token = localStorage.getItem('app_token');
    if (!token) return null;
    try {
      const client = this.supabase.getClient();
      const rpcRes = await client.rpc('upsert_avatar_for_token', { p_token: token, p_personne_id: personneId, p_seed: seed, p_options: options });
      if (rpcRes.error) {
        console.error('AvatarService.saveAvatar RPC error', rpcRes.error);
        return null;
      }
      let data: any = rpcRes.data;
      if (Array.isArray(data)) data = data[0] || null;
      if (!data) return null;
      const row: AvatarRow = {
        id: data.id,
        seed: data.seed || null,
        options: data.options || null,
        created_at: data.created_at || null,
        updated_at: data.updated_at || null,
        imageDataUri: imageDataUri || (data.imageDataUri || null),
      };
      this.setAvatarInCache(personneId, row);
      return row;
    } catch (e) {
      console.error('AvatarService.saveAvatar error', e);
      return null;
    }
  }

  /** Optionnel: initialiser le service à partir d'un AppUser déjà chargé afin d'éviter duplication */
  initFromUser(user: any | null): void {
    try {
      if (!user) return;
      // For each cached avatar entry, generate a preview image if missing.
      const avatars = user.avatars || {};

      let updated = false;
      for (const k of Object.keys(avatars)) {
        const id = Number(k);
        const entry = avatars[id] || avatars[k];
        if (!entry || entry.imageDataUri) continue;

        try {
          if (entry.options) {
            const generated = this.generateDataUri(entry.options);
            if (generated) {
              entry.imageDataUri = generated;
              avatars[id] = entry;
              updated = true;
            }
          }
        } catch {
          // ignore generation failures for individual entries
        }
      }

      if (updated) {
        user.avatars = avatars;
        this.writeUser(user);
      }

      // set current avatar signal if selected personne has image
      const selected = user?.selected_personne_id ?? null;
      const img =
        selected != null ? this.getCachedAvatarEntry(selected)?.imageDataUri ?? null : null;
      if (img) this.avatarDataUri.set(img);
    } catch (err) {
      console.error('AvatarService.initFromUser error', err);
    }
  }
}
