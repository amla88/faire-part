import { Injectable, inject } from '@angular/core';
import { NgSupabaseService } from './ng-supabase.service';
import { AuthService } from './auth.service';

export interface PhotoUploadResult {
  path: string;
  publicUrl?: string;
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);

  /**
   * Upload une image vers Oracle Object Storage via l'Edge Function `upload-photo`.
   * L'edge signe la requête (S3 SigV4) et enregistre l'entrée via RPC `submit_photo`.
   */
  async uploadGuestPhoto(file: File): Promise<PhotoUploadResult> {
    if (!file) throw new Error('Aucun fichier fourni');

    const user = this.auth.getUser();
    if (!user?.famille_id) throw new Error('Utilisateur non authentifié');

    const { url, key } = this.resolveSupabaseConfig();
    if (!url || !key) throw new Error('Configuration Supabase manquante');

    const token = this.auth.getToken();
    if (!token) throw new Error('Token invité manquant');

    const fd = new FormData();
    fd.append('file', file, file.name);

    const endpoint = `${url.replace(/\/$/, '')}/functions/v1/upload-photo`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'x-app-token': token,
      },
      body: fd,
    });

    let data: any = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const message = data?.error || `Échec de l'upload (HTTP ${res.status})`;
      throw new Error(message);
    }

    // data doit contenir { path, publicUrl? }
    return data as PhotoUploadResult;
  }

  private _safeExt(filename: string): string {
    const idx = filename.lastIndexOf('.');
    if (idx === -1) return '';
    const raw = filename.slice(idx).toLowerCase();
    // whitelisting
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(raw) ? raw : '';
  }

  private resolveSupabaseConfig(): { url?: string; key?: string } {
    try {
      const win = window as any;
      if (win && win.__env) {
        const url = win.__env.SUPABASE_URL || win.__env.supabaseUrl || win.__env.SUPABASE_API_URL;
        const key = win.__env.SUPABASE_ANON_KEY || win.__env.supabaseAnonKey || win.__env.SUPABASE_ANON;
        if (url && key) return { url, key };
      }
    } catch {}
    try {
      const metaUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || undefined;
      const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || undefined;
      if (metaUrl && metaKey) return { url: metaUrl, key: metaKey };
    } catch {}
    try {
      const win = window as any;
      const url = win.SUPABASE_URL || win.supabaseUrl;
      const key = win.SUPABASE_ANON_KEY || win.supabaseAnonKey;
      if (url && key) return { url, key };
    } catch {}
    return {};
  }
}
