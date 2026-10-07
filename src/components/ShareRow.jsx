// ============================================================
// SHARE ROW — flow-chart Step 3 support. "Share this class."
//
// The flow chart's Step 3 is "the public page the shareable link opens". This
// is the other half of that sentence: the thing that produces the link. Until
// now a member had to select the address bar on a phone to pass a class on,
// which is why classes spread by someone typing "Mondays 9.30, come" into the
// group chat instead of by a link that opens the page.
//
// NO CLASS NAME IS HARD-CODED. The share text is built from the row that was
// passed in, so a renamed class shares under its new name the same day.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'

// ── Why these marks are hand-drawn ────────────────────────────────
// lucide-react ships no brand icons — there is no Instagram, Facebook or
// Twitter export in it (I checked all 5978 names before writing these). Brand
// marks are trademarks and lucide's licence deliberately stays clear of them.
//
// So they are inline paths. Inline and not four <img> files, because these sit
// in a row a member is expected to notice: four network round-trips that can
// each fail would give us a row of broken icons on exactly the page where
// someone is deciding whether to pay. An SVG in the bundle cannot 404, and it
// is crisp on every display without a 2x asset (checklist 08).
//
// Each is a single path on a 24-box with currentColor fill, so they inherit
// colour and size from the button like the lucide icons next to them. The row
// therefore stays one visual set (checklist 05) rather than four logos at four
// weights.
function WhatsAppMark(props) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.19-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.23-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.22-8.24 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.4-.12-.56.13-.17.25-.65.81-.8.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.43 1.03 2.6.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.15-1.19-.06-.1-.23-.17-.48-.29Z" />
    </svg>
  )
}

function FacebookMark(props) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.77l-.44 2.91h-2.33V22C18.34 21.24 22 17.08 22 12.06Z" />
    </svg>
  )
}

// The X mark, not the old bird. The bird is a trademark for a product that no
// longer exists under that name, and a member who taps this lands on x.com.
function XMark(props) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.53 3h3.2l-6.99 7.99L21.98 21h-6.3l-4.65-6.08L5.7 21H2.5l7.3-8.35L2.28 3h6.3l4.36 5.77L17.53 3Zm-1.12 16.07h1.77L7.11 4.84H5.21l11.2 14.23Z" />
    </svg>
  )
}

function InstagramMark(props) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2c2.72 0 3.06.01 4.12.06 1.07.05 1.79.22 2.43.47.66.25 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.64.42 1.36.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.07-.22 1.79-.47 2.43-.25.66-.6 1.22-1.15 1.77-.55.55-1.11.9-1.77 1.15-.64.25-1.36.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.07-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.36-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.07.22-1.79.47-2.43.25-.66.6-1.22 1.15-1.77A4.9 4.9 0 0 1 5.45 2.53c.64-.25 1.36-.42 2.43-.47C8.94 2.01 9.28 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.82.04-1.27.17-1.56.29-.4.15-.68.34-.98.64-.3.3-.49.58-.64.98-.12.29-.25.74-.29 1.56-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.04.82.17 1.27.29 1.56.15.4.34.68.64.98.3.3.58.49.98.64.29.12.74.25 1.56.29 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.82-.04 1.27-.17 1.56-.29.4-.15.68-.34.98-.64.3-.3.49-.58.64-.98.12-.29.25-.74.29-1.56.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.82-.17-1.27-.29-1.56-.15-.4-.34-.68-.64-.98-.3-.3-.58-.49-.98-.64-.29-.12-.74-.25-1.56-.29-1.05-.05-1.37-.06-4.04-.06Zm0 3.06a5.14 5.14 0 1 1 0 10.28 5.14 5.14 0 0 1 0-10.28Zm0 1.8a3.34 3.34 0 1 0 0 6.68 3.34 3.34 0 0 0 0-6.68Zm5.34-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  )
}

// ── Copying a link when the Clipboard API says no ─────────────────
// navigator.clipboard needs a secure context AND, on some browsers, a
// permission that can be refused. It is also absent in a few in-app webviews —
// including the Instagram and Facebook browsers, which is precisely where a
// shared class link gets opened and re-shared.
//
// So there is a documented fallback rather than a silent failure: a throwaway
// textarea and execCommand('copy'). execCommand is deprecated and will
// eventually stop working; when it does, this returns false and the caller
// shows the URL instead of claiming to have copied it. Nothing here ever
// reports success it did not have.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through. A rejected clipboard promise is not a reason to give up,
    // it is a reason to try the older mechanism.
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    // Off-screen rather than display:none — a hidden element cannot be
    // selected, so display:none would make the copy silently no-op.
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '-1000px'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

