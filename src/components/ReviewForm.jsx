// ============================================================
// LEAVE A REVIEW — the write half of Section 3b.
//
// Lives on /booking/:token, which the member already holds: the manage_token
// in that URL is the same credential they cancel with, and it is the ONLY
// credential a guest has (guests book with no account — see class_bookings in
// supabase-classes.sql). A separate /r/:token route was the alternative and
// would have meant a second link to send, a second page to explain and a
// second place for the token to leak.
//
// It only appears once the class has run. A form asking how a class was,
// sitting under a booking for next Tuesday, is a question nobody can answer —
// and the RPC refuses it anyway, so rendering it would be an invitation to be
// told no.
//
// NO CLASS NAME IS HARD-CODED. The heading is handed the name from the booking
// row, so a class renamed between the session and the review asks about it
// under its current name.
// ============================================================
import { useState } from 'react'
import { Check, Star } from 'lucide-react'

import { supabase, supabaseConfigured } from '../lib/supabase'

// ── Why the words are here and not only in the database ───────────
// submit_class_review() returns a message for every refusal, and that message
// is what gets shown — the server is the only thing that knows whether the
// booking was cancelled, already rated, or in the future. This map is the
// fallback for the cases the server never gets to answer: no network, no
// database, a function that has not been installed yet.
const OFFLINE =
  'We can\u2019t save reviews just now. Your booking is unaffected \u2014 try ' +
  'again later, or tell your coach what you thought.'

/**
 * @param {string} token       The booking's manage_token, from the URL.
 * @param {string} className   The class's name as it is right now.
 * @param {string} bookerName  Used only to SHOW how the name will appear.
 */
export default function ReviewForm({ token, className, bookerName }) {
  // 0 = nothing chosen yet. Stars are required: a comment with no score is a
  // message to the coach, not a review, and it would not move the average the
  // class page prints next to the price.
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [err, setErr] = useState('')

  // ── How the name will read, computed here AND in SQL ──────────
  // The same first-name + last-initial rule as submit_class_review(). It is
  // duplicated deliberately and the duplication is one-directional: SQL is
  // what actually gets stored, this is only a preview of it. If the two ever
  // disagree the database wins and the member sees a slightly different label
  // than predicted — the failure of a preview, not of a record.
  //
  // Showing it at all is the point. A member who does not want their surname
  // initial on a public page can only object if they are told, before they
  // press the button, what is going to be published.
  const shown = (() => {
    const typed = name.trim()
    if (typed) return typed
    const whole = (bookerName || '').trim()
    const [first, second] = whole.split(/\s+/)
    if (!first) return 'Made Running member'
    return second ? `${first} ${second[0].toUpperCase()}.` : first
  })()

  async function submit(e) {
    e.preventDefault()
    if (!stars || busy) return
    setBusy(true)
    setErr('')

    if (!supabaseConfigured) {
      setErr(OFFLINE)
      setBusy(false)
      return
    }

    const { data, error } = await supabase.rpc('submit_class_review', {
      p_manage_token: token,
      p_stars: stars,
      p_comment: comment.trim() || null,
      // null, not the preview string. Sending `shown` would store a name the
      // member never typed and make the SQL fallback unreachable — including
      // the abbreviation rule, which is the thing protecting their surname.
      p_rater_name: name.trim() || null,
    })

    setBusy(false)

    // A returns-table RPC arrives as an array of one row.
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row) {
      setErr(OFFLINE)
      return
    }
    // The server's own sentence, for refusals and for success alike. It knows
    // which of the two promises it just made — "this is live" or "a coach will
    // read it first" — and this component deliberately does not guess.
    if (!row.ok) {
      setErr(row.message || OFFLINE)
      return
    }
    setDone(row.message)
  }

  if (done) {
    return (
      <div className="rv rv--done" role="status">
        <Check size={17} aria-hidden="true" />
        <p>{done}</p>
      </div>
    )
  }

  return (
    <form className="rv" onSubmit={submit}>
      {/* A fieldset with a legend, because the five stars are one question with
          five answers. Without it a screen reader meets five unlabelled radios
          and no indication of what is being rated. */}
      <fieldset className="rv__set">
        <legend className="rv__legend">How was {className}?</legend>

        {/* Real radio inputs under the stars, not buttons with onClick.
            Radios give arrow-key navigation, a single tab stop for the whole
            group, and required-validation for free — all of which would
            otherwise have to be rebuilt by hand and usually are not. */}
        <div className="rv__stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={`rv__star${n <= stars ? ' is-on' : ''}`}
              /* The visible label is a star shape, so the accessible name has
                 to be words. "3 stars" and not "3", because a screen reader
                 reading "one two three four five" gives no clue what the
                 scale is. */
              title={n === 1 ? '1 star' : `${n} stars`}
            >
              <input
                type="radio"
                name="rv-stars"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                required
              />
              <Star size={30} aria-hidden="true" />
              <span className="rv__srOnly">{n === 1 ? '1 star' : `${n} stars`}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="rv__label" htmlFor="rv-comment">
        Anything you&rsquo;d like to add? <span>Optional</span>
      </label>
      <textarea
        id="rv-comment"
        className="rv__area"
        rows={3}
        maxLength={600}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What the session was like, who it would suit…"
      />

      <label className="rv__label" htmlFor="rv-name">
        Show my name as <span>Optional</span>
      </label>
      <input
        id="rv-name"
        className="rv__input"
        type="text"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={shown}
        /* The preview is the hint text AND is spelled out below, because a
           placeholder disappears the moment anyone types and this is the one
           sentence the member needs to have read. */
      />
      <p className="rv__fine">
        This will appear on the {className} page as <strong>{shown}</strong>.
      </p>

      {err && <p className="rv__err" role="alert">{err}</p>}

      <button className="rv__btn" type="submit" disabled={!stars || busy}>
        {busy ? 'Sending…' : 'Leave review'}
      </button>
    </form>
  )
}

