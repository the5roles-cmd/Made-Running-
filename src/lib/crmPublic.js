import { LOCAL_ONLY } from './localOnly'

// ── Does the public site offer the CRM at all? ───────────────────────────────
//
// Three different things share this one deployment, and only the third is
// "the CRM":
//
//   the marketing site  → /. The club's public page: film, timetable, kit,
//                         proof, the footer panel. What maderunning.co.uk is
//                         FOR.
//   the public doors    → /join, /book, /coaches, /privacy, /booking/:token
//                         and coach-application.html. Real pages that write
//                         real rows, but no account, no password, no
//                         workspace — ever. See register_runner and
//                         book_hub_class, both SECURITY DEFINER.
//   THE CRM             → /login, /reset-password, and everything behind
//                         /app: the workspace, registers, records, sessions,
//                         academy, settings.
//
// With CRM_PUBLIC false, nothing a visitor can click leads to that third
// group. "Log in" leaves the nav, and every call to action that used to pass
// through /login?next=… points straight at its public destination instead. The
// landing page becomes a marketing site that happens to SHARE A DEPLOYMENT
// with a CRM, rather than a front door to one.
//
// ── Why this was worth doing, beyond tidiness ───────────────────────────────
// The four big buttons all pointed at signupHref('/join') — the CRM's CREATE
// ACCOUNT tab. And Login.jsx calls the create_org RPC whenever a fresh signup
// owns zero orgs, which means every stranger who pressed "Get started" on a
// live public domain minted their own workspace inside the club's Supabase
// project. The club never saw those rows (they are a different org, correctly
// walled off by RLS) but they accumulated for ever. Detaching the CRM closes
// that door, which is why REGISTRATION_OPEN went false in the same change —
// see src/lib/registration.js.
//
// ⚠️  THE CRM IS STILL THERE AND STILL WORKS.
// This hides the doors; it does not brick them. /login, /reset-password and
// /app stay routable, so staff reach the workspace by typing the URL or using
// a bookmark, and the password-reset email still lands somewhere that works.
// Deleting the routes instead would have locked the club out of their own
// data — and the staff login was only just recovered (supabase-recover-staff-
// login.sql). robots.txt already asks crawlers to leave /app and /login alone,
// so "reachable but not advertised" is the promise this site was already
// making; this constant just makes the landing page keep it too.
//
// ⚠️  IT IS NOT A SECURITY BOUNDARY, in either direction.
// Hiding a <Link> hides nothing from anyone willing to type a path. What
// actually protects the club's data is unchanged and lives in three places:
// RLS on every table (proven live — supabase-rls-audit.sql), the SECURITY
// DEFINER functions that own every write, and RequireAuth / RequireStaff on
// the /app routes. If you ever need the CRM to be genuinely unreachable from
// the internet, this flag is the wrong tool — that is a hosting decision.
//
// ── Attached locally, detached on the website (Oct 2026) ────────────────────
// Everything above describes the PUBLIC site and still does. What changed is
// that "detached" is no longer unconditional: the club wanted the full thing
// still runnable — to work on, to demo, and to see the two versions side by
// side — so this follows LOCAL_ONLY. On a dev server the "Log in" button is
// back in the nav and the CTAs go through the signup door exactly as they used
// to; in every build Vercel serves, the branches are not in the bundle.
//
// REGISTRATION_OPEN follows the same flag, so the Create account tab these
// buttons point at is there when they are — that pairing was the one thing
// easy to get wrong when both were hand-set.
//
// To re-attach the CRM to the PUBLIC site as well, make this `true` outright.
export const CRM_PUBLIC = LOCAL_ONLY