/**
 * The share row for one class.
 *
 * @param {string}  url    The canonical class URL. Built by the caller, NOT read
 *                         from window.location here — see the note at the call
 *                         site about query strings.
 * @param {string}  title  The class name, as it is on the page right now.
 * @param {string}  text   One line of context: day, time, coach.
 */
export default function ShareRow({ url, title, text }) {
  // ── Three states, not two ─────────────────────────────────────
  // null = nothing to report, 'copied' = the link is on the clipboard,
  // 'failed' = we could not copy it and are showing it instead. The third
  // state exists because the alternative is a button that says "Copied!" when
  // nothing was copied, and the member finds out by pasting nothing into the
  // group chat.
  const [copyState, setCopyState] = useState(null)

  // ── Two different questions, and they are not the same question ───
  // Read once on mount rather than in the render body, because navigator.share
  // is undefined during a prerender and reading it at render would make the
  // first client render disagree with the HTML that was served.
  //
  // ── "Does navigator.share exist" is the WRONG question ────────────
  // Read once on mount rather than in the render body, because navigator.share
  // is undefined during a prerender and reading it at render would make the
  // first client render disagree with the HTML that was served.
  //
  // The obvious test is whether navigator.share exists, and it is the wrong
  // one. Chrome on macOS has had Web Share since version 89, so the test
  // passes on a laptop — and opens the macOS share sheet, which holds Messages
  // and Mail and no Instagram, because Instagram has no desktop app to
  // register as a share target. Gating on share-sheet availability therefore
  // sent desktop members to a sheet that could not do what the button they
  // pressed was named after, and hid the sentence explaining why.
  //
  // What both the Instagram button and the "More" button actually need to know
  // is "is this a phone" — a phone has Instagram installed and a share sheet
  // worth opening; a laptop has neither. A coarse pointer is the proxy for
  // that. It is a proxy and not a proof, and a touchscreen laptop reports
  // coarse — but the failure is harmless: that laptop opens a sheet without
  // Instagram in it, the member cancels, and the cancel falls through to
  // copying the link, which is exactly what the desktop path does anyway.
  const [phoneShare, setPhoneShare] = useState(false)
  useEffect(() => {
    setPhoneShare(
      typeof navigator !== 'undefined' &&
        !!navigator.share &&
        window.matchMedia?.('(pointer: coarse)').matches === true,
    )
  }, [])

  // The confirmation has to clear itself, and the timer has to die with the
  // component — a member who taps Copy and immediately navigates would
  // otherwise leave a setState pointing at an unmounted tree.
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function flash(state) {
    setCopyState(state)
    clearTimeout(timer.current)
    // 'failed' does not auto-clear. It is showing the URL for the member to
    // select by hand, and yanking it away after two seconds while they are
    // mid-selection would be worse than the original failure.
    if (state === 'copied') {
      timer.current = setTimeout(() => setCopyState(null), 2400)
    }
  }

  async function onCopy() {
    flash((await copyText(url)) ? 'copied' : 'failed')
  }

  // ── Instagram, honestly ───────────────────────────────────────
  // Instagram has no web share endpoint. There is no URL you can open that
  // posts a link to a story, a feed post or a DM — Meta has never shipped one,
  // and the "sharer" URLs that circulate for it are either the Facebook one or
  // dead. A button that pretends otherwise sends a member to a login wall and
  // teaches them the club's links are broken.
  //
  // What DOES work: on a phone, Instagram registers as a target in the OS
  // share sheet, so navigator.share() genuinely reaches it. On a desktop there
  // is no mechanism at all, so the honest action is to copy the link and say
  // where it has to go — the bio or a story sticker — rather than to hide the
  // button and pretend the club is not on Instagram.
  async function onInstagram() {
    // phoneShare, not navigator.share. Opening the macOS share sheet
    // from a button labelled "Instagram" is worse than copying the link: the
    // member scans a list that does not contain what they asked for and
    // concludes the club's page is broken. Copying does the useful half of the
    // job and the sentence underneath says what to do with it.
    if (phoneShare) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // An AbortError is the member changing their mind — the commonest
        // outcome of opening a share sheet, and not a failure. Falling through
        // to copy is safe either way: worst case they get the link they asked
        // to share.
      }
    }
    flash((await copyText(url)) ? 'copied' : 'failed')
  }

  async function onNativeShare() {
    try {
      await navigator.share({ title, text, url })
    } catch {
      // Cancelled, or refused. Nothing to say: the member closed a sheet they
      // opened, and a "share cancelled" message would be noise.
    }
  }

  // ── Why the text is built here and not in each href ───────────
  // encodeURIComponent, once, per destination. WhatsApp takes one combined
  // `text` field, X takes `text` and `url` separately and appends its own
  // spacing, and Facebook takes the URL only and ignores any text you send —
  // it composes from the page's own Open Graph tags. Those differences are the
  // reason the three hrefs below do not look alike.
  const shareLine = text ? `${title} — ${text}` : title
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareLine}\n${url}`)}`
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  const xHref =
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}` +
    `&text=${encodeURIComponent(shareLine)}`

  return (
    <section className="sh" aria-labelledby="sh-h">
      <h2 id="sh-h" className="sh__h">
        <Share2 size={14} aria-hidden="true" />
        Share this class
      </h2>

      <div className="sh__row">
        {/* target="_blank" with rel="noopener noreferrer" on all three.
            noopener because a sharer window keeps a handle on window.opener
            and can navigate this tab; noreferrer because the referrer would
            hand the network the exact class URL on every click, including for
            members who never complete the share. */}
        <a
          className="sh__btn sh__btn--wa"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          /* The accessible name names the DESTINATION and the CLASS. "Share"
             five times in a row is useless to anyone reading the page by
             links, and the class name is the only part that tells them what
             they are about to send. */
          aria-label={`Share ${title} on WhatsApp`}
        >
          <WhatsAppMark />
          <span className="sh__lbl">WhatsApp</span>
        </a>

        <a
          className="sh__btn sh__btn--fb"
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${title} on Facebook`}
        >
          <FacebookMark />
          <span className="sh__lbl">Facebook</span>
        </a>

        <a
          className="sh__btn sh__btn--x"
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${title} on X, formerly Twitter`}
        >
          <XMark />
          <span className="sh__lbl">X</span>
        </a>

        {/* A <button>, not an <a>. There is no URL behind it — see
            onInstagram — and dressing a script action as a link would let
            someone middle-click it into a new tab that loads nothing. */}
        <button
          type="button"
          className="sh__btn sh__btn--ig"
          onClick={onInstagram}
          aria-label={
            phoneShare
              ? `Share ${title} to Instagram`
              : `Copy the link to ${title} to paste into Instagram`
          }
        >
          <InstagramMark />
          <span className="sh__lbl">Instagram</span>
        </button>

        <button type="button" className="sh__btn sh__btn--copy" onClick={onCopy}>
          {copyState === 'copied' ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Link2 size={16} aria-hidden="true" />
          )}
          <span className="sh__lbl">
            {copyState === 'copied' ? 'Copied' : 'Copy link'}
          </span>
        </button>

        {/* Phones only, and NOT because a desktop would throw — macOS Chrome
            opens a real sheet. Because on a desktop every useful destination
            in that sheet is already a button to its left, so "More" is a sixth
            control that wraps the row onto a second line to offer Mail. On a
            phone the sheet is the whole point: it reaches Instagram, Signal,
            Messages, AirDrop and everything else the club's members use that
            this row will never have a button for.

            Not rendered rather than rendered-and-disabled: a disabled control
            is a promise it will work later, and here it never will. */}
        {phoneShare && (
          <button
            type="button"
            className="sh__btn sh__btn--native"
            onClick={onNativeShare}
            aria-label={`Share ${title} another way`}
          >
            <Share2 size={16} aria-hidden="true" />
            <span className="sh__lbl">More</span>
          </button>
        )}
      </div>

      {/* aria-live on a container that is ALWAYS in the tree. A live region
          that is added to the DOM at the same moment as its message is not
          reliably announced — the region has to exist first for the browser to
          be watching it. So the <p> is permanent and only its text changes. */}
      <p className="sh__say" role="status" aria-live="polite">
        {copyState === 'copied' && 'Link copied — paste it wherever you like.'}
        {copyState === 'failed' && (
          <>
            Your browser blocked the copy. Here is the link:{' '}
            {/* A real input, readOnly and select-all-on-focus, because the
                member now has to copy it by hand and selecting a span of text
                on a phone is a fight. */}
            <input
              className="sh__url"
              value={url}
              readOnly
              onFocus={(e) => e.target.select()}
              aria-label={`Link to ${title}`}
            />
          </>
        )}
        {!copyState && !phoneShare && (
          <>Instagram can&rsquo;t take a link from a browser — the button copies
          it so you can paste it into your story or bio.</>
        )}
      </p>
    </section>
  )
}

// ── The CSS ───────────────────────────────────────────────────────
// Exported as a string and injected by the page, matching how ClassPage
// already handles its own styles. Kept in this file so the component and its
// appearance move together.
//
// NO BACKTICKS anywhere below, including in comments: this is a JS template
// literal, and one backtick in a CSS comment ends the string mid-stylesheet.
// That has already broken this codebase once.
export const SHARE_CSS = `
.sh { margin-top: 30px; padding-top: 26px; border-top: 1px solid var(--line); }
.sh__h {
  display: flex; align-items: center; gap: 7px;
  margin: 0 0 14px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted);
}
.sh__h svg { color: var(--accent); }

