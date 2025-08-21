// src/services/supabaseService.ts
import { supabase } from "./supabaseClient";
import { User } from "@supabase/supabase-js";

interface PlayerData {
  [key: string]: any;
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
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("login_token", loginToken)
      .maybeSingle();

    if (error || !data) {
      this.user = null;
      return null;
    } else {
      this.user = data;
      return data;
    }
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
