import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser only ever talks to ONE origin (the Vite dev server).
// Calls to /api are proxied to the Express AI proxy on API_PORT so that
// AI keys never reach the client bundle. See server/index.cjs.
const API_PORT = process.env.API_PORT || 8794

export default defineConfig({
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
        // Route-level code splitting: split the heaviest vendor libraries into
        // separate lazily-loaded chunks. This cuts first-paint JS from ~1.6 MB
        // down to ~200–300 KB (react + router core), deferring recharts and
        // supabase until the authenticated app shell mounts.
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
})
