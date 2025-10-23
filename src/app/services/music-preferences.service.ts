import { Injectable } from '@angular/core';
import { NgSupabaseService } from './supabase.service';

export interface MusicPreference {
  artist1: string;
  title1: string;
  link1: string;
  comment1: string;
  artist2: string;
  title2: string;
  link2: string;
  comment2: string;
}

export type MusicStatus = 'pending' | 'approved' | 'rejected';

@Injectable({ providedIn: 'root' })
export class MusicPreferencesService {
  constructor(private api: NgSupabaseService) {}

  async submit(pref: MusicPreference): Promise<void> {
    // Essayer la RPC sécurisée si disponible
    try {
      const { error } = await this.api.supabase.rpc('submit_music', { p_value: pref as any });
      if (error) throw error;
      return;
    } catch {
      const rows: any[] = [];
      if (pref.artist1 || pref.title1 || pref.link1 || pref.comment1) {
        rows.push({ auteur: pref.artist1 || null, titre: pref.title1 || null, lien: pref.link1 || null, commentaire: pref.comment1 || null });
      }
      if (pref.artist2 || pref.title2 || pref.link2 || pref.comment2) {
        rows.push({ auteur: pref.artist2 || null, titre: pref.title2 || null, lien: pref.link2 || null, commentaire: pref.comment2 || null });
      }
      if (!rows.length) return;
      const { error } = await this.api.supabase.from('musiques').insert(rows);
      if (error) throw error;
    }
  }

  async listAll(): Promise<any[]> {
    const { data, error } = await this.api.supabase
      .from('musiques')
      .select('*')
      .order('id', { ascending: false });
    if (error) throw error;
    return data as any[];
  }

  async listByStatus(status: MusicStatus): Promise<any[]> {
    const { data, error } = await this.api.supabase
      .from('musiques')
      .select('*')
      .eq('status', status)
      .order('id', { ascending: false });
    if (error) throw error;
    return data as any[];
  }

  async setStatus(id: number, status: MusicStatus): Promise<void> {
    // RPC si dispo
    try {
      const { error } = await this.api.supabase.rpc('set_music_status', { p_id: id, p_status: status });
      if (error) throw error;
      return;
    } catch {
      const { error } = await this.api.supabase
        .from('musiques')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.api.supabase
      .from('musiques')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
