import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loginHref, signupHref } from '../lib/authNext'
import { REGISTRATION_OPEN } from '../lib/registration'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { InstagramMark } from '../components/BrandMarks'
import BrandLogo from '../components/BrandLogo'
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  MapPin,
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

// ── The club's own channels ──────────────────────────────────────────────
// Named here rather than inlined at the one <a> that uses it today, because
// the marquee already claims "85k Instagram community" a few sections up and
// the share row offers to post there. The moment a second link appears, the
// two must not be able to drift apart.
//
// The ?hl=en the club gave us is dropped deliberately: it pins the page to
// English for everyone, including the UAE and US chapters this site names in
// its own tagline. Instagram localises from the viewer's own account
// otherwise, which is the better default and is what the bare profile URL
// gives. Nothing else about the destination changes.
const SOCIALS = {
  instagram: 'https://www.instagram.com/made.running/',
}

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

// Hero film source, decided ONCE at module load rather than reactively. The
// original export was 5.1MB — more than half the homepage's entire first
// load (QA, Oct 2026) — so it now ships as two encodes: 1280px/CRF30 (2.6MB)
// for laptops and 720px/CRF30 (1.0MB) for phones. Module-level on purpose:
// a <video> that swaps src on window resize restarts its download and
// flashes black mid-view, which costs more than the bytes it saves. Someone
// rotating a tablet keeps whichever film they started with.
const HERO_SRC =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 800px)').matches
    ? '/video/made-hero-720.mp4'
    : '/video/made-hero-1280.mp4'

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

// ── Parallax: compositor-only scroll drift ───────────────────────────
//
// The club asked for parallax scrolling, with the emphasis on SMOOTH — so
// the engine is built around the three things that make scroll effects
// stutter, and avoids each:
//   1. Work in the scroll handler → here the handler only schedules one
//      requestAnimationFrame; all measuring/writing happens in the frame,
//      coalesced across every registered surface (same registry pattern as
//      revealRegistry above).
//   2. Layout-triggering properties → only `transform` is ever written,
//      which stays on the compositor. No top/margin/background-position.
//   3. Measurement feedback → the element being moved is never measured.
//      Each surface is an absolutely-positioned cover image inside an
//      overflow:hidden frame, and the FRAME (el.parentElement) is what gets
//      measured — it never has a transform, so reads are stable and there
//      is no drift loop from reading back our own translate.
//
// The scale() is not decoration: it is the overscan budget. A cover image
// translated inside its frame exposes a gap at the opposite edge unless it
// is first zoomed past the frame. budget = height·(scale−1)/2 is exactly
// how far it can travel before an edge shows, and y is clamped to that, so
// a gap is impossible by construction rather than by tuning.
//
// prefers-reduced-motion: the hook simply never registers, leaving the
// static object-position crops (which were chosen per-photo) untouched.

const parallaxRegistry = new Set()
let parallaxBound = false
let parallaxRaf = 0

