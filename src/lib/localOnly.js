// ── "Show it on my machine, never on the website" ───────────────────────────
//
// One question, asked by four flags: CRM_PUBLIC, JOIN_PUBLIC, REGISTRATION_OPEN
// and SHOW_QUICK_PATHS. In October 2026 the club asked for the public site to
// stop offering the CRM, stop asking people to join, and stop showing the quick
// cards — maderunning.co.uk is now the film, the slogan and the club's story.
// But the full site still has to exist somewhere runnable, to work on, to demo,
// and to show the club what the switched-off version looks like beside it.
//
// So the flags are no longer hardcoded false. They are false ON THE WEBSITE and
// true ON A DEV SERVER, and this constant is the one place that decides which.
//
//   npm run dev   → vite dev server on :4970 → LOCAL_ONLY true  → everything
//   npm run build → anything Vercel serves   → LOCAL_ONLY false → stripped
//
// ── Why import.meta.env.DEV and not an env var ──────────────────────────────
// Vite replaces import.meta.env.DEV with a LITERAL at build time, so in every
// production bundle this constant IS false — not "defaults to false", not
// "false unless configured". There is no value anyone can set on Vercel, in a
// shell, or in a .env file that makes a deployed build say otherwise, which is
// the whole reason it was chosen over a VITE_PUBLIC_DOORS=1 in .env.local. An
// env var is something a person can set one afternoon and silently un-strip
// the live site. This cannot be set at all.
//
// ⚠️  WHAT THIS DOES *NOT* MEAN: "the buttons are not in the bundle".
// Measured, Oct 2026, not assumed — the strings "Get started" and "Join the
// Community" are still present in dist/assets/index-*.js after a production
// build. Vite inlines the literal inside THIS module, but the bundler does not
// propagate an imported constant across a module boundary and delete the JSX
// branch that reads it. So the branches ship as unreachable code: they never
// execute, they render nothing, and a browser can never reach them — but they
// are readable in the file. That is a few hundred bytes and zero secrets (the
// same labels are in git history and were on the live site last week), so it
// is not worth engineering around. It IS worth writing down, because the
// neighbouring file used to claim the opposite and the claim was wrong.
//
// The cost of being wrong in the other direction is the one that matters, and
// it is covered: the switch is statically false, so nothing renders.
//
// A VITE_PUBLIC_DOORS=1 in .env.local would also have worked, and would have
// covered `npm run preview` as well, which this does not: preview serves a
// production build, so it correctly shows the stripped site. That was the
// deciding trade-off. An env var is something a person can set on Vercel one
// afternoon and silently un-strip the live site; DEV is false in EVERY build
// there has ever been, including a dist/ someone drags into a host by hand.
// If you do want a local production build to show the doors, say so and this
// becomes `import.meta.env.DEV || import.meta.env.VITE_PUBLIC_DOORS === '1'`
// — one line, and the comment above is the reason to think twice first.
//
// ⚠️  LOCAL DOES NOT MEAN A LOCAL DATABASE.
// .env.local points VITE_SUPABASE_URL at the club's REAL Supabase project.
// Running the dev server does not give you a sandbox: a booking made at
// localhost:4970 is a booking in the club's live data, and the Create account
// tab this flag switches back on still calls the real auth API. See the note
// on create_org in src/lib/registration.js before pressing it.
//
// ⚠️  IT IS STILL NOT A SECURITY BOUNDARY.
// Everything these flags hide is hidden from a BROWSER, and that is all. RLS,
// the SECURITY DEFINER functions and RequireAuth/RequireStaff are what protect
// the club's data, and none of them read this file.
export const LOCAL_ONLY = import.meta.env.DEV
