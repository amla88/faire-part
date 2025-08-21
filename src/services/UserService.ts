// UserService.ts
import { supabase } from "./supabaseClient";

export interface Personne {
  nom: string;
  prenom: string;
}

export interface User {
  id: number;
  login_token: string;
  personnes?: Personne[];
  uuid?: string; // si présent dans ta table
}

export interface FetchUsersResult {
  data: User[] | null;
  error: Error | null;
}

export async function fetchUsersWithPersonnes(): Promise<FetchUsersResult> {
  const { data, error } = await supabase
    .from<User>("users")
    .select(`
      id,
      login_token,
      personnes:personnes!personnes_user_id_fkey (
        nom,
        prenom
      )
    `)
    .order("id", { ascending: true });

  return { data, error: error ?? null };
}

export interface AddUserParams {
  nom: string;
  prenom: string;
  token: string;
  createdBy: string | number;
}

export async function addUser({ nom, prenom, token, createdBy }: AddUserParams): Promise<User> {
  const { data, error } = await supabase
    .from<User>("users")
    .insert({ login_token: token, created_by: createdBy })
    .select()
    .single();

  if (error || !data) throw error ?? new Error("Erreur lors de l'ajout de l'utilisateur");

  const insertedUser = data;

  await supabase.from("personnes").insert({
    nom,
    prenom,
    user_id: insertedUser.id,
  });

  return insertedUser;
}

export async function deleteUserCascade(loginToken: string): Promise<boolean> {
  // 1. Récupérer user.id à partir du token
  const { data: user, error: userErr } = await supabase
    .from<User>("users")
    .select("id, uuid")
    .eq("login_token", loginToken)
    .single();

  if (userErr) throw userErr;
  if (!user) throw new Error("Utilisateur introuvable");

  // 2. Supprimer la personne associée
  await supabase.from("personnes").delete().eq("user_id", user.id);

  // 3. (optionnel) Supprimer le profil si présent
  if (user.uuid) {
    await supabase.from("profiles").delete().eq("id", user.uuid);
  }

  // 4. Supprimer le user
  await supabase.from("users").delete().eq("login_token", loginToken);

  return true;
}
