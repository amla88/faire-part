import { Injectable, signal } from '@angular/core';
import { NgSupabaseService } from './ng-supabase.service';
import { createAvatar } from '@dicebear/core';
import { personas, avataaars, dylan, openPeeps, pixelArt } from '@dicebear/collection';

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
  // central DiceBear collections map (used by generateDataUri)
  private readonly collectionsMap: Record<string, any> = {
    personas,
    avataaars,
    dylan,
    openPeeps,
    pixelArt,
  };

  /**
   * Génère une dataURI PNG via DiceBear pour le style/seed/size donnés.
   * Retourne null en cas d'erreur.
   */
  public generateDataUri(styleName: string | undefined, seed?: string | null, size = 35): string | null {
    try {
      const style = styleName || 'personas';
      const collection = this.collectionsMap[style] || this.collectionsMap['personas'];
      const avatar = createAvatar(collection as any, { seed: seed ?? undefined, size });
      return avatar.toDataUri();
    } catch (e) {
      console.debug('AvatarService.generateDataUri failed', e);
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
      const img = selected && user?.avatars ? user.avatars[selected]?.imageDataUri || null : null;
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

  /** Retourne le data URI PNG mis en cache pour la personne */
  getAvatarDataUri(personneId?: number | null): string | null {
    if (!personneId) return null;
    const u = this.readUser();
    if (!u || !u.avatars) return null;
    const a = u.avatars[personneId];
    return a?.imageDataUri || null;
  }

  /** Met à jour le cache d'avatar dans l'objet user pour la personne donnée. */
  setAvatarInCache(personneId: number, avatarRow: AvatarRow): void {
    const user = this.readUser();
    if (!user) return;
    user.avatars = user.avatars || {};
    // preserve existing cached fields (notably imageDataUri) when incoming row
    // doesn't include them. This prevents overwriting a client-generated PNG
    // stored in localStorage with a null from the RPC.
    const existing = user.avatars[personneId] || {};
    user.avatars[personneId] = {
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
      if (user.selected_personne_id === personneId) {
        const img = user.avatars[personneId].imageDataUri;
        if (img) this.avatarDataUri.set(img);
      }
    } catch (e) {
      // ignore
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
      if (!data) return null;
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
        const seed = rowFromRpc.seed || (rowFromRpc.options && (rowFromRpc.options as any).seed) || undefined;
        const opts = (rowFromRpc.options as any) || {};
        const styleName = typeof opts.style === 'string' ? opts.style : 'personas';
        const size = typeof opts.size === 'number' ? opts.size : 35;

        const collectionsMap: Record<string, any> = {
          personas,
          avataaars,
          dylan,
          openPeeps,
          pixelArt,
        };
        const collection = collectionsMap[styleName] || personas;

        if (!rowFromRpc.imageDataUri && (rowFromRpc.seed || opts)) {
          const generated = this.generateDataUri(styleName, rowFromRpc.seed ?? undefined, size);
          if (generated) rowFromRpc.imageDataUri = generated;
        }

      } catch (e) {
        console.debug('AvatarService: failed to generate preview', e);
      }

      this.setAvatarInCache(personneId, rowFromRpc);
      // return merged entry (read from cache) so callers get the effective state
      const user = this.readUser();
      const merged = user?.avatars?.[personneId] || null;
      return merged;
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
      const collectionsMap: Record<string, any> = {
        personas,
        avataaars,
        dylan,
        openPeeps,
        pixelArt,
      };

      let updated = false;
      for (const k of Object.keys(avatars)) {
        const id = Number(k);
        const entry = avatars[id] || avatars[k];
        if (!entry) continue;
        // If imageDataUri is already present, skip
        if (entry.imageDataUri) continue;

        const seed = entry.seed ?? undefined;
        const opts = (entry.options as any) || {};
        const styleName = typeof opts.style === 'string' ? opts.style : 'personas';
        const size = typeof opts.size === 'number' ? opts.size : 35;
        const collection = collectionsMap[styleName] || personas;

        try {
          const generated = this.generateDataUri(styleName, seed, size);
          if (generated) {
            entry.imageDataUri = generated;
            avatars[id] = entry;
            updated = true;
          }
        } catch (e) {
          console.debug('AvatarService.initFromUser: generation failed for', id, e);
        }
      }

      if (updated) {
        user.avatars = avatars;
        this.writeUser(user);
      }

      // set current avatar signal if selected personne has image
      const selected = user?.selected_personne_id ?? null;
      const img = selected && user?.avatars ? user.avatars[selected]?.imageDataUri || null : null;
      if (img) this.avatarDataUri.set(img);
    } catch (err) {
      console.error('AvatarService.initFromUser error', err);
    }
  }
}
