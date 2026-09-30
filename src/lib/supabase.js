import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly at startup instead of with confusing network errors later.
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.error(
    'Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

/**
 * The single Supabase client for the app.
 * Uses the public anon key: every request runs as the logged-in user,
 * so Row Level Security decides what each user can read or change.
 * Only src/services/* should import this.
 */
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: {
    persistSession: true, // stores the session in localStorage → survives page refresh
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for invite / password-reset links
  },
})
