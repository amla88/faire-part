export function testEnvVars() {
  console.log('--- TEST VARIABLES D’ENVIRONNEMENT ---')
  console.log('VITE_SUPABASE_URL =', import.meta.env.VITE_SUPABASE_URL)
  console.log('VITE_SUPABASE_ANON_KEY (début) =', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 10) + '...')
  console.log('NODE_ENV =', import.meta.env.MODE)
  console.log('------------------------------------')
}
