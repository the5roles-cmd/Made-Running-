// Route guard: staff-only screens.
//
// This exists because hiding a nav item is not the same as protecting a
// screen. `navFor(role)` in constants.js filters the sidebar, and that is a
// tidiness feature — it stops a runner staring at eight tabs that answer a
// coach's questions. It is NOT a boundary: /app/records is the club's whole
// people list — names, emails, statuses — and it was still one typed URL
// away from any member who guessed it.
//
// So there are three layers here, and it's worth being precise about which
// does what, because conflating them is how leaks happen:
//
//   navFor()      — what you SEE offered.        Cosmetic.
//   RequireStaff  — what you can REACH.          Client-side. Defeatable by
//                                                anyone who edits their own
//                                                JS, so never the last word.
//   RLS           — what the database will HAND OVER. The real boundary.
//
// This is the middle layer, and it's honest about being the middle layer.
// It reads `effectiveRole`, not `role`, so the "View as runner" toggle in
// the account menu bounces an owner out of the coach screens too — which is
// the whole point of that toggle: to actually walk the member's journey
// rather than take a guess at it.
//
// The remaining gap, stated plainly rather than left to be discovered: a
// determined member could still read club-wide rows straight from PostgREST
// with their own token, because the RLS policies are org-scoped, not
// role-scoped (`org_id in (select my_org_ids())`). Closing that properly
// means role-aware policies in SQL — a migration, not a component.
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { isStaffRole } from '../lib/constants'

export default function RequireStaff({ children }) {
  const { effectiveRole, loading, supabaseConfigured } = useAuth()

  // No backend wired up yet: let it through so <SetupNotice> can explain
  // itself instead of the app silently bouncing every admin screen.
  if (!supabaseConfigured) return children

  // In practice unreachable — RequireAuth is showing its splash while this
  // is true, and Layout renders inside it. Kept because the cost of being
  // wrong is redirecting a legitimate owner mid-fetch, and the failure would
  // only show up as "sometimes it kicks me out when I refresh".
  if (loading) return null

  if (!isStaffRole(effectiveRole)) return <Navigate to="/app" replace />

  return children
}
