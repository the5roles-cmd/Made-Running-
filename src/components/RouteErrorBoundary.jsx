import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

// ============================================================
// The missing half of <Suspense>.
//
// App routes are lazy (see App.jsx). <Suspense> handles a lazy import while
// it is PENDING. Nothing handled it when it REJECTED — and in React 18 an
// unhandled render error unmounts the whole root, so a failed route chunk
// took the sidebar and topbar down with it and left a blank page.
//
// It rejects for one boring, guaranteed reason: a redeploy. The tab is
// holding an index-<hash>.js that names chunks like Shop-a1b2c3.js by exact
// filename. Ship a new build and the production alias serves a new file set;
// the old hashed chunk 404s. The user clicks Shop, the import rejects, the
// app disappears. Reloading fixes it because a fresh index.html names the
// new chunks — which is exactly the "reload and it's fine" symptom.
//
// So the recovery is: reload. Once, automatically, and only for this class
// of error. The sessionStorage latch is the important part — without it, a
// chunk that is genuinely broken (bad build, dead CDN) would reload, fail,
// reload, fail, and pin the tab in a loop that the user cannot escape and
// cannot read an error from. One silent retry, then we stop and show a
// human the actual situation.
// ============================================================

const RELOAD_LATCH = 'crm-chunk-reloaded'

// Every runtime's phrasing for "I could not fetch that module". Chrome,
// Firefox and Safari each word it differently, and Vite adds its own for a
// failed modulepreload, so this matches on substrings rather than one string.
const CHUNK_ERROR = /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

function isStaleChunkError(error) {
  if (!error) return false
  return CHUNK_ERROR.test(error.message || '') || CHUNK_ERROR.test(String(error))
}

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isStaleChunkError(error) && !sessionStorage.getItem(RELOAD_LATCH)) {
      // Latch BEFORE reloading, not after — the reload never returns here.
      sessionStorage.setItem(RELOAD_LATCH, '1')
      window.location.reload()
      return
    }
    // Real errors still belong in the console. Swallowing them here would
    // trade a blank page for a silent one, which is worse to debug.
    console.error('[route]', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A stale-chunk error that got this far means the one retry already
    // happened and did not help, so this is a genuine failure either way.
    return (
      <div style={{ padding: 'var(--s8) var(--s6)', maxWidth: '52ch' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>This page didn&rsquo;t load</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6, marginTop: 'var(--s3)' }}>
          Something went wrong opening this screen. Your data is safe — nothing
          was saved or changed. Reloading usually clears it.
        </p>
        <button
          className="btn btn--primary"
          style={{ minHeight: 44, marginTop: 'var(--s5)' }}
          onClick={() => {
            // Clear the latch so the automatic retry is available again on
            // the next navigation. A manual reload is the user telling us
            // they want a clean slate.
            sessionStorage.removeItem(RELOAD_LATCH)
            window.location.reload()
          }}
        >
          <RefreshCw size={16} />
          Reload
        </button>
      </div>
    )
  }
}

// Clear the latch once a route has rendered successfully, so a LATER
// redeploy in the same tab still gets its own automatic retry. Without this
// the latch is set for the life of the tab and the second stale-chunk event
// of a session would show the error card instead of just recovering.
export function clearChunkReloadLatch() {
  sessionStorage.removeItem(RELOAD_LATCH)
}
