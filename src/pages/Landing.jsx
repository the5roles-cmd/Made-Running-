import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loginHref } from '../lib/authNext'
import { REGISTRATION_OPEN } from '../lib/registration'
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Play,
} from 'lucide-react'

// ============================================================
// MADE RUNNING — the "own your software" pitch page.
//
// The page carries the client's own name rather than a vendor product
// name. That is the argument, not just branding: the pitch is that this
// platform is theirs outright, so putting a separate product brand in
// the header would quietly contradict it — you cannot own something
// that still has someone else's name on the door. It also means the
// landing page and the post-login workspace finally agree; the tenant
// in src/lib/theme.js has always been "Made Running".
//
// Consequence to watch: PRODUCT is now the *reader*. Any sentence that
// used it as an actor ("X replaces your stack", "Ask X", "how X would
// run your Runners") turns into nonsense, because the reader IS Made
// Running. Those four were rewritten to a neutral noun — "this
// platform", "it". If you add copy, keep PRODUCT to labels: the
// wordmark, the footer, the mock's sidebar. Never the subject of a
// sentence addressed to the client.
// ============================================================

const PRODUCT = 'Made Running'
const PRODUCT_MARK = 'M'
const PRODUCT_TAGLINE = 'Manchester · UAE · US'

// ── Scroll-reveal: hardened IntersectionObserver + sweep fallback ──
//
// Failure modes addressed:
//   A. Scroll jump (End key, scrollbar drag, deep link, page restore): elements
//      registered AFTER the jump see no scroll event. The global registry poll
//      (runs every 80ms while any entry is pending) catches them regardless.
//   B. CSS transition frozen at currentTime:0: happens when the --in class is
//      added in the same paint frame as first insert. Fixed by data-instant which
//      kills the transition entirely for elements that were already past the
//      reveal line when their useEffect ran, or when motion is reduced/IO absent.
//   C. prefers-reduced-motion: both the CSS override and the instant path apply.

const revealRegistry = new Set()
let sweepBound = false
let pollId = null

// Has this element reached (or passed) the reveal line?
// r.top < 0 means it scrolled above the fold — still counts as "seen".
function hasReachedRevealLine(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight || document.documentElement.clientHeight
  return r.top < vh * 0.93
}

function sweepReveals() {
  if (revealRegistry.size === 0) return
  revealRegistry.forEach(({ el, reveal }) => {
    if (hasReachedRevealLine(el)) reveal()
  })
}

// Start a polling interval that keeps sweeping until all entries are resolved.
// This is the safety net for scroll jumps that happen between RAF ticks.
function startPoll() {
  if (pollId !== null) return
  pollId = setInterval(() => {
    sweepReveals()
    if (revealRegistry.size === 0) {
      clearInterval(pollId)
      pollId = null
    }
  }, 80)
}

