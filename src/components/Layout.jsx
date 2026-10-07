// Layout — top-level app shell. Renders sidebar, topbar, outlet, and chat panel.
import { useState, useEffect, useRef, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ChatPanel from './ChatPanel'
import RouteErrorBoundary, { clearChunkReloadLatch } from './RouteErrorBoundary'

const RAIL_KEY = 'crm-rail'

export default function Layout() {
  // Rail mode collapses the sidebar to icon-only (CSS handles visuals)
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Mobile drawer open/closed
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Chat panel open/closed
  const [chatOpen, setChatOpen] = useState(false)

  // Ref for the hamburger button — focus returns here when drawer closes
  const hamburgerRef = useRef(null)

  const location = useLocation()

  // Close mobile drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // If the shell has been alive and stable for a few seconds, any automatic
  // stale-chunk reload that got us here worked. Release the latch so a LATER
  // redeploy in this same long-lived tab still gets its own free retry rather
  // than going straight to the error card. Time-based on purpose: tying it to
  // a route change would clear it while a chunk is still in flight, which is
  // the exact window the latch exists to protect.
  useEffect(() => {
    const t = setTimeout(clearChunkReloadLatch, 5000)
    return () => clearTimeout(t)
  }, [])

  // Lock body scroll and manage focus when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Return focus to hamburger button when drawer closes via Esc or scrim
      hamburgerRef.current?.focus()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeDrawer() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  function openDrawer() {
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
  }

  function toggleRail() {
    setRail((prev) => {
      const next = !prev
      try {
        localStorage.setItem(RAIL_KEY, String(next))
      } catch {
        // localStorage not available — silently ignore
      }
      return next
    })
  }

  return (
    <div className={`app ${rail ? 'rail' : ''}`}>
      <Sidebar
        rail={rail}
        open={drawerOpen}
        onToggleRail={toggleRail}
        onClose={closeDrawer}
      />

      {/* Scrim covers main content when mobile drawer is open */}
      <div
        className={`scrim ${drawerOpen ? 'show' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <div className="main">
        <Topbar
          hamburgerRef={hamburgerRef}
          drawerOpen={drawerOpen}
          onHamburger={openDrawer}
          onOpenChat={() => setChatOpen(true)}
        />
        {/* App pages are lazy (see App.jsx). The boundary sits here, inside
            the shell, so the sidebar and topbar stay put while a route
            chunk arrives — a full-screen spinner would flash the shell
            away and make a sub-100ms navigation feel like a page load.
            The fallback is deliberately blank space rather than a
            spinner: on a warm cache it never paints at all, and a
            spinner that appears for 30ms reads as a flicker, not
            feedback. aria-busy keeps that honest for screen readers. */}
        {/* The boundary wraps Suspense, not the other way round: Suspense
            owns the PENDING lazy import, the boundary owns the REJECTED one.
            Without it, a route chunk that 404s after a redeploy unmounts the
            entire root — sidebar and topbar included — and leaves a blank
            page. See RouteErrorBoundary.jsx.

            Keyed on the pathname so navigating away from a broken route
            clears the error. Error boundaries do not reset themselves; a
            boundary that has caught once stays caught until it remounts, so
            without the key a single bad route would poison every screen
            after it for the rest of the session. */}
        <RouteErrorBoundary key={location.pathname}>
          <Suspense
            fallback={<div style={{ minHeight: '60vh' }} aria-busy="true" aria-live="polite" />}
          >
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </div>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}
