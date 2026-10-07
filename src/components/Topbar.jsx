// Topbar — search, org switcher, chat trigger, account menu.
// The account menu (avatar button + dropdown) replaces the bare LogOut icon.
// Focus/Escape handling mirrors the mobile-drawer pattern in Layout.jsx.
import { useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, Bot, Eye, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { isStaffRole } from '../lib/constants'
import { tenant } from '../lib/theme'
import { initials } from './ui'

// ── AccountMenu ───────────────────────────────────────────────────────────────
// Self-contained dropdown: trigger button + floating panel.
// Gotcha: global `a:hover { text-decoration: underline }` in app.css has
// specificity (0,1,1) which beats a class-only :hover rule. We set
// `textDecoration: 'none'` via the `style` prop on every Link/button
// that acts as a menu row so inline style (specificity wins) keeps them clean.

// Shared row styling for the menu items. Extracted because the hover/focus
// handlers below were being copy-pasted per row, and a fourth copy is where
// that stops being acceptable.
const menuRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--s3)',
  padding: 'var(--s3) var(--s4)',
  width: '100%',
  background: 'none',
  border: 0,
  textAlign: 'left',
  fontSize: 'var(--fs-sm)',
  fontWeight: 500,
  color: 'var(--ink)',
  textDecoration: 'none',
  minHeight: 44,
  cursor: 'pointer',
  transition: 'background var(--dur) var(--ease)',
}

const rowHover = {
  onMouseEnter: (e) => {
    e.currentTarget.style.background = 'var(--accent-soft)'
  },
  onMouseLeave: (e) => {
    e.currentTarget.style.background = ''
  },
  onFocus: (e) => {
    e.currentTarget.style.background = 'var(--accent-soft)'
  },
  onBlur: (e) => {
    e.currentTarget.style.background = ''
  },
}

function AccountMenu({ user, signOut }) {
  const { role, viewAsRunner, toggleViewAsRunner } = useAuth()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  // Close and return focus to the trigger — same pattern as Layout.jsx
  const close = useCallback(() => {
    setOpen(false)
    // Small rAF so the DOM has settled before we steal focus back
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }, [])

  // Escape closes; outside-click closes
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    function onPointer(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !triggerRef.current.contains(e.target)
      ) {
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  // Move focus into the menu when it opens
  useEffect(() => {
    if (open) {
      // Focus the first interactive child
      const first = menuRef.current?.querySelector('a, button')
      first?.focus()
    }
  }, [open])

  function toggle() {
    setOpen((v) => !v)
  }

  async function handleSignOut() {
    close()
    await signOut()
  }

  const email = user?.email || ''
  const avatarLabel = initials(email)

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        className="btn btn--ghost btn--sm"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        style={{
          minWidth: 44,
          minHeight: 44,
          gap: 'var(--s2)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--s2)',
        }}
      >
        <span
          className="avatar"
          aria-hidden="true"
          title={email}
        >
          {avatarLabel}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            opacity: 0.6,
            transition: 'transform var(--dur) var(--ease)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account options"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--s2))',
            right: 0,
            zIndex: 100,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 220,
            overflow: 'hidden',
            // Prevent the dropdown pushing the topbar wide on phones
            maxWidth: 'calc(100vw - var(--s5) * 2)',
          }}
        >
          {/* User identity header */}
          <div
            style={{
              padding: 'var(--s3) var(--s4)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div
              className="eyebrow"
              style={{ marginBottom: 'var(--s1)', color: 'var(--muted)' }}
            >
              Signed in as
            </div>
            <div
              style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                color: 'var(--ink)',
                wordBreak: 'break-all',
              }}
            >
              {email}
            </div>
          </div>

          {/* Settings link */}
          <Link
            to="/app/settings"
            role="menuitem"
            onClick={close}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s3)',
              padding: 'var(--s3) var(--s4)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--ink)',
              fontWeight: 500,
              textDecoration: 'none',
              minHeight: 44,
              transition: 'background var(--dur) var(--ease)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-soft)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = ''
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = 'var(--accent-soft)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = ''
            }}
          >
            <Settings size={16} aria-hidden="true" style={{ opacity: 0.7 }} />
            Settings
          </Link>

          {/* Preview the members' view. Staff only — offering "view as
              runner" to a runner would be a toggle that does nothing. */}
          {isStaffRole(role) || viewAsRunner ? (
            <button
              role="menuitem"
              onClick={() => {
                toggleViewAsRunner()
                close()
              }}
              style={menuRowStyle}
              {...rowHover}
            >
              <Eye size={16} aria-hidden="true" style={{ opacity: 0.7 }} />
              {viewAsRunner ? 'Back to coach view' : 'View as runner'}
            </button>
          ) : null}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--line)' }} role="separator" />

          {/* Sign out */}
          <button
            role="menuitem"
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s3)',
              padding: 'var(--s3) var(--s4)',
              width: '100%',
              background: 'none',
              border: 0,
              fontSize: 'var(--fs-sm)',
              color: 'var(--danger)',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: 44,
              transition: 'background var(--dur) var(--ease)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = ''
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = 'var(--danger-bg)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = ''
            }}
          >
            <LogOut size={16} aria-hidden="true" style={{ opacity: 0.7 }} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export default function Topbar({ hamburgerRef, drawerOpen, onHamburger, onOpenChat }) {
  const { user, orgs, orgId, switchOrg, signOut } = useAuth()

  return (
    <header className="topbar">
      {/* Hamburger — CSS hides this on wide viewports */}
      <button
        ref={hamburgerRef}
        className="hamburger"
        onClick={onHamburger}
        aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={drawerOpen ? true : false}
        aria-controls="sidebar-nav"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="topbar__search">
        <Search size={16} aria-hidden="true" />
        <input
          className="input"
          type="search"
          placeholder="Search…"
          aria-label="Search"
          style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
        />
      </div>

      <div className="topbar__spacer" />

      {/* Org switcher — only when 2+ orgs */}
      {orgs && orgs.length >= 2 && (
        <select
          className="select"
          value={orgId || ''}
          onChange={(e) => switchOrg(e.target.value)}
          aria-label="Switch organisation"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      )}

      {/* Ask AI */}
      <button
        className="btn btn--primary btn--sm"
        onClick={onOpenChat}
        aria-label={`Open ${tenant.name} assistant`}
        style={{ minHeight: 44, gap: 'var(--s2)' }}
      >
        <Bot size={16} />
        <span>Ask {tenant.name}</span>
      </button>

      {/* Account menu — replaces the bare LogOut icon */}
      {user && <AccountMenu user={user} signOut={signOut} />}
    </header>
  )
}
