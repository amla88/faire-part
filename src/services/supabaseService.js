import { supabase } from "../services/supabaseClient";

class SupabaseService {
  constructor() {
    this.user = null;
    this.supabase = supabase;
  }

  async signIn(email, password) {
    console.log(supabase);
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    })
    console.log("Réponse Supabase :", data, error);
    if (error) throw error
    return data.user
  }

  async getTechnicalUser() {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user
  }

  getSupabase() {
    return this.supabase
  }

  getUser() {
    return this.user
  }

  async loadUser(uuid) {
    console.log(uuid)
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

  async savePlayerData(data) {
    if (!this.user) throw new Error('Aucun utilisateur connecté')

    const { error } = await this.supabase
      .from('players')
      .upsert({ user_id: this.user.id, save_data: data })

    if (error) throw error
  }

  async loadPlayerData() {
    if (!this.user) throw new Error('Aucun utilisateur connecté')

    const { data, error } = await this.supabase
      .from('players')
      .select('save_data')
      .eq('user_id', this.user.id)
      .single()

    if (error) throw error

    return data.save_data
  }
}

const supabaseService = new SupabaseService()
export default supabaseService