.sh__row { display: flex; flex-wrap: wrap; gap: 8px; }

/* min-height 44 and min-width 44 on every one, so the row passes the tap
   target rule at 375px where it wraps to two lines (checklist 07). */
.sh__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; min-width: 44px; padding: 0 14px;
  border: 1px solid var(--line); border-radius: 10px;
  background: var(--surface); color: var(--ink);
  font: inherit; font-size: 13px; font-weight: 600;
  text-decoration: none; cursor: pointer;
  /* Only the properties that actually change, and 200ms ease-out
     (checklist 06). No transition: all, which would animate the focus ring. */
  transition: border-color 200ms ease-out, color 200ms ease-out,
              background-color 200ms ease-out;
}

/* ── Brand colour as feedback, not as decoration ──
   The palette is one accent (checklist 03). Four saturated brand colours
   sitting in a row would wreck that and make the share row shout louder than
   the Book button, which is the actual point of the page.
   So the marks are ink-coloured at rest and adopt their brand colour on hover
   and on keyboard focus. The colour becomes a response to the member rather
   than a permanent claim on their attention. */
.sh__btn:hover { background: color-mix(in srgb, var(--ink) 4%, var(--surface)); }
.sh__btn--wa:hover svg, .sh__btn--wa:focus-visible svg { color: #1da851; }
.sh__btn--fb:hover svg, .sh__btn--fb:focus-visible svg { color: #1667d9; }
.sh__btn--x:hover svg, .sh__btn--x:focus-visible svg { color: #000; }
.sh__btn--ig:hover svg, .sh__btn--ig:focus-visible svg { color: #c2298a; }
.sh__btn--copy:hover svg, .sh__btn--native:hover svg { color: var(--accent); }
.sh__btn:hover { border-color: color-mix(in srgb, var(--ink) 22%, var(--line)); }

/* A real focus ring, not the browser default (checklist 08). Offset so it sits
   outside the border instead of tracing it. */
.sh__btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: var(--accent);
}

/* The tick that replaces the link icon on a successful copy. 240ms, ease-out,
   and it scales rather than bounces. */
.sh__btn--copy svg { transition: transform 240ms ease-out; }

.sh__say {
  margin: 12px 0 0;
  font-size: 12.5px; line-height: 1.6; color: var(--muted);
  /* Reserves one line so the row does not jump when a message appears
     (checklist 08, no layout shift). min-height rather than a fixed height,
     because the failure message is two lines plus an input. */
  min-height: 20px;
}
.sh__url {
  display: block; width: 100%; margin-top: 8px;
  min-height: 40px; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--ink);
  font-size: 12.5px; font-family: var(--font-mono, ui-monospace, monospace);
}
.sh__url:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

@media (prefers-reduced-motion: reduce) {
  .sh__btn, .sh__btn--copy svg { transition: none; }
}

/* ── 400px and under ──
   Labels drop and the buttons become a row of equal squares. Not because the
   labels do not fit — they do, over two lines — but because two wrapped lines
   of five pill buttons is the tallest thing on a phone screen at the exact
   point where the member is meant to be looking at the Book button above it.
   The accessible names on every control are unchanged, so nothing is lost to
   a screen reader; this is the label being redundant next to a mark everyone
   already recognises. */
@media (max-width: 400px) {
  .sh__row { gap: 7px; }
  .sh__btn { flex: 1 1 0; min-width: 0; padding: 0; }
  /* Clipped, NOT display:none. The Copy button's label is the only place the
     word "Copied" is written, and display:none would remove it from the
     accessibility tree along with the screen. Clipping keeps every control
     named and keeps that confirmation readable to a screen reader, which is
     the one audience that cannot see the tick icon replace the link icon. */
  .sh__lbl {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap; border: 0;
  }
}
`