// NO BACKTICKS below, including inside comments — this is a JS template
// literal and one backtick would end the string mid-stylesheet.
export const REVIEW_CSS = `
.rv { margin: 20px 0 0; text-align: left; }
.rv__set { border: 0; padding: 0; margin: 0 0 14px; }
.rv__legend {
  padding: 0; margin-bottom: 10px;
  font-size: 14px; font-weight: 600; color: var(--ink);
}

.rv__stars { display: flex; gap: 4px; }

/* The input is visually hidden but NOT display:none — a hidden-by-display
   radio is removed from the tab order and from the accessibility tree, which
   would leave a star rating no keyboard can reach. Clipped instead, so it
   still focuses, still responds to arrow keys, and still reports its state. */
.rv__star input {
  position: absolute; width: 1px; height: 1px; opacity: 0;
  margin: 0; pointer-events: none;
}
.rv__star {
  /* 44px of tappable area around a 30px star (checklist 07). Stars set tight
     against each other on a phone is the classic mis-tap. */
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px;
  cursor: pointer; color: var(--line);
  border-radius: 10px;
  transition: color 200ms ease-out, transform 200ms ease-out;
}
.rv__star.is-on { color: var(--accent); }
.rv__star.is-on svg { fill: currentColor; }
.rv__star:hover { transform: scale(1.06); }
/* focus-within, because the focus lands on the clipped input and the ring has
   to appear on the star the member can actually see. */
.rv__star:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }

.rv__srOnly {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}

.rv__label {
  display: block; margin: 14px 0 6px;
  font-size: 13px; font-weight: 600; color: var(--ink);
}
.rv__label span {
  font-weight: 500; color: var(--muted); font-size: 12px; margin-left: 4px;
}
.rv__area, .rv__input {
  display: block; width: 100%; box-sizing: border-box;
  padding: 10px 12px; min-height: 44px;
  border: 1px solid var(--line); border-radius: 10px;
  background: var(--surface); color: var(--ink);
  font: inherit; font-size: 14px; line-height: 1.5;
  resize: vertical;
}
.rv__area:focus-visible, .rv__input:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 1px;
  border-color: var(--accent);
}
.rv__fine { margin: 7px 0 0; font-size: 12px; color: var(--muted); line-height: 1.55; }
.rv__err {
  margin: 12px 0 0; padding: 10px 12px;
  border-radius: 9px; font-size: 13px; line-height: 1.55;
  background: color-mix(in srgb, #b3261e 8%, var(--surface));
  color: #8c1d18;
}
.rv__btn {
  margin-top: 14px; width: 100%; min-height: 46px;
  border: 0; border-radius: 11px;
  background: var(--accent); color: #fff;
  font: inherit; font-size: 14px; font-weight: 700;
  letter-spacing: 0.01em; cursor: pointer;
  transition: opacity 200ms ease-out;
}
.rv__btn:hover:not(:disabled) { opacity: 0.9; }
/* Press state for touch, replacing the tap highlight app.css removes. Below
   :hover on purpose — same specificity, and a phone fires both on one tap. */
@media (hover: none) and (pointer: coarse) {
  .rv__btn:active:not(:disabled) {
    transform: scale(0.985);
    transition-duration: 110ms;
  }
}
.rv__btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* Disabled until a score is picked. not-allowed rather than a hidden button,
   so the member can see the action exists and that something is required
   before it. */
.rv__btn:disabled { opacity: 0.45; cursor: not-allowed; }

.rv--done {
  display: flex; align-items: flex-start; gap: 10px;
  margin: 18px 0 0; padding: 13px 14px;
  border: 1px solid var(--line); border-radius: 11px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  text-align: left;
}
.rv--done svg { color: var(--accent); flex: none; margin-top: 2px; }
.rv--done p { margin: 0; font-size: 13.5px; line-height: 1.6; }

/* ── 16px on phones, and it has to be exactly 16 ──────────────────────────
   iOS Safari zooms the whole page the instant a field with a font SMALLER
   than 16px takes focus. A hard WebKit threshold, not a preference, and 14px
   is well under it.

   This form is the worst place for it to happen: it lives on
   /booking/:token, the page a member opens from the confirmation link on
   their phone, and the comment box is a textarea — so they are typing
   several lines while the layout sits zoomed and drifting sideways. The star
   row they just used scrolls out of shot and nothing but a manual pinch
   brings it back.

   900px rather than 640px, matching app.css: the trigger is a touch
   keyboard, not a narrow screen, and a tablet in portrait has one. */
@media (max-width: 900px) {
  .rv__area, .rv__input { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .rv__star, .rv__btn { transition: none; }
  /* :active included for the same reason as :hover — on a phone the press
     state is the only one of the two that ever fires. */
  .rv__star:hover, .rv__btn:active { transform: none; }
}
`
