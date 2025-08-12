import { supabase } from "../services/supabaseClient";

export async function getAvatar(personne_id) {
  const { data, error } = await supabase
    .from('avatars')
    .select('*')
    .eq('personne_id', personne_id)
    .maybeSingle();
  return { data, error };
}

export async function upsertAvatar(personne_id, avatarData) {
  // Vérifie si l'avatar existe
  const { data: existing } = await supabase
    .from('avatars')
    .select('id')
    .eq('personne_id', personne_id)
    .maybeSingle();

  if (existing) {
    // Mise à jour
    return await supabase
      .from('avatars')
      .update(avatarData)
      .eq('id', existing.id);
  } else {
    // Création
    return await supabase
      .from('avatars')
      .insert([{ personne_id, ...avatarData }]);
  }
}