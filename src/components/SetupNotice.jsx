// Shown when Supabase isn't configured yet. Explains, doesn't crash.
import { Database } from 'lucide-react'
import { supabaseConfigured } from '../lib/supabase'

export default function SetupNotice() {
  if (supabaseConfigured) return null
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
