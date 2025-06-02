export default {
  basePath: import.meta.env.VITE_BASE_PATH || '/',
  emailUser: import.meta.env.VITE_EMAIL_USER,
  passwordUser: import.meta.env.VITE_PASSWORD_USER,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};