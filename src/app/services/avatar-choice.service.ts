import { Injectable } from '@angular/core';
import { SupabaseApiService } from './supabase/supabase-api.service';
import type { AvatarCategory } from './avatar-assets.service';

export interface AvatarRow { 
  id: number; 
  personne_id: number; 
}

@Injectable({ providedIn: 'root' })
export class AvatarChoiceService {
  constructor(private api: SupabaseApiService) {}

  async ensureAvatarForPersonne(personne_id: number): Promise<AvatarRow> {
    try {
      const { data } = await this.api.supabase.rpc('ensure_avatar_for_personne', { p_personne_id: personne_id });
      if (data) return data as AvatarRow;
    } catch {
      // Continuer avec la requête directe
    }
    const { data, error } = await this.api.supabase
      .from('avatars')
      .select('id, personne_id')
      .eq('personne_id', personne_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Avatar introuvable et RPC indisponible');
    return data as AvatarRow;
  }

  async getChoices(avatar_id: number): Promise<Array<{ category: AvatarCategory; asset_id: string }>> {
    const { data, error } = await this.api.supabase
      .from('avatar_asset_choices')
      .select('category, asset_id')
      .eq('avatar_id', avatar_id);
    if (error) throw error;
    return (data ?? []) as Array<{ category: AvatarCategory; asset_id: string }>;
  }

  async upsertChoices(avatar_id: number, selections: Partial<Record<AvatarCategory, string>>): Promise<void> {
    const rows = Object.entries(selections)
      .filter(([, v]) => !!v)
      .map(([category, asset_id]) => ({ avatar_id, category, asset_id }));
    if (!rows.length) return;
    const { error } = await this.api.supabase
      .from('avatar_asset_choices')
      .upsert(rows, { onConflict: 'avatar_id,category' });
    if (error) throw error;
  }

  async upsertChoicesRPC(personne_id: number, selections: Partial<Record<AvatarCategory, string>>): Promise<void> {
    const { error } = await this.api.supabase.rpc('upsert_avatar_choices', {
      p_personne_id: personne_id,
      p_selections: selections,
    });
    if (error) throw error;
  }
}
