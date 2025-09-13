// src/services/supabaseService.ts
import { supabase } from "./supabaseClient";
import { User } from "@supabase/supabase-js";

interface PlayerData {
  [key: string]: any;
}

export interface PersonneRow {
  id: number;
  nom?: string;
  prenom?: string;
  user_id: number;
}

class SupabaseService {
  private user: any = null;
  private supabase: typeof supabase;

  constructor() {
    this.supabase = supabase;
  }

  async signIn(email: string, password: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data.user;
  }

  async getTechnicalUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user ?? null;
  }

  getSupabase() {
    return this.supabase;
  }

  getUser() {
    return this.user;
  }

  setUser(userObj: any) {
    this.user = userObj;
  }

  async loadUser(uuid: string): Promise<void> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("auth_uuid", uuid)
      .maybeSingle();

    if (error || !data) {
      this.user = null;
    } else {
      this.user = data;
    }
  }

  async loadUserByLoginToken(loginToken: string): Promise<any | null> {
    // Utilise la RPC SECURITY DEFINER pour contourner RLS de façon contrôlée
    const { data, error } = await this.supabase.rpc("get_user_by_token", {
      p_token: loginToken,
    });

    if (error) {
      this.user = null;
      return null;
    }

    // La RPC peut renvoyer un tableau (ROWS) ou une ligne unique selon la définition
    const row = Array.isArray(data) ? (data[0] ?? null) : (data as any ?? null);
    this.user = row || null;
    return this.user;
  }

  async loadPersonneByUserId(userId: number): Promise<PersonneRow | null> {
    // SELECT direct (pas de RPC pour éviter PGRST202 tant que la fonction n'existe pas)
    const { data } = await this.supabase
      .from("personnes")
      .select("id, nom, prenom, user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as PersonneRow) ?? null;
  }

  async savePlayerData(data: PlayerData): Promise<void> {
    if (!this.user) throw new Error("Aucun utilisateur connecté");

    const { error } = await this.supabase
      .from("players")
      .upsert({ user_id: this.user.id, save_data: data });

    if (error) throw error;
  }

  async loadPlayerData(): Promise<PlayerData> {
    if (!this.user) throw new Error("Aucun utilisateur connecté");

    const { data, error } = await this.supabase
      .from("players")
      .select("save_data")
      .eq("user_id", this.user.id)
      .single();

    if (error) throw error;

    return data.save_data;
  }

  async signOut(): Promise<{ error: any | null }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      this.user = null;
      return { error };
    } catch (err) {
      return { error: err };
    }
  }
}

const supabaseService = new SupabaseService();
export default supabaseService;
