// ChoosePath — the pre-login gate. The first thing anyone sees.
//
// WHY THIS EXISTS: /join and /login are architecturally opposite doors.
// /join is a public, no-auth RPC insert (a runner registering themselves);
// /login is a Supabase Auth session (a coach with CRM access). A runner who
// lands on a password form assumes they need an account and leaves. This
// screen asks the one question that routes them correctly, before either
// door can reject them.
//
// BRAND: monochrome, verified against maderunning.com by ranking painted
// area — #efefef / #1c1c1c / #141414 / #000 / #fff and no saturated colour
// anywhere. The reference design this is modelled on separates its two
// paths with coloured underlines; we keep the hand-drawn underline motif
// but differentiate by fill/weight instead of hue, to stay on-brand.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tenant } from '../lib/theme'

// The signature move: a hand-drawn underline under each path label. Solid
// for the runner (the open, public door), hairline for the coach (the
// credentialed one) — differentiation by weight, since the brand has no
// second colour to reach for.
function Squiggle({ variant = 'solid' }) {
  const solid = variant === 'solid'
  return (
    <svg
      className="cp-squiggle"
      viewBox="0 0 120 12"
      width="120"
      height="12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Dashed, not merely thinner. A faint hairline reads as a rendering
          fault; a dash reads as an intentional second state — and it echoes
          the meaning: the coach door is the gated one. */}
      <path
        d="M2 8C18 3 32 10 48 6.5S82 2.5 98 7c6 1.7 12 2 20 1"
        stroke="currentColor"
        strokeWidth={solid ? 3.25 : 2.25}
        strokeLinecap="round"
        strokeDasharray={solid ? undefined : '7 6'}
        opacity={solid ? 1 : 0.85}
      />
    </svg>
  )
}

// Per-glyph entrance for the wordmark. The split has to happen in JS —
// there is no CSS-only way to stagger individual characters — and that has
// one real cost: the glyphs become separate elements, so a screen reader
// would spell the name out letter by letter. Hence the explicit aria-label
// on the h1 and aria-hidden on everything inside it.
//
// Spaces are rendered as a plain inline span rather than a non-breaking
// character: the glyph spans are inline-block, which removes their own wrap
// opportunities, so the space is the only place the title can break. Keeping
// it breakable is what stops a longer tenant name overflowing at 375px.
function AnimatedTitle({ text }) {
  return (
    <h1 className="cp-title" aria-label={text}>
      <span aria-hidden="true">
        {[...text].map((ch, i) =>
          ch === ' ' ? (
            <span className="cp-title__sp" key={i}> </span>
          ) : (
            <span className="cp-title__ch" key={i} style={{ '--i': i }}>
              {ch}
            </span>
          ),
        )}
      </span>
    </h1>
  )
}

const PATHS = [
  {
    to: '/join',
    label: 'I am a Runner',
    variant: 'solid',
    blurb: 'Register for a session and get on the start line.',
    meta: 'No account needed',
  },
  {
    to: '/join',
    key: 'community',
    label: 'Join the Community',
    variant: 'solid',
    blurb: 'New here? Join the crew — no one gets left behind.',
    meta: 'Everyone welcome',
  },
  {
    to: '/login',
    label: 'Coach at Made Running',
    variant: 'hairline',
    blurb: 'Run sessions, the Hub, volunteers and the community.',
    meta: 'Sign in required',
  },
  {
    to: '/book',
    label: 'Book a Class',
    variant: 'solid',
    blurb: 'HIIT, strength and spin at the Hub — live seats, pay online.',
    meta: 'Instant booking',
  },
  {
    // The apparel side lives on the club's own storefront — send shoppers
    // there rather than into the auth-gated admin Shop view.
    to: 'https://maderunning.com',
    external: true,
    label: 'Shop',
    variant: 'solid',
    blurb: 'The vest means something. Official Made Running apparel.',
    meta: 'maderunning.com',
  },
]

const LAST_PATH_KEY = 'mr.lastPath'

// DECISION: we remember the last door, but we NEVER auto-navigate through it.
//
// The obvious feature here is "returning visitor skips the gate". We don't do
// it, because the two failure modes are wildly asymmetric. A repeat coach made
// to tap once more loses two seconds. A first-timer auto-skipped to /login
// lands on a password form, concludes they need an account, and leaves — which
// is the precise leak this screen exists to plug. At a run club that isn't
// hypothetical: phones get handed around at the start line, so the device that
// "belongs to a coach" is routinely being used by a brand-new runner.
//
// So the remembered value drives a quiet visual marker instead (see
// .cp-option--last). Same convenience, none of the risk, and the screen always
// renders — which also means it can't be accidentally skipped during a demo.
function rememberPath(to) {
  try {
    localStorage.setItem(LAST_PATH_KEY, to)
  } catch {
    // Private browsing / blocked storage. Remembering is a convenience, never
    // a requirement — failing here must not stop the click going through.
  }
}

