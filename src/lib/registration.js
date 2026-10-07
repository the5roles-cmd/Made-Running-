// ── Who is allowed to create a website account ──────────────────────────────
//
// Two different things in this app are both called "signing up", and only one
// of them is governed by this file:
//
//   /join   → register_runner RPC → a row in `records`. A person joins the
//             CLUB. No auth.users row, no password, no CRM access, ever.
//             Not affected by this flag.
//   /login  → supabase.auth.signUp → a real auth.users row, a workspace, and
//             access to everything behind /app. A person joins the WEBSITE.
//             This is what the flag closes.
//
// With REGISTRATION_OPEN false the Create account tab disappears and the
// signup branch of the submit handler refuses to run, so /login becomes a
// sign-in-only door and accounts exist only where somebody with access made
// them. With it true the tab, the profile fields and the signup branch all
// come back.
//
// ⚠️  THIS IS ONLY EVER A UI SWITCH, IN BOTH DIRECTIONS.
// Supabase's POST /auth/v1/signup endpoint is part of the hosted API and does
// not know this constant exists. Setting this false does not stop anyone
// creating an account with a single curl against the project URL and the
// public anon key — which is public by design, it ships in the bundle. And
// setting it true does not by itself make signup work: if the dashboard
// switch is off, the Create account tab will render and then fail with a raw
// API error. The matching setting is:
//
//   Supabase → Authentication → Sign In / Providers → "Allow new users to
//   sign up"
//
// Keep the two in agreement. This constant decides what the UI offers and
// promises; the dashboard setting decides what the server actually permits.
export const REGISTRATION_OPEN = true
