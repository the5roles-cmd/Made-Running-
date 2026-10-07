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

// ============================================================
// Network-level failures, translated out of browser dialect
// ============================================================
// When fetch() cannot complete at the transport layer it rejects with a bare
// TypeError and a message that is useless to a member: "Failed to fetch" in
// Chrome, "Load failed" in Safari, "NetworkError when attempting to fetch
// resource" in Firefox. Supabase does not wrap these — a transport failure
// never reaches its error-shaping code — so whatever the browser said travels
// all the way to the screen unless something catches it here.
//
// The three strings below are the whole detectable surface. There is nothing
// else to match on: the spec deliberately collapses DNS misses, CORS
// rejections, TLS failures and a pulled network cable into one opaque error,
// so that a page cannot use fetch timings to probe the machine it is running
// on. We cannot recover the cause, only the category.
const NETWORK_FAILURE = /failed to fetch|load failed|networkerror|fetch failed/i

/**
 * True when `err` is a transport failure rather than a reply from Supabase.
 *
 * Checks the constructor as well as the text: a genuine transport failure is
 * always a TypeError, whereas a *server* error carrying a similar phrase is
 * an ordinary Error. Without that guard, a 500 whose body happened to read
 * "upstream fetch failed" would be mislabelled as "you are offline" and the
 * real fault would be hidden.
 */
export function isNetworkError(err) {
  if (!err) return false
  return err instanceof TypeError && NETWORK_FAILURE.test(err.message || '')
}

/**
 * Turn any thrown value into a sentence worth showing a member.
 *
 * navigator.onLine is the one extra signal available, and it is worth using
 * precisely because it is trustworthy in the FALSE direction: the browser
 * only reports offline when the OS says there is no route at all, so a false
 * reading means the fault is at the member's end and telling them to check
 * their connection is correct and actionable. A true reading proves nothing —
 * a captive portal and a deleted backend both look "online" — so that branch
 * stays honest and says the club's system is unreachable rather than blaming
 * a connection that is probably fine.
 */
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  if (isNetworkError(err)) {
    return navigator.onLine === false
      ? 'You appear to be offline. Check your connection and try again.'
      : "Can't reach the club's booking system right now. Please try again in a moment."
  }
  return err?.message || fallback
}
