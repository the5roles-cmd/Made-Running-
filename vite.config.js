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

export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertNotDemoBuild(mode)

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
