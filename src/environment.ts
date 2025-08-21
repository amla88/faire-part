interface EnvConfig {
  basePath: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const environment: EnvConfig = {
  basePath: import.meta.env.VITE_BASE_PATH || '/',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export default environment;