function parallaxFrame() {
  parallaxRaf = 0
  const vh = window.innerHeight || document.documentElement.clientHeight || 1
  parallaxRegistry.forEach(({ el, speed, scale }) => {
    const frame = el.parentElement
    if (!frame) return
    const r = frame.getBoundingClientRect()
    // Offscreen (with margin): skip the style write entirely.
    if (r.bottom < -120 || r.top > vh + 120) return
    const mid = r.top + r.height / 2
    let y = (vh / 2 - mid) * speed
    const budget = (r.height * (scale - 1)) / 2
    if (y > budget) y = budget
    if (y < -budget) y = -budget
    el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale})`
  })
}

function scheduleParallaxFrame() {
  if (!parallaxRaf) parallaxRaf = requestAnimationFrame(parallaxFrame)
}

function useParallax(speed = 0.08, scale = 1.1) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return undefined
    const entry = { el, speed, scale }
    parallaxRegistry.add(entry)
    if (!parallaxBound) {
      parallaxBound = true
      window.addEventListener('scroll', scheduleParallaxFrame, { passive: true })
      window.addEventListener('resize', scheduleParallaxFrame, { passive: true })
    }
    scheduleParallaxFrame() // position correctly before the first scroll
    return () => {
      parallaxRegistry.delete(entry)
      el.style.transform = ''
    }
  }, [speed, scale])
  return ref
}

// ── Data ──────────────────────────────────────────────────────

const PROOF_CHIPS = [
  { label: 'BBC-featured', icon: TrendingUp },
  { label: 'Manchester born', icon: MapPin },
  { label: 'Everyone welcome', icon: CheckCircle2 },
]

// The four doors from /start, echoed on the hero as small glass cards so a
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
const SIGNIN_META = REGISTRATION_OPEN ? 'Create your account' : 'Sign in required'

const QUICK_PATHS = [
  // ONE join door, not two. "I am a Runner" and "Join the Community" both
  // pointed at /join, and a visitor who read both labels had to guess what
  // the difference was — there wasn't one (QA, Oct 2026). Merged: the label
  // keeps the club's phrase, the meta names both audiences. `signup: true`
  // routes it through signupHref so a newcomer lands on the Create account
  // tab, not the Sign in tab; a returning member with a live session never
  // sees either. The meta tracks REGISTRATION_OPEN like every promise here —
  // see src/lib/registration.js.
  { dest: '/join', key: 'join', signup: true, label: 'Join the Community', meta: SIGNIN_META },
  // The Shop card is back, but DEAD — the club asked for the button to be
  // visible again while the shop stays disabled (Oct 2026). `disabled: true`
  // renders a <span>, never a link: there is no /shop route to point at, so
  // an <a> here would walk people into the catch-all redirect and read as a
  // bug. When the shop reopens, delete the flag and restore `dest`.
  { key: 'shop', disabled: true, label: 'Shop the Kit', meta: 'Coming soon' },
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


// The ambient tiles of the "Run It. Share It." film wall: the club's
// landscape films, muted, looping, playing ONLY while on screen — a wall
// of videos that all play at once punishes mobile battery and data, so
// each one plays in view and pauses out of it. Under prefers-reduced-
// motion it never starts and the poster frame stands in. The 30-second
// portrait film beside them is NOT this component: it has audio worth
// hearing, so it renders a plain <video controls preload="none"> and
// costs nothing until pressed.
function AmbientFilm({ src, poster, alt, className }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      // Stale-batch guard: act on the LAST entry, because the callback may
      // deliver several queued transitions at once and the first can be an
      // outdated "not intersecting".
      (entries) => {
        const e = entries[entries.length - 1]
        if (e.isIntersecting) el.play?.().catch(() => {})
        else el.pause?.()
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
    />
  )
}

// ── Film share: "Run It. Share It." taken literally ─────────────────
//
// The club's instruction: the wall's films must let a visitor share them
// on Instagram (instagram.com/made.running). Instagram has no web URL
// that accepts a video upload, so this is a ladder of honest options:
//
//   1. navigator.share with the actual FILE — on phones the native share
//      sheet lists Instagram, and handing it the video file (not a link)
//      is the one form Instagram accepts for a Story. The fetch happens
//      only on tap, so nobody pays the megabytes for a button they never
//      press; the file usually comes straight from the browser's cache
//      because the film is already playing above the button.
//   2. navigator.share with the URL — for devices that share but refuse
//      files; the sheet still reaches Instagram DMs and everything else.
//   3. The club's own Instagram profile in a new tab — the desktop
//      fallback, because a dead button would be worse than a doorway.
//
// AbortError is the user closing the sheet. That is a decision, not a
// failure — it must NOT cascade to the next rung, or dismissing the
// sheet would instantly reopen a second one.
function FilmShare({ src, title }) {
  const [busy, setBusy] = useState(false)

  // The label must describe what the press will actually DO on this device
  // (QA, Oct 2026: on desktop all four "Share on Instagram" buttons just
  // opened the club's profile — a share that doesn't share). Where the Web
  // Share API exists (phones — the audience this control was built for) the
  // button really does hand the film to the share sheet, so it says "Share
  // this film". Where it doesn't (most desktops), the pretence is dropped:
  // it renders as a plain link that says what it is — Follow on Instagram.
  // navigator.share is a stable capability of the browser, not of the
  // moment, so reading it at render (not in state) is safe.
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function share() {
    if (busy) return
    setBusy(true)
    const url = new URL(src, window.location.origin).href
    const text = 'Tag @made.running #NoOneGetsLeftBehind'
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        try {
          const res = await fetch(src)
          if (res.ok) {
            const blob = await res.blob()
            const file = new File([blob], src.split('/').pop(), { type: 'video/mp4' })
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title, text })
              return
            }
          }
        } catch (err) {
          if (err?.name === 'AbortError') return // sheet dismissed — done
          // any other failure falls through to the URL rung
        }
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ url, title, text })
        return
      }
      window.open(SOCIALS.instagram, '_blank', 'noopener')
    } catch (err) {
      if (err?.name !== 'AbortError') window.open(SOCIALS.instagram, '_blank', 'noopener')
    } finally {
      setBusy(false)
    }
  }

  if (!canShare) {
    return (
      <a
        className="tp-ugc__share"
        href={SOCIALS.instagram}
        target="_blank"
        rel="noopener noreferrer"
      >
        <InstagramMark size={13} />
        <span>Follow on Instagram</span>
      </a>
    )
  }

  return (
    <button type="button" className="tp-ugc__share" onClick={share} disabled={busy}>
      <InstagramMark size={13} />
      <span>{busy ? 'Opening\u2026' : 'Share this film'}</span>
    </button>
  )
}

// ── "Notify me when the kit drops" (QA, Oct 2026) ────────────────────
// The shop band used to end in a "Coming soon" pill that looked like a
// button and did nothing — interest arrived and evaporated. This form
// catches it. It follows the same ONE RULE as the booking form: no screen
// may claim what the database cannot confirm. The email is saved by the
// kit_notify RPC (supabase-kit-interest.sql — SECURITY DEFINER insert into
// a table no anon key can read back). Until the club runs that SQL the RPC
// does not exist, PostgREST answers PGRST202, and the form says plainly
// that nothing was saved and offers the channel that does work. It never
// pretends.
function KitNotify() {
  const [email, setEmail] = useState('')
  // idle → busy → done, with three honest failure exits:
  //   invalid — the address doesn't look like an address
  //   off     — the list isn't provisioned yet (RPC missing / no network)
  //   error   — the database answered, but with a real error worth retrying
  const [phase, setPhase] = useState('idle')

  async function submit(e) {
    e.preventDefault()
    if (phase === 'busy') return
    const v = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setPhase('invalid')
      return
    }
    if (!supabaseConfigured) {
      setPhase('off')
      return
    }
    setPhase('busy')
    try {
      const { error } = await supabase.rpc('kit_notify', { p_email: v })
      if (error) {
        // PGRST202 = the function does not exist — the SQL has not been run.
        // No code at all = the request never reached PostgREST. Both mean
        // "the list is not switched on", not "you did something wrong".
        setPhase(error.code === 'PGRST202' || !error.code ? 'off' : 'error')
        return
      }
      setPhase('done')
    } catch {
      setPhase('off')
    }
  }

  if (phase === 'done') {
    return (
      <p className="tp-shop__msg tp-shop__msg--ok" role="status">
        You&rsquo;re on the list &mdash; we&rsquo;ll email you the moment the
        kit drops. Nothing else, no newsletter.
      </p>
    )
  }

  return (
    <form className="tp-shop__form" onSubmit={submit} noValidate>
      <label className="tp-sr" htmlFor="kit-email">
        Email address for the kit-drop list
      </label>
      <input
        id="kit-email"
        className="tp-shop__email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (phase === 'invalid') setPhase('idle')
        }}
        disabled={phase === 'busy'}
      />
      <button type="submit" className="tp-shop__notify" disabled={phase === 'busy'}>
        {phase === 'busy' ? 'Saving\u2026' : 'Notify me'}
      </button>
      {phase === 'invalid' && (
        <p className="tp-shop__msg" role="alert">
          That doesn&rsquo;t look like an email address &mdash; check it and
          try again.
        </p>
      )}
      {phase === 'error' && (
        <p className="tp-shop__msg" role="alert">
          That didn&rsquo;t save &mdash; nothing is on the list yet. Please
          try again in a minute.
        </p>
      )}
      {phase === 'off' && (
        <p className="tp-shop__msg" role="alert">
          The notify list isn&rsquo;t switched on just yet, so nothing was
          saved. Follow{' '}
          <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer">
            @made.running
          </a>{' '}
          and you&rsquo;ll see the drop the moment it lands.
        </p>
      )}
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = `${PRODUCT} — No One Gets Left Behind`
    return () => { document.title = prevTitle }
  }, [])

  // Parallax surfaces — the four full-bleed cover images/films that live
  // inside overflow:hidden frames. Only those: parallaxing TEXT makes a page
  // feel broken (copy must stay glued to the scroll), and the community film
  // wall is excluded because the 30s film has native controls — a moving
  // scrub bar under a thumb is a miss.
  //
  // The hero gets a touch more speed than the photo bands: it is the one
  // place the visitor pauses, and it sets the depth vocabulary for the rest.
  const heroFilmRef = useParallax(0.1, 1.12)
  const shopImgRef = useParallax(0.07, 1.1)
  // Gentler than the other surfaces (0.05/1.06 vs 0.07/1.1): both creed
  // photos are top-anchored so the subjects' heads stay whole, and the
  // drift budget IS the amount of top edge parallax may hide mid-scroll
  // — h·(scale−1)/2 each way. At 1.1 that was up to 10% of the frame, a
  // whole forehead; at 1.06 the worst case is 6%, which the headroom in
  // both photographs absorbs.
  const creedVestRef = useParallax(0.05, 1.06)
  const creedSupportRef = useParallax(0.05, 1.06)

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
          /* Parallax surface (see useParallax): pre-promote to its own
             compositor layer so the first transform write doesn't trigger
             a repaint mid-scroll. Only the four drift surfaces get this —
             will-change on everything is how you run out of VRAM on phones. */
          will-change: transform;
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
        /* Visually-hidden text. The headline ships as the club's slogan
           lockup (an image), so the REAL words live in this clipped span —
           a text node, not an alt attribute, because search engines and
           link-preview scrapers weight an <h1>'s text far more than an
           image's alt (QA, Oct 2026: "the main headline is a picture").
           Also used for form labels whose meaning is visually obvious
           (the kit-notify email field) but must exist for screen readers. */
        .tp-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        /* Quick paths — the /start doors as small glass cards on the film.
           Spans both hero columns as the grid's second row. */
        .tp-hero__quick {
          grid-column: 1 / -1;
          margin-top: clamp(20px, 3vw, 36px);
        }
        .tp-hero__quick-grid {
          display: grid;
          /* Four doors since the runner/community merge (QA, Oct 2026). */
          grid-template-columns: repeat(4, 1fr);
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
        /* The dead Shop card: present, legible, clearly not a door. Half
           opacity and no hover lift are the whole message — "coming soon",
           said with the card itself rather than a tooltip. */
        .tp-qcard--soon {
          opacity: 0.55;
          cursor: default;
        }
        .tp-qcard--soon:hover {
          /* Re-state the resting values so the generic .tp-qcard:hover
             above cannot make a dead card glow like a live one. */
          transform: none;
          border-color: rgba(255,255,255,0.22);
          background: rgba(14,13,12,0.45);
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
          /* Four doors fold to a clean 2×2 — no spanning odd one out. */
          .tp-hero__quick-grid { grid-template-columns: repeat(2, 1fr); }
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
          will-change: transform; /* parallax surface — see useParallax */
        }
        /* Both sources are tall portraits dropped into landscape frames, so
           cover() discards most of the vertical extent and the default centre
           crop lands on the wrong thing. Both photos are TOP-ANCHORED (0%)
           at the club's instruction ("show the full heads"): the subjects'
           heads sit at the very top of both frames, so any hidden extent
           must come off the bottom — legs and tarmac are expendable,
           foreheads are not. Pairs with the gentler parallax on these two
           surfaces (see useParallax calls), because the drift budget is
           exactly how much of this anchored top edge scroll may re-hide. */
        .tp-creed__img--creed { object-position: 50% 0%; }
        .tp-creed__img--support { object-position: 50% 0%; }
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
        /* ── The runs + gym facts that replaced the creed copy ────
           Subheads use the eyebrow voice (small caps, letterspaced) so
           "OUR RUNS" and "OUR GYM" read as labels over data, not as two
           more headlines fighting the h2. */
        .tp-creed__subhead {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent-ink);
          margin: 26px 0 10px;
        }
        .tp-creed__subhead:first-of-type { margin-top: 0; }
        .tp-creed__sched {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
          justify-items: center;
        }
        .tp-creed__sched li {
          font-size: 0.95rem;
          line-height: 1.5;
          color: rgba(255,255,255,0.66);
        }
        .tp-creed__sched strong {
          color: #fff;
          font-weight: 600;
        }
        .tp-creed__gym {
          /* Reset the italic browser default on <address> — these are
             directions, not a quotation. */
          font-style: normal;
          font-size: 0.95rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.66);
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
          /* The photo column is narrower than the copy column on purpose:
             a portrait frame at a full half of a wide screen becomes a
             tower that dwarfs the copy beside it. 0.9/1.1 keeps the band
             balanced while the frame stays clearly upright. */
          grid-template-columns: minmax(0, 0.9fr) 1.1fr;
          align-items: stretch;
        }
        /* PORTRAIT at the club's instruction ("the shop picture should be
           portrait not landscape"). Unlike the creed frames, this one is NOT
           height-matched to the copy — it declares its own 4:5 shape and the
           band grows to fit it, because the source photograph is an upright
           1290×2796 shot and a landscape crop reduced it to a torso strip.
           4:5 rather than the source's own 1:2.17: the full file is mostly
           sky and road, and 4:5 is the tall-crop convention the club's own
           Instagram grid uses. The img inside still fills absolutely, so the
           parallax overscan keeps working unchanged. */
        .tp-shop__frame {
          position: relative;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          min-height: 420px;
        }
        .tp-shop__img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          will-change: transform; /* parallax surface — see useParallax */
          /* The 4:5 frame shows ~58% of the source's height in one window.
             Centring that window at 55% spans roughly 26%–84% of the photo:
             the creed + MADE lockup (~48–62%) sits whole in the lower half
             with the tram still readable above it. */
          object-position: 50% 55%;
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
        /* "Coming soon" is a quiet status LABEL now, not a pill that looks
           like a button and does nothing (QA, Oct 2026) — the eyebrow voice,
           same as every other section tag on the page. The action in this
           band is the notify form below it. */
        .tp-shop__soon {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent-ink);
          margin-bottom: 14px;
        }
        /* ── The kit-drop notify form (QA, Oct 2026) ──
           48px controls: this is a conversion control, a notch taller than
           the 44px touch floor. The input keeps flex-basis 220px so input +
           button sit on one line on desktop and wrap to two clean rows on a
           phone — never a squeezed sliver beside a wide button. */
        .tp-shop__why {
          font-size: 0.9rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.66);
          margin: 0 0 16px;
          max-width: 44ch;
        }
        .tp-shop__form {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          width: 100%;
          max-width: 440px;
        }
        .tp-shop__email {
          flex: 1 1 220px;
          min-height: 48px;
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.06);
          color: #fff;
          font: inherit;
          font-size: 0.9rem;
        }
        .tp-shop__email::placeholder { color: rgba(255,255,255,0.45); }
        .tp-shop__email:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
          border-color: #fff;
        }
        .tp-shop__notify {
          min-height: 48px;
          padding: 0 22px;
          border-radius: 8px;
          border: 1px solid #fff;
          background: #fff;
          color: #111;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: filter 200ms;
        }
        .tp-shop__notify:hover { filter: brightness(0.92); }
        .tp-shop__notify:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        .tp-shop__notify:disabled { opacity: 0.6; cursor: default; }
        .tp-shop__msg {
          flex-basis: 100%;
          margin: 4px 0 0;
          font-size: 0.88rem;
          line-height: 1.55;
          color: rgba(255,255,255,0.75);
          max-width: 44ch;
        }
        .tp-shop__msg--ok { color: var(--ok); }
        .tp-shop__msg a { color: #fff; font-weight: 600; }
        @media (prefers-reduced-motion: reduce) {
          .tp-shop__notify { transition: none; }
        }
        @media (max-width: 860px) {
          .tp-shop { grid-template-columns: 1fr; }
          /* Stacked: the frame keeps its upright shape instead of the old
             46vh landscape letterbox — the whole point of the change. 4:5 at
             full phone width (~390px → ~487px tall) stays inside one screen
             with room for the headline above the fold of the band. */
          .tp-shop__frame { min-height: 0; height: auto; aspect-ratio: 4 / 5; }
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
        /* Footer type: sized and brightened after QA (Oct 2026) found it
           "tiny and low-contrast". The address is the club's only published
           contact point, so it gets the strongest ink; the tagline and
           copyright keep a step less so the hierarchy survives, but every
           rung now clears WCAG AA (≥4.5:1) against the #141414 footer. */
        .tp-footer__tagline {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.6);
          font-weight: 400;
        }
        /* <address> is the correct element for the club's contact details, but
           browsers italicise it by default — reset that so it matches the rest
           of the footer rather than looking like a quotation. */
        .tp-footer__addr {
          font-style: normal;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
        }
        .tp-footer__copy {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.55);
        }
        /* The club's Instagram. Sized to 44px so it meets the touch-target
           minimum on a phone, where the footer is a single stacked column and
           this is the only tappable thing in it. The icon itself is 18px;
           the rest is hit box. */
        .tp-footer__social {
          display: inline-grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 999px;
          color: rgba(255,255,255,0.55);
          transition: color 160ms ease, background 160ms ease;
        }
        .tp-footer__social:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
        }
        /* Below :hover, not above — identical specificity, and a phone fires
           both on one tap, so whichever is written last wins. app.css removes
           the grey tap flash globally; this pays that back for this control. */
        @media (hover: none) and (pointer: coarse) {
          .tp-footer__social:active {
            color: #fff;
            background: rgba(255,255,255,0.16);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-footer__social { transition: none; }
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
        /* Three club films instead of the old photo mosaic — the club's
           instruction: "display those on the Run It, Share It section and
           replace the existing content there." Two of the three are
           PORTRAIT (the 30s film with sound, and the corporate film —
           its .MOV carries rotation=-90, so despite a 3840×2160 stream it
           displays 9:16). Only the wide loop is landscape. So the wall is:
           the landscape loop as a full-width cinematic banner on top, the
           two portraits side by side beneath it at phone-screen width.
           Forcing the corporate film into a landscape slot is what broke
           the first layout (the grid ballooned to ~2700px tall). */
        .tp-ugc__films { display: grid; gap: 14px; }
        .tp-ugc__land {
          width: 100%;
          display: block;
          /* 21:9, not 16:9: as a banner it is atmosphere, and the shallower
             strip keeps the whole wall on one screen next to two 9:16
             towers. The source is 16:9 so object-fit crops top/bottom. */
          aspect-ratio: 21 / 9;
          border-radius: 14px;
          background: #000;
          object-fit: cover;
        }
        /* Three portrait films under the banner (corporate, the new club
           video, and the 30s film with sound). 300px columns: three of
           them plus gaps still fit the 1080px content column with air. */
        .tp-ugc__row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 300px));
          justify-content: center;
          gap: 14px;
        }
        @media (max-width: 860px) {
          /* Three-across below ~860px squeezes each film under ~250px and
             the sound film's controls with it — stack them centred at
             phone-screen width instead. */
          .tp-ugc__row { grid-template-columns: minmax(0, 320px); }
        }
        .tp-ugc__tall {
          width: 100%;
          display: block;
          aspect-ratio: 9 / 16;
          border-radius: 14px;
          background: #000;
          object-fit: cover;
        }
        /* A film plus its own share control. <figure> margin reset because
           browsers hand figures a 40px indent nobody asked for. */
        .tp-ugc__filmcell {
          margin: 0;
          min-width: 0;
          display: grid;
          gap: 10px;
          justify-items: center;
        }
        .tp-ugc__filmcell > video { width: 100%; }
        .tp-ugc__share {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px; /* thumb-sized — this is a phone-first control */
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: transparent;
          color: rgba(255, 255, 255, 0.85);
          font: inherit;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          /* The control is an <a> on desktop now (Follow on Instagram), so
             the global a:hover underline has to be held off here too. */
          text-decoration: none;
          transition: border-color 200ms ease-out, color 200ms ease-out;
        }
        .tp-ugc__share:hover {
          border-color: rgba(255, 255, 255, 0.55);
          color: #fff;
          text-decoration: none;
        }
        .tp-ugc__share:disabled { opacity: 0.6; cursor: default; }
        @media (prefers-reduced-motion: reduce) {
          .tp-ugc__share { transition: none; }
        }
        @media (max-width: 640px) {
          /* A 21:9 strip at 360px wide is a ribbon — give the banner its
             native shape back on phones. */
          .tp-ugc__land { aspect-ratio: 16 / 9; }
          /* Side-by-side portraits at ~115px each would shrink the sound
             film's controls below tappable size; the 860px rule already
             stacked the row to one centred column, which holds here too. */
        }

      `}</style>

      {/* ── 1. Sticky nav ─────────────────────────────────────── */}
      {/* The wordmark sits on the RIGHT of the bar at the club's instruction
          ("the logo should be displayed on top right side") — so the actions
          take the left slot. The bar is space-between, so this is purely a
          swap of which child comes first; the 430px budget in the media
          query below is unchanged, just mirrored. */}
      <header className="tp-nav">
        <nav className="tp-nav__actions">
          {/* Both used to enter through the /start door-chooser. Now that the
              hero cards go straight to /login, a button labelled "Log in" that
              opened a menu of doors instead was the odd one out — and the
              chooser still advertised the old ungated destinations. Both land
              on /login; the two tabs there are exactly the two intents. */}
          {/* Two doors, two tabs: "Log in" is for people who HAVE an account,
              so it opens on Sign in; "Get started" is by definition for people
              who don't, so it opens on Create account (QA, Oct 2026). */}
          <Link to={loginHref('/app')} className="tp-nav__login">Log in</Link>
          <Link to={signupHref('/join')} className="tp-nav__cta">
            Get started <ArrowRight size={13} />
          </Link>
        </nav>
        <Link to="/" className="tp-nav__brand">
          {/* This nav sits on the near-black landing page (bg #0a0a0a), so
              the surface is DARK and the wordmark must be the WHITE file —
              the previous on="light" put the black PNG on a black bar and
              the logo was invisible. The alt names the club for screen
              readers since the link loses its visible text when the logo
              art renders. */}
          <BrandLogo on="dark" height={20} alt={`${PRODUCT} — home`}>
            <span className="tp-nav__mark">{PRODUCT_MARK}</span>
            {PRODUCT}
          </BrandLogo>
        </Link>
      </header>

      {/* ── 2. Hero ───────────────────────────────────────────── */}
      <section className="tp-hero">
        {/* Made Running's own film, landscape across the entire section.
            Absolutely positioned + object-fit: cover so the section's height
            stays content-driven and the film covers whatever box results.
            Muted + playsInline are what allow autoplay at all on iOS.

            NO poster, at the club's instruction (Oct 2026): on 4G and in
            iOS Low Power Mode the browser delayed the film and sat on the
            crew photo instead, which read as "the site loaded the wrong
            hero". While the film buffers (or under prefers-reduced-motion,
            where we never autoplay) the section shows .tp-hero's own dark
            #161514 — a beat of brand-coloured quiet, not a stand-in photo. */}
        <video
          ref={heroFilmRef}
          className="tp-hero__film"
          src={HERO_SRC}
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
              keyed to white-on-transparent. The words themselves live in a
              visually-hidden span so the h1 contains real TEXT — alt on the
              image alone left the page's main headline invisible to anything
              that weights h1 text over image alts (QA, Oct 2026). The image
              is then pure decoration: alt="" + aria-hidden so screen readers
              hear the slogan exactly once. */}
          <h1 className="tp-hero__title">
            <span className="tp-sr">No One Gets Left Behind</span>
            <img
              className="tp-hero__slogan"
              src="/img/slogan-white.png"
              alt=""
              aria-hidden="true"
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
            {/* signupHref, not loginHref: "Join" is a newcomer's verb, so the
                door opens on Create account (QA, Oct 2026). Members with a
                session skip the form entirely either way. */}
            <Link to={signupHref('/join')} className="tp-btn-primary">
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

        {/* The four doors, small. Full-width row under both hero columns. */}
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
              // Five kinds of destination, not two:
              //   disabled → no destination at all (the dead Shop card)
              //   external → a real file the host serves (coach form)
              //   public   → an in-app route with no sign-in gate (/book)
              //   signup   → behind /login, opened on Create account
              //   default  → behind /login, opened on Sign in
              if (p.disabled) {
                return (
                  <span
                    key={p.key}
                    className="tp-qcard tp-qcard--soon"
                    aria-disabled="true"
                  >
                    {inner}
                  </span>
                )
              }
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
                  to={
                    p.public
                      ? p.dest
                      : p.signup
                      ? signupHref(p.dest)
                      : loginHref(p.dest)
                  }
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
              Made Running was founded by Hermen Dange in Manchester in 2023, after
              running became a turning point in his own life. Having discovered
              running while incarcerated, Hermen experienced first-hand how movement
              could create structure, discipline and purpose. After his release, he
              turned that experience into a movement built around one simple belief:
              No One Gets Left Behind.
            </p>
            <p className="tp-lede tp-story__p">
              What started with just nine people has grown into one of Europe&rsquo;s
              fastest-growing and biggest fitness communities, bringing thousands of
              people together through our run club, clothing brand and dedicated gym
              space. Made Running is more than running &mdash; it&rsquo;s a community
              built around movement, connection and becoming the best version of
              yourself.
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
          {/* The club's own lookbook shot (the "Made running Shop" photo they
              supplied): the hoodie with the creed on the back, Metrolink tram
              behind — Manchester in one frame. Replaces the vest crop at the
              club's instruction. Native width is 1290px, so no variant claims
              more pixels than the source actually has. */}
          <img
            ref={shopImgRef}
            className="tp-shop__img"
            src="/img/shop-hoodie-1290.jpg"
            srcSet="/img/shop-hoodie-900.jpg 900w, /img/shop-hoodie-1290.jpg 1290w"
            sizes="(max-width: 860px) 100vw, 50vw"
            loading="lazy"
            decoding="async"
            alt="A Made Running hoodie printed with No One Gets Left Behind, in front of a Manchester tram."
          />
        </div>
        <Reveal className="tp-shop__copy" as="div">
          {/* The section name is the headline now, so the purple "SHOP"
              eyebrow that used to sit above it would just repeat the word. */}
          <span className="tp-shop__soon">Coming soon</span>
          <h2 className="tp-h2 tp-shop__h2">Shop</h2>
          <p className="tp-lede tp-shop__lede">
            Vests, tees and layers in the club&rsquo;s own colours. Every piece
            carries the line that started it &mdash; and you will spot it on
            every start line from Manchester to Dubai.
          </p>
          {/* The shop itself is still disabled at the club's instruction, but
              the interest no longer evaporates (QA, Oct 2026): the dead
              "Coming soon" pill became the status label above the headline,
              and the band's action is this notify-me form. When the shop
              reopens, the "Shop Now" <Link> joins (or replaces) it. */}
          <p className="tp-shop__why">
            Want first dibs? Leave your email and we&rsquo;ll send one message
            when the first drop lands &mdash; that&rsquo;s it.
          </p>
          <KitNotify />
        </Reveal>
      </section>

      {/* ── 7. Community film wall ────────────────────────────────
          "Run It. Share It." now carries the club's own four films (the
          "Made running homepage videos" folder, transcoded to H.264 so
          every browser plays them) — they replaced the old photo mosaic
          at the club's instruction. The landscape loop is the banner; the
          three portrait films sit in a row beneath it. Corporate and the
          club video are ambience — muted, playing only while on screen.
          The 30-second film has sound, so it waits for a tap: controls,
          poster, preload="none" — zero cost until someone chooses it. */}
      <section className="tp-ugc" aria-labelledby="ugc-title">
        <Reveal className="tp-ugc__head" as="div">
          <div className="tp-eyebrow">The community</div>
          <h2 className="tp-ugc__title" id="ugc-title">Run It. Share It.</h2>
          <p className="tp-ugc__sub">
            Shot on the runs and in the Hub. One film has sound &mdash;
            press play. Tag <strong>@made.running</strong> or{' '}
            <strong>#NoOneGetsLeftBehind</strong> to be featured.
          </p>
        </Reveal>
        <Reveal className="tp-ugc__films" as="div">
          {/* Each film is a cell: the film plus its own share control —
              "Run It. Share It." with the verb actually wired up. */}
          <figure className="tp-ugc__filmcell">
            <AmbientFilm
              className="tp-ugc__land"
              src="/video/made-film-wide.mp4"
              poster="/video/made-film-wide-poster.jpg"
              alt="Made Running film: the crew out on a run."
            />
            <FilmShare src="/video/made-film-wide.mp4" title="Made Running — the crew out on a run" />
          </figure>
          <div className="tp-ugc__row">
            <figure className="tp-ugc__filmcell">
              <AmbientFilm
                className="tp-ugc__tall"
                src="/video/made-corporate.mp4"
                poster="/video/made-corporate-poster.jpg"
                alt="Made Running brand film."
              />
              <FilmShare src="/video/made-corporate.mp4" title="Made Running" />
            </figure>
            <figure className="tp-ugc__filmcell">
              <AmbientFilm
                className="tp-ugc__tall"
                src="/video/made-running-video.mp4"
                poster="/video/made-running-video-poster.jpg"
                alt="Made Running club video."
              />
              <FilmShare src="/video/made-running-video.mp4" title="Made Running" />
            </figure>
            <figure className="tp-ugc__filmcell">
              <video
                className="tp-ugc__tall"
                src="/video/made-film-tall.mp4"
                poster="/video/made-film-tall-poster.jpg"
                controls
                playsInline
                preload="none"
                aria-label="Made Running film with sound: thirty seconds inside the club."
              />
              <FilmShare src="/video/made-film-tall.mp4" title="Made Running — inside the club" />
            </figure>
          </div>
        </Reveal>
      </section>

      {/* ── 7b. About us / creed band ─────────────────────────────
          The club's own words, in the club's own photographs. It lands after
          the community wall on purpose: you see who shows up first, then read
          the one rule that explains why they keep showing up. */}
      <section className="tp-creed">
        <div className="tp-creed__frame">
          {/* Swapped from the creed-vest photo at the club's instruction
              (Oct 2026): Hermen pacing a Manchester Marathon runner to the
              line, arm in arm — the creed as an action instead of a print.
              Native width is 1205px, so no variant claims more.

              sizes says 34vw, not the column's literal ~31vw, on purpose: the
              parallax pre-zooms these frames by scale(1.06–1.12) (overscan
              budget, see the ref effect), so the photo must carry ~10% more
              pixels than the box it sits in or it renders soft. QA (Oct 2026)
              caught exactly that — "shown larger than the file served". Same
              correction on the support and shop photos below. */}
          <img
            ref={creedVestRef}
            className="tp-creed__img tp-creed__img--creed"
            src="/img/hermen-gail-1205.jpg"
            srcSet="/img/hermen-gail-900.jpg 900w, /img/hermen-gail-1205.jpg 1205w"
            sizes="(max-width: 860px) 100vw, 34vw"
            loading="lazy"
            decoding="async"
            alt="A Made Running coach walking arm in arm with a Manchester Marathon runner, both checking her watch."
          />
        </div>
        <Reveal className="tp-creed__copy" as="div">
          {/* The club asked for this band to carry EXACTLY the practical
              facts — the three weekly runs and the gym's address — and
              nothing else (Oct 2026). The creed copy that lived here moved
              out entirely; the vest photo beside this column still says it. */}
          <h2 className="tp-h2 tp-creed__h2">About us</h2>

          <h3 className="tp-creed__subhead">Our runs &middot; free event</h3>
          <ul className="tp-creed__sched">
            <li>
              <strong>Monday</strong> 7pm &middot; 5km &middot; Deansgate, M3 4JB
            </li>
            <li>
              <strong>Wednesday</strong> 5am &middot; 5km &middot; Deansgate, M3 4JB
            </li>
            <li>
              <strong>Saturday</strong> 9.15am &middot; 5km &middot; Media City, M50 2EQ
            </li>
          </ul>

          <h3 className="tp-creed__subhead">Our gym</h3>
          {/* <address> is the right element for a street address; the
              italic browser default is reset in its rule below. */}
          <address className="tp-creed__gym">
            Made Running<br />34 Knowsley Street, M8 8HQ
          </address>
        </Reveal>
        <div className="tp-creed__frame tp-creed__frame--second">
          <img
            ref={creedSupportRef}
            className="tp-creed__img tp-creed__img--support"
            src="/img/support-1600.jpg"
            srcSet="/img/support-900.jpg 726w, /img/support-1600.jpg 1290w"
            sizes="34vw"
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
          <Link to={signupHref('/join')} className="tp-footer-cta__btn">
            Join the Community <ArrowRight size={14} />
          </Link>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="tp-footer">
        <div className="tp-footer__brand">
          {/* Dark footer slab → white wordmark; the tagline keeps its place
              beside it. alt="" — the footer brand is decorative repetition,
              the nav and hero already name the club. */}
          <BrandLogo on="dark" height={18} alt="">
            <span className="tp-footer__mark">{PRODUCT_MARK}</span>
            {PRODUCT}
          </BrandLogo>
          <span className="tp-footer__tagline">&middot; {PRODUCT_TAGLINE}</span>
        </div>
        <address className="tp-footer__addr">
          Made Running, Manchester, M8 8HQ
        </address>
        {/* The one outbound social link. target=_blank because the visitor is
            mid-scroll on a page that took deliberate effort to reach the
            bottom of; replacing it with Instagram makes "back" the price of
            curiosity. rel on principle: noopener severs window.opener,
            noreferrer keeps this page out of Instagram's referrer logs. */}
        <a
          className="tp-footer__social"
          href={SOCIALS.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Made Running on Instagram"
        >
          <InstagramMark size={18} />
        </a>
        <span className="tp-footer__copy">
          &copy; {new Date().getFullYear()} Made Running &mdash; &ldquo;No One Gets Left Behind&rdquo;
          {/* The privacy notice (QA, Oct 2026). Styled by the same __copy
              wrapper — a quiet legal link belongs at copyright weight, not
              nav weight. */}
          {' · '}
          <Link to="/privacy" style={{ color: 'inherit' }}>Privacy</Link>
        </span>
      </footer>
    </div>
  )
}
