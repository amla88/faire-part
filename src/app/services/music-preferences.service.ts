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
      const { error } = await this.api.supabase.from('music_preferences').insert([pref as any]);
      if (error) throw error;
    }
  }

  async listAll(): Promise<any[]> {
    const { data, error } = await this.api.supabase
      .from('music_preferences')
      .select('*')
      .order('id', { ascending: false });
    if (error) throw error;
    return data as any[];
  }

  async listByStatus(status: MusicStatus): Promise<any[]> {
    const { data, error } = await this.api.supabase
      .from('music_preferences')
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
        .from('music_preferences')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.api.supabase
      .from('music_preferences')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
