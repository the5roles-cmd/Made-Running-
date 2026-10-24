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
// ── VITE_PUBLIC_DOORS: the escape hatch this comment used to warn against ───
//
// Above, in October 2026, this file argued hard for DEV over an env var,
// because "an env var is something a person can set on Vercel one afternoon
// and silently un-strip the live site", and offered the one-line change if it
// were ever actually needed. It was needed, so here it is — but read the
// argument above as still standing, because it was right.
//
// Why it was needed: the club's site must stay stripped, AND a complete,
// clickable version has to be sendable to prospects as a URL. A dev server
// cannot be emailed. That is a second DEPLOYED build, which DEV cannot
// express, because DEV is false in every build by design.
//
// So the rule is no longer "no deployed build shows the doors" but:
//
//   made-running-platform (maderunning.co.uk)  → variable NOT set → stripped
//   the prospect demo project                   → VITE_PUBLIC_DOORS=1 → full
//
// which is weaker, because it now depends on a dashboard staying untouched
// rather than on a literal that cannot be set. Two things narrow that back:
//
//   1. The demo build carries no Supabase credentials at all, so "doors open"
//      there means doors onto an empty demo, not onto the club's data.
//   2. vite.config.js refuses to BUILD the actually-dangerous combination —
//      doors open + a real database + registration on, i.e. the one that lets
//      strangers mint orgs in the club's Postgres. Setting this variable on
//      the club's project fails the build instead of publishing the funnel.
//
// That second guard is the point. The risk was never the buttons; it was what
// pressing them writes. See assertSafeDoorsBuild() in vite.config.js.
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
export const LOCAL_ONLY =
  import.meta.env.DEV || import.meta.env.VITE_PUBLIC_DOORS === '1'