function readLastPath() {
  try {
    return localStorage.getItem(LAST_PATH_KEY)
  } catch {
    return null
  }
}

export default function ChoosePath() {
  // Read once at mount: this must not change under the user mid-screen, or the
  // marker would visibly move as they click.
  const [lastPath] = useState(readLastPath)

  return (
    <div className="cp">
      <style>{`
        .cp {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: var(--s5);
          background: #0b0b0b;
          /* Soft off-centre spotlight — echoes the night-street photography
             on their Instagram, and stops a flat black slab (ten-k #03). */
          background-image:
            radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 55%),
            radial-gradient(80% 60% at 50% 100%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 60%);
        }

        /* Ambient drift. The static spotlight above is what the page rests on;
           this adds a second, very slow-moving glow so the background is never
           quite still — the difference between a photograph of a room and the
           room. 26s and low amplitude, well under the threshold where the eye
           tracks it as movement.

           Fixed rather than absolute so it cannot lengthen the page, and it is
           deliberately given z-index 0 with the card raised to 1: a positioned
           element paints above static siblings regardless of DOM order, so
           without this the glow would sit on top of the card. */
        .cp::before {
          content: '';
          position: fixed;
          left: -20%; right: -20%; top: -25%;
          height: 80%;
          z-index: 0;
          pointer-events: none;
          background: radial-gradient(50% 60% at 50% 40%, rgba(255,255,255,0.06), rgba(255,255,255,0) 70%);
          animation: cp-drift 26s ease-in-out infinite alternate;
        }
        @keyframes cp-drift {
          from { transform: translate3d(-4%, 0, 0) scale(1); }
          to   { transform: translate3d(4%, 3%, 0) scale(1.1); }
        }

        .cp-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 720px;
          background: linear-gradient(180deg, #1f1f1f 0%, #151515 100%);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: var(--radius-lg);
          padding: var(--s8) var(--s7);
          box-shadow: 0 32px 80px rgba(0,0,0,0.6);
          text-align: center;
        }

        .cp-mark {
          width: 54px;
          height: 54px;
          margin: 0 auto var(--s5);
          border-radius: var(--radius);
          background: #ffffff;
          color: #111111;
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.5rem;
          letter-spacing: 0.02em;
          /* Lands first and slightly overshoots in scale — the one place on
             this screen with any spring in it, because it is a mark, not text. */
          animation: cp-mark-in 380ms cubic-bezier(0.2, 0.9, 0.3, 1.25) backwards;
        }
        @keyframes cp-mark-in {
          from { opacity: 0; transform: scale(0.72); }
        }

        .cp-title {
          font-family: var(--font-display);
          /* Fluid so the wordmark never wraps awkwardly at 375px (ten-k #07) */
          font-size: clamp(1.9rem, 7vw, 3rem);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #ffffff;
          margin: 0;
        }

        /* Glyphs rise and sharpen. The blur is what makes this read as motion
           graphics rather than a plain fade — letters resolve into focus, like
           a title card settling. 22ms apart: fast enough that the word arrives
           as a word, slow enough to see the sweep. */
        .cp-title__ch {
          display: inline-block;
          animation: cp-glyph 380ms var(--ease) backwards;
          animation-delay: calc(90ms + var(--i) * 22ms);
        }
        .cp-title__sp { display: inline; }
        @keyframes cp-glyph {
          from {
            opacity: 0;
            transform: translateY(0.4em) rotate(1.5deg);
            filter: blur(5px);
          }
        }

        .cp-rule {
          height: 1px;
          margin: var(--s5) auto;
          max-width: 300px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
          /* Draws outward from the centre, so it reads as a line being struck
             under the wordmark rather than another thing fading in. */
          animation: cp-rule-draw 320ms var(--ease) backwards;
          animation-delay: 340ms;
        }
        @keyframes cp-rule-draw {
          from { transform: scaleX(0); opacity: 0; }
        }

        .cp-question {
          font-size: var(--fs-md);
          line-height: 1.6;
          color: rgba(255,255,255,0.78);
          margin: 0 auto;
          max-width: 42ch;
        }

        .cp-eyebrow {
          /* auto, not 0, on the sides. app.css sets a global
             p { max-width: 66ch } to hold body copy to a readable measure,
             and ch is font-size-relative — so at this label's 11.5px it
             resolves to ~456px, which is narrower than the 622px card. The
             box then sat flush against the card's left padding and
             text-align: center centred the words inside *that* box, landing
             them 83px left of the card's axis. Invisible until measured,
             because there is nothing beside it to compare against.
             .cp-question already had auto here, which is why it alone was
             unaffected. Same fix on .cp-foot below. */
          margin: var(--s7) auto var(--s4);
          font-size: var(--fs-xs);
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          /* 0.55 is a floor, not a taste call: below ~0.46 white on the card's
             #1f1f1f this 11.5px label drops under 4.5:1 and fails AA. It stays
             subordinate to the body copy (0.78) by size and tracking, not by
             being too faint to read. Same reasoning on .cp-foot. */
          color: rgba(255,255,255,0.55);
        }

        .cp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--s4);
        }
        /* Five doors on a two-column grid: the odd one out spans the full
           row rather than leaving a hole beside it. */
        .cp-grid > :last-child { grid-column: 1 / -1; }

        .cp-option {
          display: block;
          text-decoration: none;
          padding: var(--s6) var(--s5);
          border-radius: var(--radius);
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.02);
          color: #ffffff;
          transition:
            transform var(--dur) var(--ease),
            border-color var(--dur) var(--ease),
            background-color var(--dur) var(--ease);
          /* backwards, never forwards/both. An animation with a forwards
             fill keeps applying its final transform after it ends, and
             animations outrank normal declarations — so the hover
             translateY(-2px) below would silently stop working for the rest of
             the page's life. With backwards the from-state only applies
             during the delay, and once the animation is over the element is
             governed by its ordinary rules again. */
          animation: cp-rise 360ms var(--ease) backwards;
          animation-delay: calc(560ms + var(--i) * 80ms);
        }
        .cp-option:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.42);
          background: rgba(255,255,255,0.06);
          /* Re-stated, not redundant. app.css carries a global
             a:hover { text-decoration: underline }, and its (0,1,1)
             specificity beats the (0,1,0) of .cp-option above — so the
             base text-decoration: none survives at rest and loses on
             hover. The card is a block link wrapping a heading, a
             paragraph and a pill, so the underline landed on all three
             at once. It only shows on a real pointer, which is why it
             was invisible until a screenshot happened to be taken with
             the cursor resting over a card. The back link below is left
             to underline on hover on purpose: there it is the
             conventional affordance for an inline text link. */
          text-decoration: none;
        }
        /* Custom focus ring — the default browser outline is invisible on
           near-black and would fail keyboard a11y here (ten-k #08). */
        .cp-option:focus-visible {
          outline: none;
          border-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.28);
        }

        .cp-option__label {
          font-family: var(--font-display);
          font-size: var(--fs-lg);
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          line-height: 1.15;
        }

        .cp-squiggle {
          display: block;
          margin: var(--s3) auto var(--s4);
          max-width: 60%;
          color: #ffffff;
          /* Wipes in left-to-right so the underline appears to be drawn by
             hand — which is the one thing this motif is pretending to be.
             A clip-path wipe rather than the usual stroke-dashoffset trick,
             because the coach variant already spends strokeDasharray on its
             dashes; animating the offset would make the dashes crawl instead
             of drawing the line. The wipe is indifferent to what it reveals,
             so both variants use the identical animation.

             Base state is the *finished* state and the fill is backwards.
             That is deliberate throughout this file: it means the
             reduced-motion block below only has to switch animations off,
             and everything is already in its correct resting state. */
          clip-path: inset(0 0 0 0);
          animation: cp-wipe 380ms var(--ease) backwards;
          animation-delay: calc(780ms + var(--i) * 80ms);
        }
        @keyframes cp-wipe {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0 0 0); }
        }

        .cp-option__blurb {
          font-size: var(--fs-sm);
          line-height: 1.6;
          color: rgba(255,255,255,0.62);
          margin: 0 0 var(--s3);
        }

        .cp-option__meta {
          display: inline-block;
          font-size: var(--fs-xs);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: var(--radius-full);
          padding: 5px 11px;
        }

        /* Remembered choice: a nudge, not a decision. Slightly warmer border
           and a quiet caption — enough to catch the eye of someone who's been
           here before, invisible to someone who hasn't. */
        .cp-option--last {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.045);
        }

        .cp-option__last {
          display: block;
          margin-top: var(--s3);
          font-size: var(--fs-xs);
          letter-spacing: 0.08em;
          /* 0.5 is the AA floor for 11.5px white on this card — see .cp-eyebrow */
          color: rgba(255,255,255,0.5);
        }

        .cp-foot {
          margin: var(--s7) auto 0;
          font-size: var(--fs-xs);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
        }

        .cp-back {
          display: inline-block;
          margin-top: var(--s5);
          font-size: var(--fs-sm);
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          border-radius: var(--radius-sm);
          /* Keeps the inline link a >=44px tall touch target (ten-k #07) */
          padding: 12px 10px;
        }
        .cp-back:hover { color: #ffffff; }
        .cp-back:focus-visible {
          outline: none;
          color: #ffffff;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.28);
        }

        /* Entrance ladder. Every individual animation is 320–380ms ease-out
           (ten-k #06); the *sequence* runs to about 1.2s only because the
           pieces are staggered, which is the thing that makes it read as
           choreography rather than eight elements twitching at once.
           Order follows how the screen should be read: mark, wordmark, rule,
           question, prompt, the two doors, then the quiet furniture. */
        .cp-in { animation: cp-rise 340ms var(--ease) backwards; }
        .cp-d1 { animation-delay: 400ms; }  /* the question */
        .cp-d2 { animation-delay: 500ms; }  /* "choose your path" */
        .cp-d3 { animation-delay: 900ms; }  /* creed line */
        .cp-d4 { animation-delay: 980ms; }  /* back link */
        @keyframes cp-rise {
          from { opacity: 0; transform: translateY(10px); }
        }

        /* Mobile is re-laid-out, not shrunk: cards stack, padding tightens,
           the squiggle widens so it still reads at a small size. */
        @media (max-width: 620px) {
          .cp { padding: var(--s4); }
          .cp-card { padding: var(--s7) var(--s5); border-radius: var(--radius); }
          .cp-grid { grid-template-columns: 1fr; gap: var(--s3); }
          .cp-option { padding: var(--s5) var(--s4); }
          .cp-squiggle { max-width: 42%; }
          .cp-eyebrow { margin-top: var(--s6); }
        }

        /* Reduced motion is a first-class path, not a fallback. Because every
           animated rule above declares its finished state as the base and
           fills backwards, switching the animations off is genuinely all
           that is needed — nothing is left invisible, mid-blur or half-wiped.
           The one exception is the glyph blur, which has to be cleared
           explicitly in case a reveal is caught in flight when the user
           flips the setting. */
        @media (prefers-reduced-motion: reduce) {
          .cp::before,
          .cp-mark,
          .cp-title__ch,
          .cp-rule,
          .cp-in,
          .cp-option,
          .cp-squiggle {
            animation: none !important;
          }
          .cp-title__ch { filter: none; opacity: 1; transform: none; }
          .cp-squiggle { clip-path: none; }
          .cp-option { transition: none; }
          .cp-option:hover { transform: none; }
        }
      `}</style>

      <main className="cp-card cp-in">
        <div className="cp-mark" aria-hidden="true">{tenant.mark}</div>
        <AnimatedTitle text={tenant.name} />

        <div className="cp-rule" />

        <p className="cp-question cp-in cp-d1">
          What brings you to {tenant.name} today? Pick your path and we&rsquo;ll
          take you to the right place.
        </p>

        <p className="cp-eyebrow cp-in cp-d2">Choose your path</p>

        {/* The stagger index lives on the Link so both the card's own entrance
            and its squiggle wipe can read it — custom properties inherit, so
            one declaration drives two animations at two different depths. */}
        <nav className="cp-grid" aria-label="Choose your path">
          {PATHS.map((p, i) => {
            // Two doors can share a destination (Runner and Community both
            // land on /join), so identity is the explicit key when present —
            // both for React and for the "last time" marker, which should
            // light the card the visitor actually tapped, not its twin.
            const id = p.key || p.to
            const isLast = id === lastPath
            const inner = (
              <>
                <span className="cp-option__label">{p.label}</span>
                <Squiggle variant={p.variant} />
                <p className="cp-option__blurb">{p.blurb}</p>
                <span className="cp-option__meta">{p.meta}</span>
                {isLast && (
                  <span className="cp-option__last">You chose this last time</span>
                )}
              </>
            )
            const cls = 'cp-option' + (isLast ? ' cp-option--last' : '')
            return p.external ? (
              <a
                key={id}
                href={p.to}
                target="_blank"
                rel="noopener noreferrer"
                style={{ '--i': i }}
                className={cls}
                onClick={() => rememberPath(id)}
              >
                {inner}
              </a>
            ) : (
              <Link
                key={id}
                to={p.to}
                style={{ '--i': i }}
                className={cls}
                onClick={() => rememberPath(id)}
              >
                {inner}
              </Link>
            )
          })}
        </nav>

        <p className="cp-foot cp-in cp-d3">{tenant.tagline}</p>

        <Link to="/" className="cp-back cp-in cp-d4">&larr; Back to home</Link>
      </main>
    </div>
  )
}
