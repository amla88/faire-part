import { Injectable } from '@angular/core';
import { NgSupabaseService } from './supabase.service';

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export interface PhotoRow {
  id?: number;
  path: string;
  url?: string;
  status?: PhotoStatus;
  author?: string | null;
  created_at?: string;
}

const BUCKET = 'photos';

@Injectable({ providedIn: 'root' })
export class PhotoGalleryService {
  constructor(private api: NgSupabaseService) {}

  getPublicUrl(path: string): string {
    const { data } = this.api.supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  private extOf(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i) : '';
  }

  async upload(file: File, author?: string | null): Promise<PhotoRow> {
    const ext = this.extOf(file.name).toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    const { error: upErr } = await this.api.supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;
    const url = this.getPublicUrl(path);
    // Enregistrer métadonnées via RPC si dispo, sinon table directe
    try {
      const { error } = await this.api.supabase.rpc('submit_photo', { p_file_path: path, p_author: author ?? null });
      if (error) throw error;
    } catch {
      try {
        await this.api.supabase.from('photos').insert({ path, url, status: 'pending', author: author ?? null } as any);
      } catch { /* table absente: ignorer */ }
    }
    return { path, url, status: 'pending', author: author ?? null };
  }

  async listApproved(): Promise<PhotoRow[]> {
    // Essayer via table
    try {
      const { data } = await this.api.supabase.from('photos').select('*').eq('status', 'approved').order('created_at', { ascending: false });
      if (Array.isArray(data)) return data as PhotoRow[];
    } catch {}
    // Fallback: lister le bucket
    const { data: files } = await this.api.supabase.storage.from(BUCKET).list('', { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' as any } });
    return (files || []).map(f => ({ path: f.name, url: this.getPublicUrl(f.name), status: 'approved' }));
  }

  async listApprovedPaged(limit: number, offset: number): Promise<{ items: PhotoRow[]; hasMore: boolean }> {
    // Table d'abord, avec range
    try {
      const from = offset;
      const to = offset + limit - 1;
      let q = this.api.supabase.from('photos').select('*').eq('status', 'approved').order('created_at', { ascending: false }).range(from, to);
      const { data } = await q;
      const rows = (data as PhotoRow[]) || [];
      return { items: rows, hasMore: rows.length === limit };
    } catch {}
    // Fallback storage
    const { data: files } = await this.api.supabase.storage.from(BUCKET).list('', { limit, offset, sortBy: { column: 'created_at', order: 'desc' as any } });
    const rows = (files || []).map(f => ({ path: f.name, url: this.getPublicUrl(f.name), status: 'approved' as const }));
    return { items: rows, hasMore: rows.length === limit };
  }

  async adminList(filter: 'all' | PhotoStatus = 'all'): Promise<PhotoRow[]> {
    try {
      let q = this.api.supabase.from('photos').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = (q as any).eq('status', filter);
      const { data } = await q;
      if (Array.isArray(data)) return data as PhotoRow[];
    } catch {}
    // Fallback storage
    const { data: files } = await this.api.supabase.storage.from(BUCKET).list('', { limit: 100 });
    return (files || []).map(f => ({ path: f.name, url: this.getPublicUrl(f.name) }));
  }

  async setStatus(id: number, status: PhotoStatus): Promise<void> {
    try {
      const { error } = await this.api.supabase.rpc('set_photo_status', { p_id: id, p_status: status });
      if (error) throw error;
    } catch {
      const { error } = await this.api.supabase.from('photos').update({ status } as any).eq('id', id);
      if (error) throw error;
    }
  }

  async remove(row: PhotoRow): Promise<void> {
    try { if (row.path) await this.api.supabase.storage.from(BUCKET).remove([row.path]); } catch {}
    if (row.id) {
      const { error } = await this.api.supabase.from('photos').delete().eq('id', row.id);
      if (error) throw error;
    }
  }
}
