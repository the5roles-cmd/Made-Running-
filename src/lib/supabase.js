// ============================================================
// Supabase browser client. Uses the ANON key only (browser-safe).
// Row-Level Security enforces org isolation server-side.
// `supabaseConfigured` is false when env vars are missing or are
// still .env.example placeholders → the app shows <SetupNotice>
// instead of crashing.
// ============================================================
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Treat placeholder values (empty, "your...", contains "...") as unset.
const isPlaceholder = (v) =>
  !v || v.includes('...') || v.toLowerCase().startsWith('your') || v.includes('example.supabase')

export const supabaseConfigured = !isPlaceholder(url) && !isPlaceholder(anon)

export const supabase = supabaseConfigured
  ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

// Postgres "relation does not exist" — surfaces a "run the SQL" hint.
export const TABLE_MISSING = '42P01'
