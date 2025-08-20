import { supabase } from "./supabaseClient";

export async function fetchUsersWithPersonnes() {
  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      login_token,
      personnes:personnes!personnes_user_id_fkey (
        nom,
        prenom
      )
    `)
    .order("id", { ascending: true });
  return { data, error };
}

export async function addUser({ nom, prenom, token, createdBy }) {
  const { data, error } = await supabase
    .from("users")
    .insert({ login_token: token, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  const insertedUser = data;
  await supabase.from("personnes").insert({
    nom,
    prenom,
    user_id: insertedUser.id
  });
  return insertedUser;
}

export async function deleteUserCascade(loginToken) {
  // 1. Récupérer user.id à partir du token
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('login_token', loginToken)
    .single();
  if (userErr) throw userErr;
  if (!user) throw new Error("Utilisateur introuvable");

  // 2. Supprimer la personne associée
  await supabase.from('personnes').delete().eq('id', user.id);

  // 3. (optionnel) Supprimer le profile si besoin
  if(user.uuid) {
    await supabase.from('profiles').delete().eq('id', loginToken);
  }

  // 4. Supprimer le user
  await supabase.from('users').delete().eq('login_token', loginToken);

  return true;
}