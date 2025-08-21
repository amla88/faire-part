// src/services/supabaseClient.ts
import env from '../environment';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey);
