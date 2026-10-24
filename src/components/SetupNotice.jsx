// Shown when Supabase isn't configured yet. Explains, doesn't crash.
import { Database } from 'lucide-react'
import { supabaseConfigured } from '../lib/supabase'
import { isDemoAuth } from '../lib/demoAuth'

export default function SetupNotice() {
  if (supabaseConfigured) return null
  // ── Not in a demo build ───────────────────────────────────────────────
  // This notice assumes "no database" is a MISTAKE and tells the reader how
  // to fix it — copy .env.example, run the SQL. In a demo build it is the
  // deliberate configuration, and the advice is addressed to the wrong
  // person entirely: the prospect demo is sent to potential customers, who
  // would read setup instructions for software they do not own as proof it
  // is unfinished. Eleven screens render this, so the suppression belongs
  // here rather than at each call site.
  //
  // Nothing is silently hidden by this. The fixed "DEMO MODE · NO LIVE
  // DATABASE" badge is on screen the whole time (src/components/DemoBanner
  // .jsx), so the same fact is still stated — just to the right audience.
  if (isDemoAuth) return null
  return (
    <div className="notice">
      <div className="rowflex" style={{ gap: 'var(--s3)', marginBottom: 'var(--s2)' }}>
        <Database size={20} />
        <strong className="display" style={{ fontSize: 'var(--fs-md)' }}>
          Connect your backend to see live data
        </strong>
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Copy <code>.env.example</code> → <code>.env.local</code>, add your{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then run{' '}
        <code>supabase-setup.sql</code> in the Supabase SQL editor. Restart the dev server after
        editing env. Until then, screens render with empty states — nothing breaks.
      </p>
    </div>
  )
}
