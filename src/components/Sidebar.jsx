// Sidebar — branded navigation rail / drawer.
import { useEffect, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  Bot,
  Building2,
  CalendarCheck,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleUser,
  ClipboardCheck,
  Dumbbell,
  FolderKanban,
  Footprints,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Home,
  Kanban,
  LayoutDashboard,
  MapPin,
  MessagesSquare,
  Palette,
  Settings,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { navFor } from '../lib/constants'
import { useAuth } from '../auth/AuthProvider'
import { tenant } from '../lib/theme'

// Explicit registry, NOT `import * as Icons from 'lucide-react'`.
//
// The namespace import is the obvious way to resolve NAV_GROUPS' `icon: 'Users'`
// strings, and it was what this file used. But a namespace import is opaque to
// tree-shaking — the bundler cannot prove which properties get read at runtime,
// so it keeps all ~1,500 icons. That was a 638 kB chunk, and because Vite
// modulepreloads every chunk from index.html, the *public landing page* paid
// for it before first paint.
//
// If you add a nav item with a new icon name, you must do BOTH: add the
// lucide import above AND the entry below. They fail very differently.
//
//   Missing map entry  → NavIcon falls back to Circle and warns in dev. Safe.
//   Missing import     → this object literal throws ReferenceError on module
//                        evaluation, and because the Sidebar mounts on every
//                        authenticated route, the whole app white-screens.
//
// The second one is NOT caught by `npm run build`: a bare identifier with no
// binding is treated as a possible runtime global, so it bundles clean and
// only explodes in the browser. CalendarHeart shipped exactly this way.
// Adding an icon? Load an authenticated page before you believe it works.
const ICONS = {
  Bot,
  Building2,
  CalendarCheck,
  CalendarHeart,
  CircleUser,
  ClipboardCheck,
  Dumbbell,
  FolderKanban,
  Footprints,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Home,
  Kanban,
  LayoutDashboard,
  MapPin,
  MessagesSquare,
  Palette,
  Settings,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
}

function NavIcon({ name, size = 18 }) {
  const Ico = ICONS[name]
  if (!Ico) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Sidebar] No icon registered for "${name}". Add it to the ICONS map in Sidebar.jsx.`,
      )
    }
    return <Circle size={size} />
  }
  return <Ico size={size} />
}

export default function Sidebar({ rail, open, onToggleRail, onClose }) {
  const ChevronIcon = rail ? ChevronRight : ChevronLeft
  const asideRef = useRef(null)

  // A runner and a coach get different rails. `role` comes from the caller's
  // membership row in the ACTIVE org, so switching workspaces re-filters the
  // nav — someone can be an owner of one club and a plain member of another.
  const { effectiveRole } = useAuth()
  const groups = navFor(effectiveRole)

  // When the mobile drawer opens, move focus into the sidebar so keyboard
  // users can navigate immediately without extra tab presses.
  useEffect(() => {
    if (open && asideRef.current) {
      // Scoped to #sidebar-nav on purpose. The brand is now a real link and
      // sits above the nav in the DOM, so an unscoped 'a, button' query would
      // land focus on "go to the public homepage" — offering someone who just
      // opened the navigation a way OUT of the app as their first option.
      // Fall back to the old behaviour if the nav is ever absent.
      const nav = asideRef.current.querySelector('#sidebar-nav')
      const first =
        nav?.querySelector('a, button') || asideRef.current.querySelector('a, button')
      if (first) first.focus()
    }
  }, [open])

  return (
    <aside
      ref={asideRef}
      className={`sidebar ${open ? 'open' : ''}`}
      aria-label="Main navigation"
    >
      {/* Brand — the way back out to the public homepage.
          <Link>, never <a href="/">. An anchor would do a full document load:
          React is torn down, the bundle re-boots, and supabase-js has to read
          the session back out of localStorage. For a beat the member genuinely
          looks signed out, and anything held in memory (an in-progress post,
          the Community feed) is gone. Link swaps the route in place and never
          touches the session — which is what "back to the site without logging
          out" actually requires.

          onClose fires too: on a phone the sidebar is an overlay drawer, and
          navigating underneath it would leave the member staring at the menu
          they just used, on top of a page they cannot see. */}
      <Link
        to="/"
        className="sidebar__brand"
        onClick={onClose}
        // The visible text is just the club name, so on its own a screen
        // reader announces "Made Running, link" — which says nothing about
        // where it goes. Naming the destination is the whole point.
        aria-label={`${tenant.name} — go to the public homepage`}
      >
        <span className="sidebar__mark">{tenant.mark}</span>
        <span>{tenant.name}</span>
      </Link>

      {/* Nav groups */}
      <nav id="sidebar-nav" className="sidebar__nav">
        {groups.map((group) => (
          <div key={group.label} className="sidebar__group">
            <div className="sidebar__group-label">{group.label}</div>

            {group.items.map((item) => {
              if (item.soon) {
                return (
                  <div key={item.to} className="navitem soon" aria-disabled="true">
                    <NavIcon name={item.icon} />
                    <span className="navitem__label">{item.label}</span>
                    <span className="navitem__soon">soon</span>
                  </div>
                )
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `navitem${isActive ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <NavIcon name={item.icon} />
                  <span className="navitem__label">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer: rail toggle */}
      <div className="sidebar__foot">
        <button
          className="railtoggle"
          onClick={onToggleRail}
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronIcon size={16} />
        </button>
      </div>
    </aside>
  )
}
