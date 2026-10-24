// Imported ready for policy 2 in the TODO at the bottom of this file; the stub
// does not read it yet, hence the disable on the line below.
// eslint-disable-next-line no-unused-vars
import { LOCAL_ONLY } from './localOnly'

// ── The one hole that "local only" does not plug ────────────────────────────
//
// LOCAL_ONLY decides who is OFFERED the Create account tab. It does not change
// what the tab DOES, and what it does is call the create_org RPC against
// whatever VITE_SUPABASE_URL points at — which, in .env.local, is the club's
// real production Supabase project.
//
// So the junk-workspace problem that detaching the CRM solved for the public
// is still open for us. Every time anyone signs up at localhost:4970 to check
// something, a real org row and a real auth.users row appear in the club's
// live database, invisible to the club (different org, walled off by RLS) and
// permanent. That is the exact failure the October 2026 change existed to
// stop; the only thing that changed is who is doing it.
//
// Called from Login.jsx immediately before the create_org RPC, for signups
// only. Returning null allows the workspace to be created exactly as before,
// which is today's behaviour and why the stub is safe to ship unfinished.
//
// @param {object}  ctx
// @param {string}  ctx.email          the address being signed up
// @param {string}  ctx.workspaceName  what the org would be called
// @returns {string|null}  null to allow; a message to refuse and show
//
// TODO(Merlin): pick the policy. Four that all defend themselves:
//
//   1. Allow, always — `return null`. Trusts whoever is at the keyboard.
//      Zero friction, and the club's org list slowly fills with debris.
//   2. Refuse on a dev server — `if (LOCAL_ONLY) return '…'`. Nothing can be
//      created from a laptop by accident, but you also cannot test the signup
//      path end to end, which is the thing you switched the tab back on for.
//   3. Allow but MARK it, so it is findable later: let the name through but
//      tagged, e.g. `[dev] Acme`, and a human can safely delete every org
//      whose name starts with `[dev]`. (This needs the name back, not just a
//      yes/no — say the word and I will widen the return type.)
//   4. Allow only for addresses you recognise as test ones — e.g. anything
//      at a chosen domain, or containing '+test' — and refuse the rest, so a
//      real-looking signup on a dev server is treated as a mistake.
//
// Worth knowing before you choose: these rows are not free to clean up later.
// `orgs.created_by` currently cascades on delete, so removing the test USER
// takes the ORG with it — which is fine for debris, and is exactly why the
// separate side-task to defuse that constraint matters before you go near the
// dashboard with a delete button.
// Both parameters are the interface, not an oversight: Login.jsx already passes
// them, so whichever policy gets written has what it needs without anyone
// having to touch the call site. Named, not underscored, for the same reason.
// eslint-disable-next-line no-unused-vars
export function localSignupGuard({ email, workspaceName }) {
  return null
}
