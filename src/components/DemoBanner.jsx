// ============================================================
// DemoBanner — the second lock on demo auth
// ============================================================
// Renders nothing unless VITE_DEMO_AUTH=1 was set at build time. Vite inlines
// that comparison as a literal, so in a normal build `isDemoAuth` is the
// constant false and this whole component is dropped by dead-code
// elimination — it costs nothing to leave mounted permanently.
//
// Its job is to make the one realistic failure visible: not somebody defeating
// the env flag, but somebody deploying a build they had forgotten was a demo.
// A silent bypass is a vulnerability; a bypass you cannot look at the screen
// without seeing is a mode.
//
// ── Why a corner pill and not a full-width bar across the top ────────────
// A fixed bar at the top covers the first ~28px of every page — on the
// landing page that is the nav — so it has to be paid back with padding
// somewhere. But the app has `position: fixed` furniture of its own (the
// chat panel) and several `100svh` shells, and none of those are moved by
// padding on an ancestor: they measure the viewport. Compensating properly
// would mean touching all of them for a flag that is off in production.
// A corner pill overlaps nothing that matters and costs no layout at all.
import { isDemoAuth } from '../lib/demoAuth'

export default function DemoBanner() {
  if (!isDemoAuth) return null

  return (
    <div
      // role="status" rather than "alert": alert interrupts a screen reader
      // mid-sentence, and this is a standing condition of the whole build,
      // not an event that just happened.
      role="status"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        // Above the app's own fixed furniture, so it cannot be hidden by the
        // thing it exists to warn about.
        zIndex: 2147483647,
        background: '#b45309',
        color: '#fff',
        font: '600 11px/1 system-ui, -apple-system, sans-serif',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        padding: '7px 11px',
        borderRadius: 999,
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        // Clicks pass straight through. The pill is information, and it sits
        // over a corner where real controls sometimes live.
        pointerEvents: 'none',
        // Never let a long string wrap into a block that covers the corner.
        whiteSpace: 'nowrap',
      }}
    >
      Demo mode · no live database
    </div>
  )
}
