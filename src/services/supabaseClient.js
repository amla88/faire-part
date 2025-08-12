import env from '../environment';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);