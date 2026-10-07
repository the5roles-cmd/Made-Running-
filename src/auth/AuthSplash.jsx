import { tenant } from '../lib/theme'

// Shown for the beat between "the app mounted" and "we know whether there is
// a session". Both RequireAuth and Login need it — Login because it must not
// render a sign-in form to somebody who is already signed in, only to yank it
// away a frame later when the stored session resolves.
//
// Deliberately just the wordmark: a spinner would draw attention to a wait
// that is usually a single frame, and anything with layout would shift when
// the real page arrives.
export default function AuthSplash() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="display" style={{ fontSize: 'var(--fs-lg)', color: 'var(--muted)' }}>
        {tenant.name}
        <span style={{ color: 'var(--accent-ink)' }}>.</span>
      </div>
    </div>
  )
}
