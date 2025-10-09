import { Injectable } from '@angular/core';
import { NgSupabaseService } from './supabase.service';

export interface AdminStats {
  rsvp_total: number;
  rsvp_apero: number;
  rsvp_repas: number;
  rsvp_soiree: number;
  photos_pending: number;
  photos_approved: number;
  photos_rejected: number;
  musiques_pending: number;
  musiques_approved: number;
  musiques_rejected: number;
}

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  constructor(private api: NgSupabaseService) {}

  async getStats(): Promise<AdminStats> {
    // 1) Essayer la RPC si elle existe
    try {
      const { data } = await this.api.supabase.rpc('get_stats_admin');
      if (data) return data as AdminStats;
    } catch {
      // ignore, fallback below
    }

    // 2) Fallback: compter via SELECT head=true
    const s: AdminStats = {
      rsvp_total: 0,
      rsvp_apero: 0,
      rsvp_repas: 0,
      rsvp_soiree: 0,
      photos_pending: 0,
      photos_approved: 0,
      photos_rejected: 0,
      musiques_pending: 0,
      musiques_approved: 0,
      musiques_rejected: 0,
    };

    // RSVP
    try {
      const { count: ct } = await this.api.supabase
        .from('rsvp')
        .select('*', { count: 'exact', head: true });
      s.rsvp_total = ct || 0;
    } catch {}
    try {
      const { count: ct } = await this.api.supabase
        .from('rsvp')
        .select('*', { count: 'exact', head: true })
        .eq('pour_apero', true);
      s.rsvp_apero = ct || 0;
    } catch {}
    try {
      const { count: ct } = await this.api.supabase
        .from('rsvp')
        .select('*', { count: 'exact', head: true })
        .eq('pour_repas', true);
      s.rsvp_repas = ct || 0;
    } catch {}
    try {
      const { count: ct } = await this.api.supabase
        .from('rsvp')
        .select('*', { count: 'exact', head: true })
        .eq('pour_soiree', true);
      s.rsvp_soiree = ct || 0;
    } catch {}

    // Photos (si table présente)
    try {
      const { count: p0 } = await this.api.supabase.from('photos').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: p1 } = await this.api.supabase.from('photos').select('*', { count: 'exact', head: true }).eq('status', 'approved');
      const { count: p2 } = await this.api.supabase.from('photos').select('*', { count: 'exact', head: true }).eq('status', 'rejected');
      s.photos_pending = p0 || 0; s.photos_approved = p1 || 0; s.photos_rejected = p2 || 0;
    } catch {}

    // Musiques: préférer la table music_preferences (utilisée côté React)
    try {
      // Essayer avec colonne status si elle existe
      const { count: m0 } = await this.api.supabase.from('music_preferences').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: m1 } = await this.api.supabase.from('music_preferences').select('*', { count: 'exact', head: true }).eq('status', 'approved');
      const { count: m2 } = await this.api.supabase.from('music_preferences').select('*', { count: 'exact', head: true }).eq('status', 'rejected');
      s.musiques_pending = m0 || 0; s.musiques_approved = m1 || 0; s.musiques_rejected = m2 || 0;
    } catch {
      // Fallback: pas de colonne status -> compter total en pending
      try {
        const { count: total } = await this.api.supabase.from('music_preferences').select('*', { count: 'exact', head: true });
        s.musiques_pending = total || 0;
        s.musiques_approved = 0;
        s.musiques_rejected = 0;
      } catch {
        // Dernier fallback: ancienne table "musiques" si elle existe encore
        try {
          const { count: m0 } = await this.api.supabase.from('musiques').select('*', { count: 'exact', head: true }).eq('status', 'pending');
          const { count: m1 } = await this.api.supabase.from('musiques').select('*', { count: 'exact', head: true }).eq('status', 'approved');
          const { count: m2 } = await this.api.supabase.from('musiques').select('*', { count: 'exact', head: true }).eq('status', 'rejected');
          s.musiques_pending = m0 || 0; s.musiques_approved = m1 || 0; s.musiques_rejected = m2 || 0;
        } catch {}
      }
    }

    return s;
  }
}
