// ============================================================
// PUBLIC SHOP — /shop. The storefront without the sign-in gate.
//
// Not a flow-chart step: the flow chart describes a BOOKING, and buying a
// tee is not one. Adding this route did not add, remove or reorder any step.
//
// WHY THIS IS A WRAPPER AND NOT A SECOND STOREFRONT
//
// Shop.jsx imports nothing from auth or Supabase — the only thing that ever
// gated it was WHERE it was mounted: /app/shop sits inside
// <RequireAuth><Layout/>. So the public shop is the SAME component mounted
// at a second route. One product list, one basket (localStorage, shared
// across both doors), one checkout path. A copied storefront would drift the
// first time a price changed.
//
// What this file adds is only what Layout used to provide and a public
// visitor now lacks: chrome. Inside /app the sidebar is the way back;
// out here the lockup header is — same pattern as Coaches.jsx, the other
// public page that wraps its content in a lockup → "/" header.
//
// /app/shop stays mounted for members: a signed-in runner browsing the app
// should not be bounced out of the shell to buy a shirt.
// ============================================================
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { tenant } from '../lib/theme'
import Shop from './Shop'

export default function ShopPublic() {
  useEffect(() => {
    document.title = `Shop — ${tenant.name}`
  }, [])

  return (
    <div className="sp">
      <style>{SHOP_PUBLIC_CSS}</style>

      {/* Same lockup-header contract as Coaches.jsx: the wordmark is the
          back button. No nav items — a visitor who came for the shop gets
          the shop, and "/" is one tap away for everything else. */}
      <header className="sp__hero">
        <Link to="/" className="sp__lockup" aria-label={`${tenant.name} — back to home`}>
          <span className="sp__mark">{tenant.mark}</span>
          <span className="sp__wordmark">{tenant.name}</span>
        </Link>
      </header>

      {/* Shop renders its own .page wrapper (app.css is global, imported in
          main.jsx), which self-centres via max-width + margin auto — it does
          not need Layout to be laid out. */}
      <Shop />
    </div>
  )
}

// Scoped under .sp — the lockup CSS in Coaches.jsx lives inside THAT page's
// chunk and does not exist while this one is on screen, so the header styles
// are duplicated here rather than imported across lazy-chunk boundaries.
const SHOP_PUBLIC_CSS = `
  .sp {
    min-height: 100svh;
    background: var(--bg);
  }
  .sp__hero {
    display: flex;
    align-items: center;
    padding: 18px clamp(20px, 4vw, 44px);
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .sp__lockup {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
    /* 44px minimum touch target without inflating the visual lockup. */
    min-height: 44px;
  }
  .sp__mark {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--ink);
    color: var(--surface-raised);
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.02em;
  }
  .sp__wordmark {
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 13px;
  }
`
