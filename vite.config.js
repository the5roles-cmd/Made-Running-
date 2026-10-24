import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The browser only ever talks to ONE origin (the Vite dev server).
// Calls to /api are proxied to the Express AI proxy on API_PORT so that
// AI keys never reach the client bundle. See server/index.cjs.
const API_PORT = process.env.API_PORT || 8794

// ── Refuse to BUILD a demo-auth bundle ──────────────────────────────────────
//
// VITE_DEMO_AUTH=1 turns /login into a door that always opens (src/lib/
// demoAuth.js). That is correct and wanted on a dev server. Baked into a
// production bundle it is a disaster, because the same .env.local also points
// VITE_SUPABASE_URL at the club's real project.
//
// This is not hypothetical and it is not a flag-bypass. `npm run build` on a
// machine with VITE_DEMO_AUTH=1 in .env.local silently emits exactly that
// bundle — observed Oct 2026, where the resulting dist/ served by `vite
// preview` walked straight into /app as "Demo Admin". The demo banner is
// supposed to catch this, but a banner only helps someone who looks, and the
// documented failure mode is "someone deploying a build they forgot was a
// demo". So the build now fails instead of warning.
//
// Scope is deliberately narrow:
//   • `serve` (npm run dev) is untouched — demo mode is the point there.
//   • On Vercel the variable is not set, so this never fires; and if anyone
//     ever sets it in the project dashboard, the deploy fails loudly rather
//     than publishing an open door. That second case is the real prize.
//
// loadEnv is used rather than process.env because .env.local is where the
// flag actually lives, and Vite would otherwise read it after this point.
function assertNotDemoBuild(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.VITE_DEMO_AUTH !== '1') return
  // A deliberate escape hatch, because "I want to check the demo as a static
  // build" is legitimate. It has to be typed on the command line every time,
  // which is the difference between choosing this and forgetting it.
  if (env.ALLOW_DEMO_BUILD === '1') {
    console.warn(
      '\n⚠️  Building WITH demo auth enabled (ALLOW_DEMO_BUILD=1).\n' +
        '    /login will open without credentials. Do not deploy this dist/.\n',
    )
    return
  }
  throw new Error(
    'Refusing to build with VITE_DEMO_AUTH=1.\n\n' +
      'This would produce a bundle whose /login opens without credentials,\n' +
      'pointed at the Supabase project in your .env.local.\n\n' +
      'For a deployable build:   VITE_DEMO_AUTH=0 npm run build\n' +
      'To build the demo anyway: ALLOW_DEMO_BUILD=1 npm run build\n',
  )
}

// ── Refuse to BUILD a public signup funnel into the club's database ─────────
//
// VITE_PUBLIC_DOORS=1 re-opens the CRM doors on a DEPLOYED build (see
// src/lib/localOnly.js). That exists for one reason: a prospect demo that can
// be sent as a URL. On that build it is safe, because the demo ships with no
// Supabase credentials — the doors open onto nothing.
//
// Set the same variable on the club's project and it means something else
// entirely. "Get started" would again point at the Create account tab, which
// calls create_org against the club's live Postgres, and every stranger who
// pressed it would mint a permanent workspace the club cannot see. That is
// the exact problem the October detachment was done to stop.
//
// The buttons were never the danger; what pressing them WRITES is. So the
// guard tests the conjunction that is actually unsafe:
//
//     doors open  AND  a real database  AND  registration not demo-stubbed
//
// Which leaves every legitimate build alone:
//   • the club's production build — no doors variable → passes
//   • the prospect demo          — no database        → passes
//   • any dev server             — command is serve   → not checked
//
// and fails exactly one: someone switching the funnel back on over live data.
// Note this deliberately does NOT hardcode the club's project URL. The rule is
// "doors + any real database", which stays true if the club ever migrates.
function assertSafeDoorsBuild(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.VITE_PUBLIC_DOORS !== '1') return

  // Mirrors isPlaceholder() in src/lib/supabase.js: empty, "your…" and the
  // example host all mean "no database", and must mean it identically here,
  // or the guard would pass a build the app then treats as live.
  const ph = (v) =>
    !v || v.includes('...') || v.toLowerCase().startsWith('your') || v.includes('example.supabase')
  const hasRealDb = !ph(env.VITE_SUPABASE_URL) && !ph(env.VITE_SUPABASE_ANON_KEY)
  if (!hasRealDb) return

  // Demo auth never reaches the real auth API, so doors + a database + demo
  // mode cannot create anything. Unusual, but not unsafe — allow it.
  if (env.VITE_DEMO_AUTH === '1') return

  throw new Error(
    'Refusing to build with VITE_PUBLIC_DOORS=1 against a live database.\n\n' +
      'This combination re-opens the public signup funnel: "Get started" would\n' +
      'point at Create account, and create_org would write a permanent org row\n' +
      'into the Supabase project configured for this build.\n\n' +
      'The prospect demo is meant to build WITHOUT Supabase credentials:\n' +
      "  VITE_PUBLIC_DOORS=1 VITE_SUPABASE_URL='' VITE_SUPABASE_ANON_KEY='' npm run build\n\n" +
      'If you genuinely intend a public signup funnel over live data, that is a\n' +
      'product decision, not a build flag — remove this guard deliberately.\n',
  )
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    assertNotDemoBuild(mode)
    assertSafeDoorsBuild(mode)
  }

  return {
    plugins: [react()],
    server: {
      port: 4970,
      proxy: {
        '/api': `http://localhost:${API_PORT}`,
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Route-level code splitting: split the heaviest vendor libraries
          // into separate lazily-loaded chunks. This cuts first-paint JS from
          // ~1.6 MB down to ~200–300 KB (react + router core), deferring
          // recharts and supabase until the authenticated app shell mounts.
          manualChunks(id) {
            // React core — always needed immediately
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react'
            }
            // React Router — needed for app routing (small, keep with react)
            if (id.includes('node_modules/react-router')) {
              return 'vendor-react'
            }
            // Recharts — very large charting library, only used on dashboards
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts'
            }
            // Supabase — auth + data, only needed after login
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase'
            }
            // Lucide icons — large tree, used throughout the app
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide'
            }
          },
        },
      },
    },
  }
})
