// ============================================================
// DEMO AUTH — a signed-in session with no backend behind it
// ============================================================
// Turns /login into a door that always opens, so the app can be shown without
// a reachable Supabase project. Off unless VITE_DEMO_AUTH=1 is present at
// BUILD time.
//
// ── Why an env flag and not import.meta.env.DEV ──────────────────────────
// `vite preview` serves the production bundle, so DEV is false there. Gating
// on DEV would switch this off on the one server it exists to serve. The flag
// has to be explicit.
//
// ── Which makes the flag the security boundary, so it gets two locks ─────
//  1. It is only ever set in .env.local, which .gitignore excludes, so it
//     cannot travel to anyone via the repo — including the public GitHub
//     mirror — and it is not in the Vercel project's environment.
//  2. isDemoAuth is re-exported to the UI, which renders a fixed banner
//     across the top of every screen while it is on. A build with this
//     enabled cannot be mistaken for a real one at a glance, which is the
//     failure mode that actually happens: not someone bypassing the flag,
//     but someone deploying a build they forgot was a demo.
//
// Vite inlines import.meta.env.* as literals at build time, so in a normal
// build the test below becomes `'undefined' === '1'` → false, and every
// branch guarded by it is removed by dead-code elimination. The fake user
// object is not merely unreachable in production — it is not in the bundle.
export const isDemoAuth = import.meta.env.VITE_DEMO_AUTH === '1'

// A stable id. Fixed rather than random so that anything persisted against it
// in localStorage survives a reload and a rebuild — otherwise every refresh
// would look like a different person and the demo would reset itself.
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
const DEMO_ORG_ID = '00000000-0000-4000-8000-0000000000a1'

// Shaped to match what Supabase actually returns, because the app reads these
// paths directly: user.email, user.user_metadata.full_name, session.user.id.
// A thinner stub would throw somewhere deep in a component instead of here.
export const demoUser = {
  id: DEMO_USER_ID,
  email: 'demo@maderunning.com',
  user_metadata: {
    full_name: 'Demo Admin',
    phone: '',
    location: 'Manchester',
    business_name: 'Made Running',
  },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
}

export const demoSession = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  token_type: 'bearer',
  // Far future. supabase-js is not running here, so nothing refreshes this —
  // an expiry in the past would be read as "signed out" by any code that
  // checks it, and the demo would log itself out mid-presentation.
  expires_at: 4102444800, // 2100-01-01
  user: demoUser,
}

// `owner` deliberately, not `member`: the point of demo mode is to show the
// whole product, and a member-role session hides the staff screens that are
// most of what a club is being sold. The runner's view is still reachable —
// AuthProvider's existing "view as runner" toggle downgrades from here.
export const demoOrgs = [
  {
    id: DEMO_ORG_ID,
    org_id: DEMO_ORG_ID,
    name: 'Made Running',
    industry: 'fitness',
    role: 'owner',
  },
]

export const demoRole = 'owner'
