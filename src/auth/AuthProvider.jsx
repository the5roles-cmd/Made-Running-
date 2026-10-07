// ============================================================
// AuthProvider — Supabase session + the caller's active org.
// Exposes: user, session, orgId, role, orgs[], loading,
//          signIn, signUp, signOut, switchOrg, supabaseConfigured.
// Every data hook scopes queries to `orgId`; RLS enforces it too.
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

const ORG_KEY = 'crm-active-org'
// "Show me what a runner sees." Persisted so it survives a reload mid-demo.
const VIEW_KEY = 'crm-view-as-runner'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_KEY) || null)
  const [role, setRole] = useState(null)

  // A coach previewing the members' side of the app. This exists because
  // every account here is the owner of its own workspace, so without it
  // nobody can ever look at the runner experience they're responsible for.
  //
  // It downgrades what the NAV offers, and nothing else. It cannot be used to
  // see MORE than your role allows — only less — and it does not touch the
  // JWT, so RLS still evaluates the real role on every query. That asymmetry
  // is the whole reason it's safe to keep in a localStorage flag a user could
  // flip by hand.
  const [viewAsRunner, setViewAsRunner] = useState(() => localStorage.getItem(VIEW_KEY) === '1')

  const toggleViewAsRunner = useCallback(() => {
    setViewAsRunner((prev) => {
      const next = !prev
      if (next) localStorage.setItem(VIEW_KEY, '1')
      else localStorage.removeItem(VIEW_KEY)
      return next
    })
  }, [])

  // `loading` means "auth state is not yet trustworthy" — it covers the
  // session AND the memberships that depend on it. It used to mean only
  // "the session is still being read", which is why signing in landed you
  // on an org-less /app: RequireAuth waved you through the instant `user`
  // appeared, while the memberships query was still in flight, and every
  // data hook bailed on `if (!orgId) return`. Reloading "fixed" it purely
  // because the cold-start path awaited memberships before clearing this.
  const [loading, setLoading] = useState(true)

  // Anything handed out through context is captured by consumers at their
  // render time. `refreshOrgs` used to be `() => loadMemberships(session?.user?.id)`,
  // so Login's submit handler — created while signed OUT — called it with
  // undefined and it silently no-oped on its own `if (!uid) return`. A ref is
  // always current, so callbacks stay correct however stale their closure is.
  const userIdRef = useRef(null)
  // Guards against an out-of-order finish: getSession() and onAuthStateChange
  // both fire around mount, and whichever resolves LAST must be the one that
  // decides the final state and clears `loading`.
  const seqRef = useRef(0)

  const loadMemberships = useCallback(async (uid) => {
    if (!uid) {
      setOrgs([])
      setOrgId(null)
      setRole(null)
      localStorage.removeItem(ORG_KEY)
      return []
    }
    const { data } = await supabase
      .from('memberships')
      .select('org_id, role, created_at, orgs(id, name, industry)')
      .eq('user_id', uid)
      // Deterministic order. Without it Postgres may return memberships in any
      // order, so `list[0]` — the fallback active org — could differ between
      // two identical calls. Oldest first means the org you were actually
      // added to wins over anything created later.
      .order('created_at', { ascending: true })

    const list = (data || []).map((m) => ({ id: m.org_id, role: m.role, ...m.orgs }))
    setOrgs(list)

    // Read the remembered org straight from storage rather than from a
    // setOrgId updater. The old version called setRole INSIDE that updater —
    // a state update during another update's reducer, which React may run
    // twice in StrictMode and is not a place for side effects.
    const remembered = localStorage.getItem(ORG_KEY)
    const next = list.find((o) => o.id === remembered)?.id || list[0]?.id || null
    if (next) localStorage.setItem(ORG_KEY, next)
    else localStorage.removeItem(ORG_KEY)
    setOrgId(next)
    setRole(list.find((o) => o.id === next)?.role || null)

    // Returned so callers can act on the real list instead of on the `orgs`
    // value their closure captured. Login.jsx depends on this.
    return list
  }, [])

  // One path for "the session changed, resync everything and only then declare
  // auth settled". Both the cold start and every later auth event go through
  // it, so the two can no longer disagree about what `loading` means.
  const syncAuth = useCallback(
    async (nextSession) => {
      const seq = ++seqRef.current
      const uid = nextSession?.user?.id || null
      userIdRef.current = uid
      setSession(nextSession)
      await loadMemberships(uid)
      // A newer sync started while we were awaiting — let that one finish and
      // own the result, or we would clear `loading` over stale data.
      if (seq === seqRef.current) setLoading(false)
    },
    [loadMemberships],
  )

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (alive) syncAuth(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return
      // Fires roughly hourly with the same user. Re-running the memberships
      // query would be pure waste, and bouncing `loading` would remount the
      // whole app under the user mid-session.
      if (event === 'TOKEN_REFRESHED') {
        setSession(s)
        return
      }
      // A different user (sign-in, sign-out, account switch) means the current
      // orgs are wrong, not merely stale — so re-arm the gate and make
      // RequireAuth hold on the splash until the new set has landed.
      if ((s?.user?.id || null) !== userIdRef.current) setLoading(true)
      syncAuth(s)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [syncAuth])

  const switchOrg = useCallback(
    (id) => {
      localStorage.setItem(ORG_KEY, id)
      setOrgId(id)
      setRole(orgs.find((o) => o.id === id)?.role || null)
    },
    [orgs],
  )

  const value = {
    supabaseConfigured,
    session,
    user: session?.user || null,
    orgs,
    orgId,
    // `role` is the truth from the memberships row. `effectiveRole` is what
    // the UI should offer, which is the same thing unless a coach is
    // previewing the runner view. Anything making a SECURITY decision must
    // read `role`; anything deciding what to SHOW should read effectiveRole.
    role,
    effectiveRole: viewAsRunner ? 'member' : role,
    viewAsRunner,
    toggleViewAsRunner,
    loading,
    // Reads the id from the ref, not from `session`. Callers get the resolved
    // list back, so they never have to guess from a captured `orgs`.
    refreshOrgs: () => loadMemberships(userIdRef.current),
    switchOrg,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    // meta (optional) → Supabase user_metadata; the mandatory-profile signup
    // form on Login.jsx passes full_name/phone/location/business_name/website.
    signUp: (email, password, meta) =>
      supabase.auth.signUp({ email, password, options: meta ? { data: meta } : undefined }),
    signOut: () => supabase.auth.signOut(),

    // ── Password recovery, two halves ─────────────────────────────
    // 1. requestPasswordReset emails a one-time link. Supabase does NOT
    //    error for an unknown address — that is deliberate anti-enumeration,
    //    so the UI must show the same confirmation either way. Never write
    //    a branch here that reveals whether the account exists.
    //    redirectTo must also be listed under Auth → URL Configuration →
    //    Redirect URLs in the Supabase dashboard, or the link lands on the
    //    Site URL instead and the reset screen sees no session.
    requestPasswordReset: (email) =>
      supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    // 2. updatePassword runs on /reset-password, where the link has already
    //    put a recovery session in place — updateUser authenticates off that
    //    session, which is why no old password is required.
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
