import env from '../environment';
import { createClient } from '@supabase/supabase-js'

class SupabaseService {
  constructor() {
    this.supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    this.user = null;
  }

  async signIn(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data.user
  }

  async getTechnicalUser() {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user
  }

  getlUser() {
    return this.user
  }

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