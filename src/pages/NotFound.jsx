// NotFound — every URL that matches no route. (QA, Oct 2026: a typo'd link
// silently loaded the homepage, so the visitor had no way to know the address
// was wrong — it just looked like the link "worked" and took them somewhere
// they didn't ask to go.)
//
// An SPA cannot send a real HTTP 404 — Vercel's rewrite serves index.html
// with a 200 for every path, and the router only finds out afterwards. Two
// consequences are handled here:
//
//   1. People need to be TOLD the address is wrong, not redirected. The old
//      catch-all (`Navigate to="/"`) hid the mistake; this page names it and
//      offers the two places a lost visitor most likely wanted.
//   2. Search engines must not index these soft-404s as real pages, so the
//      mount effect injects <meta name="robots" content="noindex"> for
//      exactly as long as this page is showing. Crawlers that execute JS
//      (Google does) see it; the sitemap never lists unmatched URLs anyway.
//
// Note the /app subtree keeps its OWN catch-all (→ /app): a signed-in member
// on a dead app URL should stay inside the app, not land on marketing.
//
// Styled like Privacy/ManageBooking — light paper, one quiet column. A 404
// is a service moment, not a branding canvas.
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { tenant } from '../lib/theme'
import usePageTitle from '../lib/usePageTitle'

export default function NotFound() {
  usePageTitle('Page not found')

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  return (
    <div className="nf">
      <style>{NF_CSS}</style>

      <header className="nf__bar">
        <Link to="/" className="nf__back">
          <ArrowLeft size={15} aria-hidden="true" />
          Home
        </Link>
        <span className="nf__brand">{tenant.name}</span>
      </header>

      <main className="nf__wrap">
        <p className="nf__eyebrow">404 — page not found</p>
        <h1 className="nf__title">That page isn&rsquo;t here.</h1>
        <p className="nf__lede">
          The address may be mistyped, or the page may have moved. Nothing
          you were doing has been lost — here are the two most useful places
          to go next.
        </p>
        <div className="nf__links">
          <Link to="/" className="nf__cta nf__cta--solid">
            Back to the homepage
          </Link>
          <Link to="/book" className="nf__cta">
            See the class timetable
          </Link>
        </div>
      </main>
    </div>
  )
}

const NF_CSS = `
.nf {
  min-height: 100vh;
  min-height: 100svh;
  background: var(--paper, #efefef);
  color: var(--ink, #1c1c1c);
}
.nf__bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 18px 20px;
  max-width: 680px; margin: 0 auto;
}
.nf__back {
  display: inline-flex; align-items: center; gap: 7px;
  min-height: 44px; padding: 10px 2px;
  font-size: 13px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 66%, transparent);
  text-decoration: none;
}
.nf__back:hover { color: var(--ink); }
.nf__brand {
  font-family: var(--font-display); font-weight: 700;
  font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 72%, transparent);
}
.nf__wrap { max-width: 680px; margin: 0 auto; padding: 10vh 20px 90px; }
.nf__eyebrow {
  margin: 0 0 10px;
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 62%, transparent);
}
.nf__title {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(28px, 6vw, 40px); line-height: 1.08;
  letter-spacing: -0.015em;
  margin: 0 0 16px;
}
.nf__lede {
  margin: 0 0 30px;
  font-size: 16.5px; line-height: 1.62;
  max-width: 52ch;
  color: color-mix(in srgb, var(--ink) 80%, transparent);
}
.nf__links { display: flex; flex-wrap: wrap; gap: 12px; }
.nf__cta {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: 12px 22px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--ink) 24%, transparent);
  font-size: 14px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--ink); text-decoration: none;
  transition: border-color 160ms ease-out, background 160ms ease-out;
}
.nf__cta:hover { border-color: var(--ink); }
.nf__cta--solid {
  background: var(--ink); color: var(--paper, #efefef);
  border-color: var(--ink);
}
.nf__cta--solid:hover { background: color-mix(in srgb, var(--ink) 86%, transparent); }
.nf__cta:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .nf__cta { transition: none; }
}
`
