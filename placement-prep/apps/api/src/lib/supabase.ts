import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Prefer explicit server-side secret keys for backend use.
// Fall back to legacy env names where applicable to remain compatible.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl) {
  console.warn('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable.')
}
if (!supabaseKey) {
  console.warn('Missing Supabase key. Prefer SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY for server usage.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  {
    // Server environments should not persist client sessions.
    auth: { persistSession: false, autoRefreshToken: false },
  }
)