function bindSweep() {
  if (sweepBound || typeof window === 'undefined') return
  sweepBound = true
  window.addEventListener('scroll', sweepReveals, { passive: true })
  window.addEventListener('resize', sweepReveals, { passive: true })
  document.addEventListener('visibilitychange', sweepReveals)
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children }) {
  const ref = useRef(null)
  const [state, setState] = useState({ visible: false, instant: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    // No motion / no IO → snap immediately, no CSS transition
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setState({ visible: true, instant: true })
      return undefined
    }

    // Already past the reveal line at mount time → snap, no transition.
    // Must NOT use CSS transition here: if the --in class is applied in the
    // same paint frame as first insert, the browser has no FROM state and the
    // transition freezes at currentTime:0, leaving opacity permanently at 0.
    if (hasReachedRevealLine(el)) {
      setState({ visible: true, instant: true })
      return undefined
    }

    // Element is below the fold: watch it with IO + global sweep + poll.
    const reveal = () => {
      setState({ visible: true, instant: false })
    }
    const entry = { el, reveal }
    revealRegistry.add(entry)
    bindSweep()
    startPoll() // keeps sweeping every 80ms until this and siblings are resolved

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal()
            io.disconnect()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      revealRegistry.delete(entry)
    }
  }, [])

  return (
    <Tag
      ref={ref}
      data-instant={state.instant ? '' : undefined}
      className={`tp-reveal ${state.visible ? 'tp-reveal--in' : ''} ${className}`.trim()}
      style={{
        transitionDelay: state.visible && !state.instant ? `${delay}ms` : '0ms',
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ── Data ──────────────────────────────────────────────────────

const PROOF_CHIPS = [
  { label: 'BBC-featured', icon: TrendingUp },
  { label: 'Manchester born', icon: MapPin },
  { label: 'Everyone welcome', icon: CheckCircle2 },
]

// The five doors from /start, echoed on the hero as small glass cards so a
// visitor can route themselves without leaving the film.
//
// Every one of them now goes through /login first, carrying its real
// destination in ?next=. That is one rule instead of five: sign in (or create
// an account) once, and the club knows who is booking a class, who is joining
// and who is buying — the whole point of having a CRM behind this page.
// Anyone with a live session never sees the form; Login redirects them
// straight to `dest`. See src/lib/authNext.js.
//
// `meta` is the promise each card makes, so it has to track the gate. Two of
// these used to read "No account needed" and "Instant booking", which stopped
// being true the moment the door moved behind sign-in.
//
// Computed once at module scope rather than inline in each card: the flag
// cannot change at runtime, so re-deriving it per render would be noise, and
// naming it makes any card that shares the promise visibly share it.
const SIGNIN_META = REGISTRATION_OPEN ? 'Sign in or sign up' : 'Sign in required'

const QUICK_PATHS = [
  // A card cannot promise a sign-up the login page does not offer, so these
  // two read "Sign in or sign up" only while REGISTRATION_OPEN is true. They
  // fall back to "Sign in required" when it is false — same door, honest
  // label. See src/lib/registration.js.
  { dest: '/join', label: 'I am a Runner', meta: SIGNIN_META },
  { dest: '/join', key: 'community', label: 'Join the Community', meta: 'Everyone welcome' },
  // Shop sits third — dead centre of the five — so the club's revenue door
  // is the one the eye lands on first as it scans the row. It points at the
  // in-app storefront rather than maderunning.com: an external link could
  // never be gated, and it contradicted the "Coming soon" pill further down
  // the page.
  { dest: '/app/shop', label: 'Shop', meta: 'Kit in the club colours' },
  // The only card that does NOT go through /login, and the only one that is a
  // real <a href> rather than a <Link>.
  //
  // Why it is exempt from the sign-in rule: everyone else on this row is
  // already a member or is about to become one, so gating them puts the club's
  // CRM record in place before anything else happens. A prospective coach is
  // the opposite — an outsider we are trying to attract. Asking a qualified
  // running coach to create an account before they can even read what we want
  // is how you lose them at the door. We collect the account later, if we hire.
  //
  // Why `external`: coach-application.html is a static file in public/, so it
  // is served by the host, not by React Router. <Link to="/coach-application
  // .html"> would push a client-side route the router has no match for and
  // land on the 404 page — the file is never requested. It needs a real
  // document load, which is exactly what <a href> does. See the render branch
  // in tp-hero__quick-grid below.
  {
    dest: '/coach-application.html',
    key: 'coach',
    external: true,
    label: 'Coach at Made Running',
    meta: 'No account needed',
  },
  // No login gate. /book is now the Hub timetable, which is public
  // information — the club posts it in group chats and on Instagram. Putting
  // a sign-in wall in front of "when is Yoga?" costs the club drop-ins and
  // protects nothing. The form at the end still captures who is coming.
  { dest: '/book', public: true, label: 'Book a Class', meta: 'See the timetable' },
]


// ── Community media wall ("Run It. Share It.") ──────────────────
// A Lululemon-style UGC mosaic, but VIDEO-NATIVE. Each tile upgrades to
// a live, autoplay-in-view <video> the instant a file exists at `video`;
// until then it shows `poster` (a real Made Running photo, treated as a
// reel cover) or, with neither, a branded "your reel here" slot. The
// client drops their @made.running reels into public/img/community/ and
// fills in the `video` paths below — no other change needed.
//
// EXACTLY 8 tiles, mirroring Lululemon's "Wear It. Share It." wall:
// one big hero left, two smalls top-centre, a tall centre offset down,
// a big hero right, two smalls bottom-left, one wide bottom-right.
// span drives the mosaic on a 6-column dense grid:
//   'big'   = 2 cols × 4 rows (the three tall heroes)
//   'small' = 1 col  × 2 rows
//   'wide'  = 2 cols × 2 rows
// KEEP THIS SOURCE ORDER: with grid-auto-flow:dense, the browser places
// tiles in order — the third 'big' lands in the centre hole at row 3,
// which is what creates the staggered Lululemon composition. Reordering
// spans will re-tile the wall (that's the editorial dial to turn).
const COMMUNITY_MEDIA = [
  { span: 'big', video: null, poster: '/img/hero-crew-1100.jpg', focus: '50% 30%', alt: 'Made Running members arm-in-arm on Deansgate, Manchester.' },
  { span: 'small', video: null, poster: '/img/support-1600.jpg', focus: '50% 32%', alt: 'One Made Running member holding another up after a session.' },
  { span: 'small', video: null, poster: null, handle: '@made.running' },
  { span: 'big', video: null, poster: '/img/hero-pack-1280.jpg', focus: '50% 38%', alt: 'The Made Running pack running down Deansgate.' },
  { span: 'big', video: null, poster: '/img/creed-vest-1600.jpg', focus: '50% 76%', alt: 'The back of a Made Running vest: No One Gets Left Behind.' },
  { span: 'small', video: null, poster: null, handle: '#NoOneGetsLeftBehind' },
  { span: 'small', video: null, poster: null, cta: true },
  { span: 'wide', video: null, poster: null, handle: '#MadeRunning' },
]

// One mosaic tile. Renders <video> when a src exists (autoplay only while
// in view — an 8-video wall that all play at once punishes mobile battery
// and data, so we play the visible ones and pause the rest, and never
// autoplay at all under prefers-reduced-motion), a poster <img> with a
// slow Ken Burns drift otherwise, or a branded slot when there's neither.
function MediaTile({ item }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !item.video) return undefined
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play?.().catch(() => {})
        else el.pause?.()
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [item.video])

  const cls = `tp-ugc__tile tp-ugc__tile--${item.span || 'base'}`

  if (item.video) {
    return (
      <div className={cls}>
        <video
          ref={ref}
          className="tp-ugc__media"
          src={item.video}
          poster={item.poster || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={item.alt || 'Community video'}
          style={item.focus ? { objectPosition: item.focus } : undefined}
        />
        <span className="tp-ugc__badge" aria-hidden="true"><Play size={15} fill="currentColor" /></span>
      </div>
    )
  }

  if (item.poster) {
    return (
      <div className={cls}>
        <img
          className="tp-ugc__media tp-ugc__media--kb"
          src={item.poster}
          loading="lazy"
          decoding="async"
          alt={item.alt || ''}
          style={item.focus ? { objectPosition: item.focus } : undefined}
        />
        <span className="tp-ugc__badge" aria-hidden="true"><Play size={15} fill="currentColor" /></span>
        <span className="tp-ugc__tag">Reel</span>
      </div>
    )
  }

  // Branded placeholder slot — reads as "drop your reel here".
  return (
    <div className={`${cls} tp-ugc__tile--slot`}>
      <span className="tp-ugc__slotmark">{PRODUCT_MARK}</span>
      <span className="tp-ugc__slottext">{item.cta ? 'Add yours' : item.handle || '@made.running'}</span>
      <span className="tp-ugc__slothint">{item.cta ? 'Tag us to feature' : 'Your reel here'}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = `${PRODUCT} — No One Gets Left Behind`
    return () => { document.title = prevTitle }
  }, [])

  return (
    <div className="tp">
      {/* ── Scoped styles ──────────────────────────────────────── */}
      <style>{`
        /* Reveal animation */
        .tp-reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 400ms cubic-bezier(0.22,0.61,0.36,1),
                      transform 400ms cubic-bezier(0.22,0.61,0.36,1);
        }
        .tp-reveal--in {
          opacity: 1;
          transform: none;
        }
        /* data-instant: element was already in view at mount time (scroll jump,
           deep link, page restore). Skip the transition entirely — the browser
           may not have painted the FROM state so a CSS transition would freeze
           at currentTime:0 and never reach opacity:1. Snap straight to final. */
        .tp-reveal[data-instant] {
          opacity: 1 !important;
          transform: none !important;
          transition: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          /* Kill the transition itself, not just the end state — otherwise a
             reveal caught mid-flight keeps easing to its destination instead
             of snapping straight to it. */
          .tp-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        /* Page shell.
           ── Black canvas ────────────────────────────────────────────
           The whole marketing page runs on Made Running's black, with the
           purple as the single accent. Rather than repaint 200 rules, the
           design tokens are re-declared HERE, scoped to .tp — every child
           already reads var(--bg)/var(--surface)/var(--ink)/var(--line),
           so the entire page inverts from this one block and the CRM app
           behind /app keeps its light theme untouched.
           Two things can't just invert:
             • --accent-ink is the TEXT purple. #5b21b6 was tuned for AA on
               light grey; on black it dies. It lifts to violet-400 (7.4:1).
             • status pills flip from light-on-white chips to translucent
               tints, which is what reads expensive on black. */
        .tp {
          --maxw: 1160px;
          --bg: #0a0a0a;
          --bg-2: #101010;
          --surface: #141414;
          --surface-2: #1b1b1b;
          --surface-raised: #1e1e1e;
          --ink: #f4f4f4;
          --ink-2: #e2e2e2;
          --muted: #a5a5a5;
          --faint: #7c7c7c;
          --line: #272727;
          --line-soft: #1f1f1f;
          --accent-ink: #a78bfa;
          /* The dark slab bands (marquee, creed, pricing, footer) used to be
             painted with var(--ink) back when ink WAS near-black. On the black
             canvas ink is off-white, so they get their own token: one step
             lighter than the page, which reads as a panel rather than a wall. */
          --tp-slab: #141414;
          --accent-soft: rgba(139, 92, 246, 0.14);
          --ok: #4ade80;
          --ok-bg: rgba(74, 222, 128, 0.13);
          --warn: #fbbf24;
          --warn-bg: rgba(251, 191, 36, 0.13);
          --danger: #f87171;
          --danger-bg: rgba(248, 113, 113, 0.13);
          --info: #7dd3fc;
          --info-bg: rgba(125, 211, 252, 0.13);
          background: var(--bg);
          color: var(--ink);
          font-family: var(--font-body);
          /* svh, with vh as the fallback — see .bk on the timetable. */
          min-height: 100vh;
          min-height: 100svh;
        }

        /* Overscroll/rubber-band gutter: without this the light app canvas
           flashes above the black page on iOS bounce scrolling. */
        body:has(.tp) { background: #0a0a0a; }

        /* ── 1. Nav ─────────────────────────────── */
        .tp-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: saturate(1.3) blur(12px);
          -webkit-backdrop-filter: saturate(1.3) blur(12px);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 clamp(20px, 5vw, 56px);
          height: 60px;
        }
        .tp-nav__brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--ink);
          text-decoration: none;
          min-height: 44px;
        }
        /* The only link in the header with no :hover rule, which meant
           app.css's global a:hover { text-decoration: underline } — at
           (0,1,1), beating this block's (0,1,0) — drew a line under the
           wordmark on hover. Every other control up here already re-states
           it; this one was missed because it is styled as a brand lockup
           rather than a button, so it never got a hover treatment at all. */
        .tp-nav__brand:hover { text-decoration: none; }
        .tp-nav__mark {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          background: var(--accent);
          color: var(--accent-contrast);
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .tp-nav__actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tp-nav__login {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--ink);
          border: 1px solid transparent;
          transition: border-color 200ms, background 200ms;
          min-height: 44px;
          white-space: nowrap;
        }
        .tp-nav__login:hover {
          border-color: var(--line);
          background: var(--surface-2);
          text-decoration: none;
        }
        .tp-nav__cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          background: var(--accent);
          color: var(--accent-contrast);
          border: 1px solid var(--accent);
          transition: filter 200ms;
          min-height: 44px;
          white-space: nowrap;
        }
        .tp-nav__cta:hover {
          filter: brightness(1.07);
          text-decoration: none;
        }
        /* The header is a space-between flex row whose three text items all
           carry white-space: nowrap, so it cannot reflow — it just overhangs,
           and the page's overflow-x: hidden slices the overhang silently
           rather than producing a scrollbar. At 375px the row measured 397px
           wide and the CTA's arrow was cut in half.

           This is fallout from the rename: the current wordmark sets ~50px
           wider than the previous one, which was the whole margin the row
           had — note that CSS comments inside this template literal ship to
           the browser, so the old name is deliberately not repeated. Rather
           than drop the wordmark or the Log in link — the client should see
           their product's name, and both doors belong in the header — the
           budget is tightened everywhere at once. Measured after: 333px of
           347px available. */
        @media (max-width: 430px) {
          .tp-nav { padding: 0 14px; gap: 10px; }
          .tp-nav__brand { font-size: 0.95rem; gap: 8px; }
          .tp-nav__mark { width: 27px; height: 27px; border-radius: 6px; }
          .tp-nav__actions { gap: 4px; }
          .tp-nav__login { padding: 8px 10px; }
          .tp-nav__cta { padding: 9px 12px; gap: 5px; }
        }

        /* ── 2. Hero ─────────────────────────────── */
        /* Full-bleed film hero. The <video> is an absolutely positioned
           background covering the whole section; copy + product mock sit on
           top of it inside a normal-flow inner container, so the section's
           height is always content-driven and the film simply covers whatever
           box results (no magic heights, no clipping). */
        .tp-hero {
          position: relative;
          overflow: hidden;
          /* Holds the frame while the film buffers — matches the film's own
             dark tones so first paint isn't a white flash. */
          background: #161514;
        }
        .tp-hero__film {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* The 16:9 source has the runner centred with sky above — biasing
             the crop window upward keeps her face in frame when the section
             is shorter than the file's natural cover height. */
          object-position: 50% 32%;
        }
        .tp-hero__scrim {
          position: absolute;
          inset: 0;
          /* Legibility insurance: any frame of the film may be bright, so the
             text never trusts the footage. Left-weighted for the copy column,
             plus a bottom lift for the chips; fades out over the right where
             the opaque mock card carries its own contrast. */
          background:
            linear-gradient(90deg, rgba(14,13,12,0.78) 0%, rgba(14,13,12,0.52) 44%, rgba(14,13,12,0.08) 74%),
            linear-gradient(0deg, rgba(14,13,12,0.5) 0%, rgba(14,13,12,0) 36%);
        }
        .tp-hero__inner {
          position: relative;
          z-index: 1;
          max-width: var(--maxw);
          margin: 0 auto;
          padding: clamp(64px, 9vw, 104px) clamp(20px, 5vw, 56px) clamp(56px, 8vw, 96px);
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: clamp(40px, 6vw, 80px);
          align-items: center;
          min-height: clamp(540px, 78vh, 780px);
        }
        @media (max-width: 800px) {
          .tp-hero__inner { grid-template-columns: 1fr; min-height: 0; }
          /* Single column means copy AND mock both sit over the film — the
             directional gradient no longer maps to the layout, so dim evenly. */
          .tp-hero__scrim {
            background: linear-gradient(180deg, rgba(14,13,12,0.68), rgba(14,13,12,0.5));
          }
        }
        .tp-hero__eyebrow {
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.85);
          margin-bottom: 20px;
        }
        .tp-hero__title {
          font-family: var(--font-display);
          font-size: clamp(2.1rem, 4vw, 3.2rem);
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0 0 24px;
        }
        .tp-hero__title em {
          font-style: italic;
          color: rgba(255,255,255,0.92);
        }
        .tp-hero__slogan {
          display: block;
          width: 100%;
          max-width: 620px;
          height: auto;             /* width/height attrs keep CLS at zero */
          filter: drop-shadow(0 2px 12px rgba(0,0,0,0.4));
        }
        /* Quick paths — the /start doors as small glass cards on the film.
           Spans both hero columns as the grid's second row. */
        .tp-hero__quick {
          grid-column: 1 / -1;
          margin-top: clamp(20px, 3vw, 36px);
        }
        .tp-hero__quick-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }
        .tp-qcard {
          /* Column flex, not block: the grid already stretches all five
             cards to a shared height, so pinning the caption to the bottom
             (margin-top:auto below) keeps the caption row level even when
             one label — "Coach at Made Running" — wraps to two lines. */
          display: flex;
          flex-direction: column;
          text-decoration: none;
          text-align: center;
          padding: 15px 12px 13px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(14,13,12,0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition:
            transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 240ms cubic-bezier(0.22, 1, 0.36, 1),
            background-color 240ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .tp-qcard:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.55);
          background: rgba(14,13,12,0.62);
          text-decoration: none;
        }
        .tp-qcard:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 2px;
        }
        .tp-qcard__label {
          display: block;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.82rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #ffffff;
          line-height: 1.2;
        }
        .tp-qcard__meta {
          display: block;
          margin-top: auto;
          padding-top: 5px;
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          /* 0.72 keeps this 10px caption above 4.5:1 on the dimmed card */
          color: rgba(255,255,255,0.72);
        }
        @media (max-width: 1000px) {
          .tp-hero__quick-grid { grid-template-columns: repeat(2, 1fr); }
          /* Five on two columns: the odd one spans, echoing /start */
          .tp-hero__quick-grid > :last-child { grid-column: 1 / -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-qcard { transition: none; }
          .tp-qcard:hover { transform: none; }
        }
        /* CTAs invert on the dark film — scoped so the same button classes
           keep their ink-on-light form everywhere else on the page. */
        .tp-hero .tp-btn-primary {
          background: #ffffff;
          border-color: #ffffff;
          color: #1c1c1c;
        }
        .tp-hero .tp-btn-primary:hover { filter: brightness(0.94); }

.tp-hero__ctas {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .tp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 24px;
          border-radius: 7px;
          font-size: 0.9rem;
          font-weight: 600;
          background: var(--accent);
          color: var(--accent-contrast);
          border: 1px solid var(--accent);
          transition: filter 200ms;
          min-height: 44px;
        }
        .tp-btn-primary:hover {
          filter: brightness(1.07);
          text-decoration: none;
        }

/* Right column of the film hero: nothing but the club's white
           wordmark, pushed to the right edge of the grid column so the
           section reads copy-left / brand-right over the film. */
        .tp-hero__brand {
          display: flex;
          justify-content: flex-end;
        }
        .tp-hero__logo {
          display: block;
          width: min(250px, 100%);
          height: auto;             /* with width/height attrs = no CLS */
          filter: drop-shadow(0 2px 14px rgba(0,0,0,0.35));
        }
        @media (max-width: 800px) {
          /* Single column: the wordmark centres under the copy and drops to
             a supporting size so the film + headline stay the event. */
          .tp-hero__brand { justify-content: center; }
          .tp-hero__logo { width: min(190px, 55%); }
        }

        /* ── 3. Proof chips row ──────────────── */
        .tp-proofrow {
          padding: clamp(28px, 4vw, 40px) clamp(20px, 5vw, 56px);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          background: var(--surface);
        }
        .tp-proofrow__inner {
          max-width: var(--maxw);
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: clamp(16px, 3vw, 40px);
          flex-wrap: wrap;
          justify-content: center;
        }
        .tp-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--line);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--ink-2);
          white-space: nowrap;
        }
        .tp-chip__icon { color: var(--accent-ink); }

        /* ── 3b. Dark marquee band ───────────── */
        .tp-marquee {
          background: var(--tp-slab);
          overflow: hidden;
          padding: 14px 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .tp-marquee__track {
          display: flex;
          width: max-content;
          animation: tp-scroll 28s linear infinite;
          gap: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-marquee__track { animation: none; }
        }
        @keyframes tp-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .tp-marquee__item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 28px;
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tp-marquee__dot {
          width: 4px;
          height: 4px;
          border-radius: 999px;
          /* NOT var(--accent). Made Running's theme sets --accent to #1c1c1c,
             the same value as --ink, because the brand is monochrome and takes
             its emphasis from contrast and weight rather than hue. On this band
             --ink IS the background, so an accent dot would be invisible. A
             white alpha is the only thing guaranteed to read on a dark band
             across every tenant. */
          background: rgba(255,255,255,0.38);
          flex-shrink: 0;
        }

        /* ── Creed band ────────────────────────
           Two of Made Running's own photographs flanking the line that is
           already printed on the back of their race vests. The type sits in
           its own dark column rather than on top of an image: no scrim, no
           contrast gamble at any viewport, and neither photograph gets a text
           box parked across the subject. */
        .tp-creed {
          background: var(--tp-slab);
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          align-items: stretch;
        }
        /* The photos live in positioned frames and fill them absolutely. This
           is not decoration — a stretched grid item with height:100% is a
           circular constraint (row height depends on the item, item height
           depends on the row), and the browser breaks the cycle by falling
           back to the image's intrinsic size. That handed a 1280x1600 photo an
           868px row. Taking the images out of flow leaves the copy column as
           the only thing with an opinion about how tall this band is. */
        .tp-creed__frame {
          position: relative;
          overflow: hidden;
          min-height: 380px;
        }
        .tp-creed__img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        /* Both sources are tall portraits dropped into landscape frames, so
           cover() discards most of the vertical extent and the default centre
           crop lands on the wrong thing. These two numbers are the whole point
           of each photograph: 76% puts the printed line in frame instead of
           slicing it in half, 32% keeps the two runners' faces rather than
           their shoulders. */
        .tp-creed__img--creed { object-position: 50% 76%; }
        .tp-creed__img--support { object-position: 50% 32%; }
        .tp-creed__copy {
          padding: clamp(48px, 6vw, 92px) clamp(24px, 4vw, 56px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }
        /* "About us" was a 11.5px grey label while its neighbours ("Our story",
           "Shop") led with a 40px headline — so it read as a footnote to the
           band rather than the name of it. It now carries .tp-h2 and the band
           follows the exact same three-step rhythm as the other two sections:
           white headline → white display standfirst → body copy. */
        .tp-creed__h2 { color: #fff; margin-bottom: 16px; }
        .tp-creed__quote {
          font-family: var(--font-display);
          /* The same clamp() as .tp-story__tagline. The quote is the standfirst
             here, not the headline — two 40px lines stacked would flatten the
             band into one undifferentiated block. */
          font-size: clamp(1.25rem, 1.9vw, 1.35rem);
          font-weight: 500;
          line-height: 1.3;
          letter-spacing: -0.005em;
          color: #fff;
          margin: 0 0 18px;
        }
        .tp-creed__body {
          font-size: 0.98rem;
          line-height: 1.65;
          color: rgba(255,255,255,0.66);
          margin: 0 auto;
          max-width: 44ch;
        }
        @media (max-width: 860px) {
          .tp-creed { grid-template-columns: 1fr; }
          /* One photograph is plenty on a phone. Keeping both would push the
             closing CTA the better part of a screen further down for no
             extra argument. */
          .tp-creed__frame--second { display: none; }
          /* 42vh/340px pushed the quote below the fold on a 390×844 phone, so
             the photo and the line it is illustrating were never on screen
             together. 34vh/280px gets both into one view. */
          .tp-creed__frame { min-height: 0; height: 34vh; max-height: 280px; }
          .tp-creed__copy { padding: 36px 22px 44px; }
          /* 15.68px is below the 16px comfortable-reading floor on a phone,
             and this is the longest paragraph left on the page. */
          .tp-creed__body {
            font-size: 1rem;
            line-height: 1.7;
          }
        }

        /* ── 6b. Shop ──────────── */
        .tp-shop {
          background: var(--tp-slab);
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: stretch;
        }
        /* Same absolutely-positioned frame trick as .tp-creed above: a
           stretched grid item cannot derive its height from a row whose height
           depends on it, so the photo is taken out of flow and the copy column
           is left as the only thing with an opinion about the band's height. */
        .tp-shop__frame {
          position: relative;
          overflow: hidden;
          min-height: 420px;
        }
        .tp-shop__img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* Same tall-portrait-in-a-landscape-frame problem as the creed band:
             centre-cropping slices the printed line in half. 68% still clipped
             the descender of "BEHIND" against the bottom edge; 74% shows the
             lower slice of the source and lands the full lockup in frame. */
          object-position: 50% 74%;
        }
        .tp-shop__copy {
          padding: clamp(48px, 6vw, 92px) clamp(24px, 5vw, 72px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          text-align: left;
        }
        /* Nested deliberately. .tp-shop__lede and .tp-lede are both single-class
           selectors, so they tie on specificity and source order decides — and
           .tp-lede is declared further down with "margin: 0 auto", which was
           silently zeroing the bottom margin. The pill ended up welded to the
           last line of the paragraph with a 0px gap. Nesting takes this to
           (0,2,0) so it actually wins. Measure is left to .tp-lede. */
        .tp-shop .tp-shop__lede {
          margin: 0 0 28px;
        }
        .tp-shop__h2 {
          color: #fff;
        }
        /* Reads as a status pill, not a button — outlined and muted rather
           than the solid accent fill, so nobody tries to click it. */
        .tp-shop__soon {
          display: inline-flex;
          align-items: center;
          padding: 11px 22px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.04);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.72);
        }
        @media (max-width: 860px) {
          .tp-shop { grid-template-columns: 1fr; }
          .tp-shop__frame { min-height: 0; height: 46vh; max-height: 360px; }
        }

/* ── 5. Generic section shell ─────────── */
        .tp-section {
          padding: clamp(56px, 8vw, 88px) clamp(20px, 5vw, 56px);
        }
        .tp-section__inner {
          max-width: var(--maxw);
          margin: 0 auto;
        }
        
        .tp-eyebrow {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent-ink);
          margin-bottom: 14px;
        }
        .tp-h2 {
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          font-weight: 500;
          line-height: 1.12;
          letter-spacing: -0.015em;
          color: var(--ink);
          margin: 0 0 16px;
        }
        .tp-lede {
          font-size: 1.05rem;
          color: var(--muted);
          line-height: 1.65;
          max-width: 56ch;
          margin: 0 auto;
        }
        /* ── 6. Our story ──────────── */
        .tp-story {
          text-align: center;
        }
        /* "Our story" is the headline; this line sits under it in the same
           display face, white, at reading size — a standfirst rather than the
           purple category tag the other sections use. */
        .tp-story__tagline {
          font-family: var(--font-display);
          /* 1.05rem as the floor collapsed to 16.8px on a phone — identical to
             the body copy right beneath it, so the standfirst stopped reading
             as a standfirst. A 1.25rem floor keeps a visible 28 / 20 / 16 step
             on mobile; the 1.35rem ceiling means desktop is unchanged. */
          font-size: clamp(1.25rem, 1.9vw, 1.35rem);
          font-weight: 500;
          line-height: 1.3;
          letter-spacing: -0.005em;
          color: #fff;
          /* The global "p { max-width: 66ch }" reset capped this at 957px inside
             a 1160px column. text-align:center only centres text within that
             957px box, and with no auto side margins the box hugged the left —
             so the line sat ~100px left of the section's optical centre. The
             auto margins centre the box itself. */
          margin: 0 auto 22px;
        }
        /* --ink is #f4f4f4, a deliberate off-white for long-form reading. The
           story headline is the one line that should be pure white. */
        .tp-story__h2 {
          color: #fff;
        }
        /* Was an inline style="margin: 0 auto" — which won over the stylesheet
           and zeroed the gap between the two paragraphs. Kept in CSS so the
           paragraph rhythm is actually overridable. */
        .tp-story__p {
          max-width: 52ch;
          margin-left: auto;
          margin-right: auto;
        }
        .tp-story__p + .tp-story__p {
          margin-top: 20px;
        }
        /* Three club facts, evenly weighted — no "versus" framing, because
           there is nothing being argued against any more. auto-fit means the
           row folds 3 → 1 on narrow screens without a media query. */
        .tp-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: clamp(20px, 4vw, 48px);
          max-width: 680px;
          margin: clamp(40px, 6vw, 60px) auto 0;
          padding-top: clamp(28px, 4vw, 40px);
          border-top: 1px solid var(--line);
        }
        .tp-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .tp-stat__num {
          font-family: var(--font-display, inherit);
          font-size: clamp(2rem, 5vw, 2.9rem);
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .tp-stat__label {
          font-size: 0.74rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--muted);
          /* 18ch was ~117px, just under the ~126px that "STRONG COMMUNITY"
             needs once uppercased and letter-spaced — so every label but the
             shortest wrapped to two lines and the row went ragged. */
          max-width: 24ch;
          line-height: 1.4;
        }

/* ── 9. Footer CTA + footer ──────────── */
        .tp-footer-cta {
          padding: clamp(56px, 8vw, 96px) clamp(20px, 5vw, 56px);
          background: var(--accent);
          text-align: center;
        }
        .tp-footer-cta__eyebrow {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.7);
          margin-bottom: 16px;
        }
        .tp-footer-cta__title {
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 3.5vw, 2.75rem);
          font-weight: 500;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.015em;
          margin: 0 0 14px;
          max-width: 18ch;
          margin-left: auto;
          margin-right: auto;
        }
        .tp-footer-cta__sub {
          font-size: 1rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.6;
          max-width: 46ch;
          margin: 0 auto 36px;
        }
        .tp-footer-cta__btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 7px;
          font-size: 0.9rem;
          font-weight: 600;
          background: #fff;
          /* Hardcoded, not var(--accent-ink): this is the one purple that
             sits ON white, so it must stay the dark tone even though the
             page's text-purple lifted to violet-400 for the black canvas. */
          color: #5b21b6;
          border: 1px solid transparent;
          transition: filter 200ms;
          min-height: 44px;
        }
        .tp-footer-cta__btn:hover {
          filter: brightness(0.96);
          text-decoration: none;
        }
        .tp-footer {
          padding: 24px clamp(20px, 5vw, 56px);
          background: var(--tp-slab);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .tp-footer__brand {
          font-family: var(--font-display);
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tp-footer__mark {
          width: 24px;
          height: 24px;
          border-radius: 5px;
          background: var(--accent);
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .tp-footer__tagline {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.35);
          font-weight: 400;
        }
        /* <address> is the correct element for the club's contact details, but
           browsers italicise it by default — reset that so it matches the rest
           of the footer rather than looking like a quotation. */
        .tp-footer__addr {
          font-style: normal;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.45);
          line-height: 1.5;
        }
        .tp-footer__copy {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.25);
        }

        /* ── Community media wall (Run It. Share It.) ─────────── */
        .tp-ugc {
          max-width: var(--maxw);
          margin: 0 auto;
          padding: clamp(56px, 8vw, 110px) clamp(16px, 4vw, 40px);
        }
        .tp-ugc__head {
          text-align: center;
          max-width: 620px;
          margin: 0 auto clamp(28px, 4vw, 48px);
        }
        .tp-ugc__title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3.2rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
          margin: 10px 0 12px;
          color: var(--ink);
        }
        .tp-ugc__sub { font-size: 0.98rem; line-height: 1.6; color: var(--muted); margin: 0; }
        .tp-ugc__sub strong { color: var(--ink); font-weight: 600; }
        .tp-ugc__grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          grid-auto-rows: clamp(56px, 6.5vw, 92px);
          grid-auto-flow: dense;
          gap: 10px;
        }
        .tp-ugc__tile {
          position: relative;
          overflow: hidden;
          border-radius: 14px;
          background: var(--surface-2);
          grid-row: span 2;              /* small: 1 col × 2 rows */
        }
        .tp-ugc__tile--big {
          grid-column: span 2;
          grid-row: span 4;              /* big: 2 col × 4 rows (tall hero) */
        }
        .tp-ugc__tile--wide {
          grid-column: span 2;
          grid-row: span 2;              /* wide: 2 col × 2 rows */
        }
        .tp-ugc__media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .tp-ugc__tile:hover .tp-ugc__media { transform: scale(1.05); }
        /* Slow, barely-there drift so the poster tiles feel alive before a
           real video is dropped in. transform-origin sits high so faces
           stay in frame as it zooms. */
        .tp-ugc__media--kb {
          animation: tp-ugc-kb 22s ease-in-out infinite alternate;
          transform-origin: 50% 38%;
        }
        @keyframes tp-ugc-kb { from { transform: scale(1); } to { transform: scale(1.09); } }
        .tp-ugc__badge {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #fff;
          background: rgba(0, 0, 0, 0.52);
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
        }
        .tp-ugc__tag {
          position: absolute;
          left: 12px;
          bottom: 12px;
          font-size: 0.64rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
          color: #fff;
          background: rgba(0, 0, 0, 0.58);
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
          padding: 3px 9px;
          border-radius: 999px;
        }
        .tp-ugc__tile--slot {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
          padding: 12px;
          background: var(--surface-2);
          border: 1px dashed var(--line);
        }
        .tp-ugc__slotmark {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: var(--accent);
          color: var(--accent-contrast);
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1rem;
        }
        .tp-ugc__slottext { font-size: 0.8rem; font-weight: 600; color: var(--ink); line-height: 1.2; }
        .tp-ugc__slothint { font-size: 0.68rem; color: var(--muted); }
        @media (max-width: 640px) {
          /* Re-tiled for the thumb, not shrunk: 2 columns, the tall heroes
             become full-bleed portrait bands, smalls pair up between them.
             Row math stays gapless: 3×(2×3) + 4×(1×2) + 1×(2×2) fills
             2 columns exactly. */
          .tp-ugc__grid {
            grid-template-columns: repeat(2, 1fr);
            grid-auto-rows: clamp(64px, 18vw, 92px);
            gap: 8px;
          }
          .tp-ugc__tile { grid-row: span 2; }
          .tp-ugc__tile--big { grid-column: span 2; grid-row: span 3; }
          .tp-ugc__tile--wide { grid-column: span 2; grid-row: span 2; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-ugc__media--kb { animation: none; }
          .tp-ugc__tile:hover .tp-ugc__media { transform: none; }
        }
      `}</style>

      {/* ── 1. Sticky nav ─────────────────────────────────────── */}
      <header className="tp-nav">
        <Link to="/" className="tp-nav__brand">
          <span className="tp-nav__mark">{PRODUCT_MARK}</span>
          {PRODUCT}
        </Link>
        <nav className="tp-nav__actions">
          {/* Both used to enter through the /start door-chooser. Now that the
              hero cards go straight to /login, a button labelled "Log in" that
              opened a menu of doors instead was the odd one out — and the
              chooser still advertised the old ungated destinations. Both land
              on /login; the two tabs there are exactly the two intents. */}
          <Link to={loginHref('/app')} className="tp-nav__login">Log in</Link>
          <Link to={loginHref('/join')} className="tp-nav__cta">
            Get started <ArrowRight size={13} />
          </Link>
        </nav>
      </header>

      {/* ── 2. Hero ───────────────────────────────────────────── */}
      <section className="tp-hero">
        {/* Made Running's own film, landscape across the entire section.
            Absolutely positioned + object-fit: cover so the section's height
            stays content-driven and the film covers whatever box results.
            Muted + playsInline are what allow autoplay at all on iOS; under
            prefers-reduced-motion we never autoplay and the poster stays. */}
        <video
          className="tp-hero__film"
          src="/video/made-hero.mp4"
          poster="/img/hero-crew-1100.jpg"
          autoPlay={!prefersReducedMotion()}
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Made Running film: a runner catching her breath in the morning sun."
        />
        <div className="tp-hero__scrim" aria-hidden="true" />
        <div className="tp-hero__inner">
        <Reveal className="tp-hero__text" as="div">
          <div className="tp-hero__eyebrow">UK &middot; UAE &middot; US</div>
          {/* The club's own slogan lockup (from Slogan-Without-Logo.pdf),
              keyed to white-on-transparent. Wrapped in the h1 so the page
              keeps a real headline for screen readers and SEO. */}
          <h1 className="tp-hero__title">
            <img
              className="tp-hero__slogan"
              src="/img/slogan-white.png"
              alt="No One Gets Left Behind"
              width={1600}
              height={232}
            />
          </h1>
          <div className="tp-hero__ctas">
            {/* One door, front and centre — same destination as its quick
                card below, so the promise and the button never disagree. */}
            {/* Through the same gate as the quick cards below it. Leaving the
                hero's biggest button as the one ungated way in would have made
                the sign-in step look optional. */}
            <Link to={loginHref('/join')} className="tp-btn-primary">
              Join the Community <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <Reveal className="tp-hero__brand" as="div" delay={100}>
          {/* The club's own white wordmark, stamped over their own film.
              webp is white-on-transparent, so it only exists on dark. */}
          <img
            className="tp-hero__logo"
            src="/img/made-logo-white.webp"
            alt="Made Running"
            width={5760}
            height={1885}
          />
        </Reveal>

        {/* The five doors, small. Full-width row under both hero columns. */}
        <Reveal className="tp-hero__quick" as="div" delay={180}>
          <nav className="tp-hero__quick-grid" aria-label="Choose your path">
            {/* Two branches, because two different kinds of destination.
                `external: true` means the target is a real file the host
                serves (the coach application form in public/), not a route
                React Router knows about — a <Link> would push a path with no
                matching route and show the 404 page. Everything else is an
                in-app route and goes through /login via loginHref. */}
            {QUICK_PATHS.map((p) => {
              const inner = (
                <>
                  <span className="tp-qcard__label">{p.label}</span>
                  <span className="tp-qcard__meta">{p.meta}</span>
                </>
              )
              // Three kinds of destination, not two:
              //   external → a real file the host serves (coach form)
              //   public   → an in-app route with no sign-in gate (/book)
              //   default  → an in-app route behind /login
              if (p.external) {
                return (
                  <a key={p.key || p.dest} href={p.dest} className="tp-qcard">
                    {inner}
                  </a>
                )
              }
              return (
                <Link
                  key={p.key || p.dest}
                  to={p.public ? p.dest : loginHref(p.dest)}
                  className="tp-qcard"
                >
                  {inner}
                </Link>
              )
            })}
          </nav>
        </Reveal>
        </div>
      </section>

      {/* ── 3. Proof chips ────────────────────────────────────── */}
      <div className="tp-proofrow">
        <Reveal className="tp-proofrow__inner" as="div">
          {PROOF_CHIPS.map(({ label, icon: Icon }) => (
            <div className="tp-chip" key={label}>
              <span className="tp-chip__icon"><Icon size={13} strokeWidth={2} /></span>
              {label}
            </div>
          ))}
        </Reveal>
      </div>

      {/* ── 3b. Dark marquee band ────────────────────────────── */}
      {(() => {
        const items = [
          '85k Instagram community',
          'BBC News & Sport coverage',
          'boohooMAN collab',
          'Balenciaga collab',
          "Barry's Bootcamp collab",
          'Manchester + 4 chapters',
          'No One Gets Left Behind',
          '85k Instagram community',
          'BBC News & Sport coverage',
          'boohooMAN collab',
          'Balenciaga collab',
          "Barry's Bootcamp collab",
          'Manchester + 4 chapters',
          'No One Gets Left Behind',
        ]
        return (
          <div className="tp-marquee" aria-hidden="true">
            <div className="tp-marquee__track">
              {items.map((item, i) => (
                <span className="tp-marquee__item" key={i}>
                  <span className="tp-marquee__dot" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── 6. Our story ───────────────────────────────────────
          Every number below is one the club already states publicly and
          that the marquee above repeats — 85k, Manchester + 4 chapters,
          UK/UAE/US. Nothing here is invented, so nothing here can be
          contradicted by the club's own Instagram. */}
      <section className="tp-section">
        <div className="tp-section__inner">
          <Reveal className="tp-story" as="div">
            <h2 className="tp-h2 tp-story__h2">Our story</h2>
            <p className="tp-story__tagline">
              It started with a run<br />and an open invitation.
            </p>
            <p className="tp-lede tp-story__p">
              Made Running began in Manchester with a simple idea: put a run on the
              calendar, tell everyone they are welcome, and wait at the top of the hill
              for whoever needs the extra minute. No membership. No qualifying pace.
              No one left behind.
            </p>
            <p className="tp-lede tp-story__p">
              That invitation travelled. What began as one city is now five chapters
              across three countries, a community of thousands, and a name that
              everyone now comes looking for. The run never changed &mdash; more
              people just started showing up.
            </p>
            <div className="tp-stats">
              <div className="tp-stat">
                <span className="tp-stat__num">85k</span>
                <span className="tp-stat__label">Strong community</span>
              </div>
              <div className="tp-stat">
                <span className="tp-stat__num">5</span>
                <span className="tp-stat__label">Chapters worldwide</span>
              </div>
              <div className="tp-stat">
                <span className="tp-stat__num">3</span>
                <span className="tp-stat__label">Countries</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 6b. Shop ──────────────────────────────────────────────
          Sits between the story and the community wall: you read who the club
          is, then you can wear it, then you see everyone wearing it. The photo
          is the club's own vest — real product, not a stock mock-up — so this
          band is honest before a single product shot arrives. Swap in a proper
          lookbook image at /img/shop-*.jpg and only the <img> changes. */}
      <section className="tp-shop" id="shop">
        <div className="tp-shop__frame">
          <img
            className="tp-shop__img"
            src="/img/creed-vest-1600.jpg"
            srcSet="/img/creed-vest-900.jpg 720w, /img/creed-vest-1600.jpg 1280w"
            sizes="(max-width: 860px) 100vw, 45vw"
            loading="lazy"
            decoding="async"
            alt="A Made Running vest, printed with No One Gets Left Behind."
          />
        </div>
        <Reveal className="tp-shop__copy" as="div">
          {/* The section name is the headline now, so the purple "SHOP"
              eyebrow that used to sit above it would just repeat the word. */}
          <h2 className="tp-h2 tp-shop__h2">Shop</h2>
          <p className="tp-lede tp-shop__lede">
            Vests, tees and layers in the club&rsquo;s own colours. Every piece
            carries the line that started it &mdash; and you will spot it on
            every start line from Manchester to Dubai.
          </p>
          {/* Deliberately not a link. A control labelled "Coming soon" that
              navigates to a live storefront promises one thing and does
              another; when the shop opens, swap this <span> back for the
              <a href="https://maderunning.com"> that was here. */}
          <span className="tp-shop__soon">Coming soon</span>
        </Reveal>
      </section>

      {/* ── 7. Community media wall ───────────────────────────────
          The Lululemon "Wear It. Share It." move, in Made Running's voice.
          A video-native mosaic: every tile upgrades to a live autoplay-in-
          view <video> the moment a file is dropped at its `video` path;
          until then it shows the club's own reel-cover photos and branded
          "tag us" slots. Proof that the members make the brand. */}
      <section className="tp-ugc" aria-labelledby="ugc-title">
        <Reveal className="tp-ugc__head" as="div">
          <div className="tp-eyebrow">The community</div>
          <h2 className="tp-ugc__title" id="ugc-title">Run It. Share It.</h2>
          <p className="tp-ugc__sub">
            Tag <strong>@made.running</strong> or use <strong>#NoOneGetsLeftBehind</strong> to be featured on the wall.
          </p>
        </Reveal>
        <Reveal className="tp-ugc__grid" as="div">
          {COMMUNITY_MEDIA.map((item, i) => (
            <MediaTile key={i} item={item} />
          ))}
        </Reveal>
      </section>

      {/* ── 7b. About us / creed band ─────────────────────────────
          The club's own words, in the club's own photographs. It lands after
          the community wall on purpose: you see who shows up first, then read
          the one rule that explains why they keep showing up. */}
      <section className="tp-creed">
        <div className="tp-creed__frame">
          <img
            className="tp-creed__img tp-creed__img--creed"
            src="/img/creed-vest-1600.jpg"
            srcSet="/img/creed-vest-900.jpg 720w, /img/creed-vest-1600.jpg 1280w"
            sizes="(max-width: 860px) 100vw, 30vw"
            loading="lazy"
            decoding="async"
            alt="The back of a Made Running race vest reading No One Gets Left Behind."
          />
        </div>
        <Reveal className="tp-creed__copy" as="div">
          <h2 className="tp-h2 tp-creed__h2">About us</h2>
          <p className="tp-creed__quote">&ldquo;No one gets left behind.&rdquo;</p>
          <p className="tp-creed__body">
            It is printed on the back of our vests because it is the only rule
            we have. The group moves at the pace of the person at the back, and
            somebody always runs with them. First 5k or chasing a personal best,
            every session ends the same way &mdash; everyone in, nobody waiting
            alone at the finish.
          </p>
        </Reveal>
        <div className="tp-creed__frame tp-creed__frame--second">
          <img
            className="tp-creed__img tp-creed__img--support"
            src="/img/support-1600.jpg"
            srcSet="/img/support-900.jpg 726w, /img/support-1600.jpg 1290w"
            sizes="30vw"
            loading="lazy"
            decoding="async"
            alt="One Made Running member supporting another after a session."
          />
        </div>
      </section>

      {/* ── 9. Footer CTA panel ───────────────────────────────── */}
      <section className="tp-footer-cta">
        <Reveal as="div">
          <div className="tp-footer-cta__eyebrow">Ready when you are</div>
          <h2 className="tp-footer-cta__title">
            Come and run with us.
          </h2>
          <p className="tp-footer-cta__sub">
            Whether it is your first mile or your fastest, there is a group here
            that moves at your pace. Turn up, say hello, run.
          </p>
          <Link to={loginHref('/join')} className="tp-footer-cta__btn">
            Join the Community <ArrowRight size={14} />
          </Link>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="tp-footer">
        <div className="tp-footer__brand">
          <span className="tp-footer__mark">{PRODUCT_MARK}</span>
          {PRODUCT}
          <span className="tp-footer__tagline">&middot; {PRODUCT_TAGLINE}</span>
        </div>
        <address className="tp-footer__addr">
          Made Running, Manchester, M8 8HQ
        </address>
        <span className="tp-footer__copy">
          &copy; {new Date().getFullYear()} Made Running &mdash; &ldquo;No One Gets Left Behind&rdquo;
        </span>
      </footer>
    </div>
  )
}
