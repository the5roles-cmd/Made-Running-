// Route guard: screens for people who RUN a class from the inside.
// Coaches + admins (your decision 14: both).
//
// This is a SEPARATE guard from RequireStaff, and the separation is the
// point. RequireStaff answers "may you see the club?" — /app/records, the
// full people list. This answers "may you run a class?" A coach passes this
// and fails that, which is the whole three-dashboard split in one sentence.
//
// The temptation was to add 'coach' to STAFF_ROLES and reuse RequireStaff.
// That is one character, it would have worked, and it would silently have
// handed every coach the club's entire membership list. See the note on
// isCoachRole in constants.js.
//
// Same three layers as RequireStaff, same honesty about which one this is:
//
//   navFor()             — what you SEE offered.   Cosmetic.
//   RequireClassManager  — what you can REACH.     Client-side, defeatable.
//   RLS                  — what the database HANDS OVER. The real boundary.
//
// Unlike the older tables, the real boundary here is genuinely role-aware:
// supabase-classes.sql scopes class_bookings by is_org_staff() OR
// owns-the-class OR owns-the-booking, so a coach who edited their own
// JavaScript to reach this screen would still be handed only their own
// classes' rows. This guard is a courtesy to honest users, not the wall.
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canManageClasses } from '../lib/constants'

export default function RequireClassManager({ children }) {
  const { effectiveRole, loading, supabaseConfigured } = useAuth()

  // No backend wired up: let it through so <SetupNotice> can explain itself
  // rather than the app bouncing a legitimate coach to their profile with no
  // reason given.
  if (!supabaseConfigured) return children

  if (loading) return null

  // effectiveRole, not role — so "View as runner" in the account menu bounces
  // an owner out of here too. That toggle exists to walk the member's journey
  // honestly, and a member cannot manage classes.
  if (!canManageClasses(effectiveRole)) return <Navigate to="/app" replace />

  return children
}
