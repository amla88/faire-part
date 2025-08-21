import { supabase } from "./supabaseClient";

interface Avatar {
  id?: number;
  personne_id: string;
  [key: string]: any; // pour les autres propriétés dynamiques de l'avatar
}

interface SupabaseResponse<T> {
  data: T | null;
  error: any;
}

export async function getAvatar(personne_id: string): Promise<SupabaseResponse<Avatar>> {
  const { data, error } = await supabase
    .from<Avatar>('avatars')
    .select('*')
    .eq('personne_id', personne_id)
    .maybeSingle();
  return { data, error };
}

export async function upsertAvatar(personne_id: string, avatarData: Partial<Avatar>) {
  // Vérifie si l'avatar existe
  const { data: existing } = await supabase
    .from<Avatar>('avatars')
    .select('id')
    .eq('personne_id', personne_id)
    .maybeSingle();

  if (existing) {
    // Mise à jour
    return await supabase
      .from<Avatar>('avatars')
      .update(avatarData)
      .eq('id', existing.id);
  } else {
    // Création
    return await supabase
      .from<Avatar>('avatars')
      .insert([{ personne_id, ...avatarData }]);
  }
}
