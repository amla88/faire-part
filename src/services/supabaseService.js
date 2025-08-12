// src/services/supabaseService.js
import { supabase } from "../services/supabaseClient";

class SupabaseService {
  constructor() {
    this.user = null;
    this.supabase = supabase;
  }

  async signIn(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data.user;
  }

  async getTechnicalUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  getSupabase() {
    return this.supabase;
  }

  getUser() {
    return this.user;
  }

  setUser(userObj) {
    this.user = userObj;
  }

  // Charge un user en recherchant auth_uuid (ancienne méthode déjà présente)
  async loadUser(uuid) {
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

  // <-- NOUVELLE méthode : charge le user via login_token (pour les invités)
  async loadUserByLoginToken(loginToken) {
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

  async savePlayerData(data) {
    if (!this.user) throw new Error('Aucun utilisateur connecté');

    const { error } = await this.supabase
      .from('players')
      .upsert({ user_id: this.user.id, save_data: data });

    if (error) throw error;
  }

  async loadPlayerData() {
    if (!this.user) throw new Error('Aucun utilisateur connecté');

    const { data, error } = await this.supabase
      .from('players')
      .select('save_data')
      .eq('user_id', this.user.id)
      .single();

    if (error) throw error;

    return data.save_data;
  }
}

const supabaseService = new SupabaseService();
export default supabaseService;
