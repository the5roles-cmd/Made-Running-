// ============================================================
// MANAGE BOOKING — flow-chart Step 11. Route: /booking/:token
//
//   Step 11 · A member or guest cancels their own booking.
//   Step 12 · The places are freed immediately.
//   Step 14 · The front of the waiting list is offered the place.
//
// THIS PAGE IS PUBLIC AND IT IS THE GUEST'S ONLY DOOR. A signed-in member
// cancels from their dashboard; someone who booked without an account has no
// dashboard, no password and nothing to log in to. The uuid in the URL is the
// whole credential — it was returned exactly once, on the confirmation screen
// they have just come from.
//
// Because it is public it cannot read class_bookings directly: there is no
// anon SELECT policy on that table, deliberately. It reads through
// public_booking_by_token(), which returns one row and only the fields the
// holder of the token already knows or needs.
//
// NO CLASS NAME IS HARD-CODED HERE. The class is named from the row, so
// renaming a class renames it on this page, in its tab title and in its
// cancellation notice — the standing rule for every page in this feature.
// ============================================================
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin,
  Ticket, Users, XCircle,
} from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { tenant } from '../lib/theme'
import { fmtDayDate, fmtClockFromStamp, fmtPrice, relativeWhen } from '../lib/classes'
import ReviewForm, { REVIEW_CSS } from '../components/ReviewForm'

export default function ManageBooking() {
  const { token } = useParams()

  // Four distinct states, not two booleans. 'loading' and 'missing' look the
  // same to a naive `if (!booking)` check, and the difference is the whole
  // message: one says "one moment", the other says "this link is not valid".
  const [phase, setPhase] = useState('loading') // loading | ready | missing | error
  const [booking, setBooking] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelled, setCancelled] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    async function load() {
      if (!supabaseConfigured || !token) {
        setPhase('missing')
        return
      }
      const { data, error } = await supabase.rpc('public_booking_by_token', {
        p_token: token,
      })
      if (!live) return
      if (error) {
        // Distinguished from "not found" on purpose. Telling someone their
        // link is invalid when the real problem is that the RPC is not
        // deployed sends them to recreate a booking they already have.
        setPhase('error')
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) {
        setPhase('missing')
        return
      }
      setBooking(row)
      setPhase('ready')
    }
    load()
    return () => { live = false }
  }, [token])

  // The tab title names the class, once it is known. Set in its own effect so
  // it re-runs when the booking arrives — the first render has no class name
  // and a title of "undefined — Made Running" is what you get from doing this
  // inline.
  useEffect(() => {
    document.title = booking?.class_name
      ? `${booking.class_name} booking — ${tenant.name}`
      : `Your booking — ${tenant.name}`
  }, [booking])

  async function doCancel() {
    if (busy) return
    setBusy(true)
    setErr('')
    const { data, error } = await supabase.rpc('cancel_class_booking', {
      p_manage_token: token,
    })
    setBusy(false)
    if (error) {
      setErr('We could not cancel that just then. Please try again in a moment.')
      return
    }
    if (!data?.ok) {
      setErr('We could not find that booking. It may already have been cancelled.')
      return
    }
    // `already` is a success, not a failure — someone clicking their cancel
    // link twice should be told they are cancelled, not shown an error.
    setCancelled({
      already: !!data.already,
      seatsLeft: data.seats_left ?? null,
      offeredTo: data.offered_to || null,
    })
  }

  const isCancelled = !!cancelled || booking?.status === 'cancelled'
  const sessionOff = booking?.session_status === 'cancelled'
  const past = booking?.starts_at ? new Date(booking.starts_at) < new Date() : false

  return (
    <div className="mb">
      {/* REVIEW_CSS travels with ReviewForm so the two cannot drift, but it is
          injected here — this <div> renders once per page, the form renders
          conditionally, and a <style> inside a conditional component adds and
          removes rules as the member's booking moves into the past. */}
      <style>{MB_CSS + REVIEW_CSS}</style>

      <header className="mb__bar">
        <Link to="/book" className="mb__back">
          <ArrowLeft size={15} aria-hidden="true" />
          Timetable
        </Link>
        <span className="mb__brand">{tenant.name}</span>
      </header>

      <main className="mb__wrap">
        {phase === 'loading' && (
          <p className="mb__quiet" role="status">Finding your booking…</p>
        )}

        {phase === 'error' && (
          <div className="mb__card">
            <AlertTriangle size={30} className="mb__icon" aria-hidden="true" />
            <h1 className="mb__title">We can&rsquo;t check that right now</h1>
            <p className="mb__body">
              Your booking is safe — we just couldn&rsquo;t reach the system to
              show it to you. Please try this link again shortly, or message the
              club and they will cancel it for you.
            </p>
            <Link to="/book" className="mb__btn mb__btn--ghost">Back to the timetable</Link>
          </div>
        )}

        {phase === 'missing' && (
          <div className="mb__card">
            <AlertTriangle size={30} className="mb__icon" aria-hidden="true" />
            <h1 className="mb__title">That link doesn&rsquo;t match a booking</h1>
            <p className="mb__body">
              It may have been typed incompletely, or the booking may already
              have been cancelled. You can book again from the timetable.
            </p>
            <Link to="/book" className="mb__btn mb__btn--primary">See the timetable</Link>
          </div>
        )}

        {phase === 'ready' && booking && (
          <div className="mb__card">
            {isCancelled ? (
              <>
                <XCircle size={30} className="mb__icon" aria-hidden="true" />
                <h1 className="mb__title">
                  {cancelled?.already ? 'Already cancelled' : 'Cancelled'}
                </h1>
                <p className="mb__body">
                  Your place at <strong>{booking.class_name}</strong> has been
                  released.{' '}
                  {/* Said out loud because it is the reassurance that stops a
                      follow-up phone call, and because Step 12's promise is
                      that the place is free IMMEDIATELY — not after an admin
                      gets round to it. */}
                  {cancelled?.offeredTo
                    ? <>It has already been offered to the next person on the waiting list.</>
                    : <>The space is free for someone else straight away.</>}
                </p>
                {booking.payment_status === 'paid' && (
                  <p className="mb__note">
                    You had paid for this one. The club will arrange your refund
                    — nothing further to do.
                  </p>
                )}
                <Link to="/book" className="mb__btn mb__btn--primary">
                  Book something else
                </Link>
              </>
            ) : (
              <>
                <CheckCircle2 size={30} className="mb__icon" aria-hidden="true" />
                <h1 className="mb__title">{booking.class_name}</h1>

                <ul className="mb__facts">
                  <li>
                    <CalendarDays size={14} aria-hidden="true" />
                    {relativeWhen(booking.starts_at) || fmtDayDate(booking.starts_at)}
                  </li>
                  <li>
                    <Clock size={14} aria-hidden="true" />
                    {fmtClockFromStamp(booking.starts_at)}
                  </li>
                  {booking.location && (
                    <li><MapPin size={14} aria-hidden="true" />{booking.location}</li>
                  )}
                  <li>
                    <Users size={14} aria-hidden="true" />
                    {/* Your "Sarah + 4" rule, on the member's own copy of the
                        booking too — so what they see matches what the coach
                        reads off the register at the door. */}
                    {booking.places > 1
                      ? `${booking.booker_name} + ${booking.places - 1}`
                      : (booking.attendee_name || booking.booker_name)}
                  </li>
                  {booking.total_pennies > 0 && (
                    <li>
                      <Ticket size={14} aria-hidden="true" />
                      {fmtPrice(booking.total_pennies)}
                      {booking.payment_status === 'paid'
                        ? ' · paid'
                        : booking.payment_method === 'online'
                          ? ' · payment link to follow'
                          : ' · on arrival'}
                    </li>
                  )}
                </ul>

                {sessionOff && (
                  <p className="mb__note mb__note--warn">
                    The club has cancelled this session. You don&rsquo;t need to
                    do anything and nothing is owed.
                  </p>
                )}

                {past && !sessionOff && (
                  <>
                    <p className="mb__note">
                      This class has already taken place, so there&rsquo;s
                      nothing left to cancel.
                    </p>
                    {/* ── Section 3b: the review, asked here ──────────
                        The same page, the same token, the same visit. A
                        member who opens their booking after the class has run
                        has nothing else to do here — the only remaining
                        action on this page is one they cannot take — so this
                        is the one moment where asking costs them nothing.

                        Deliberately NOT shown before the class runs. A rating
                        form under a booking for next Tuesday asks a question
                        nobody can answer, and submit_class_review() refuses it
                        anyway (the not_yet branch), so rendering it would be
                        an invitation to be told no.

                        Also not shown on a cancelled booking or a session the
                        club called off: both are handled by branches above
                        this one, and neither is a class anybody attended. */}
                    <ReviewForm
                      token={token}
                      className={booking.class_name}
                      bookerName={booking.booker_name}
                    />
                  </>
                )}

                {err && <p className="mb__err" role="alert">{err}</p>}

                {!sessionOff && !past && (
                  <>
                    <button className="mb__btn mb__btn--danger"
                      onClick={doCancel} disabled={busy}>
                      {busy ? 'Cancelling…' : 'Cancel my place'}
                    </button>
                    {/* No confirm dialog. Cancelling is reversible by booking
                        again in two taps, the class is rarely full enough for
                        that to fail, and an extra "are you sure?" on a phone
                        is the step people abandon — leaving a held place that
                        nobody turns up to, which is the outcome this whole
                        page exists to prevent. */}
                    <p className="mb__fine">
                      You can book again any time if you change your mind.
                    </p>
                  </>
                )}

                <Link to="/book" className="mb__btn mb__btn--ghost">
                  Back to the timetable
                </Link>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

const MB_CSS = `
.mb {
  /* svh, with vh as the fallback — see .bk on the timetable. Matters a little
     more here: this page is opened from a confirmation email, which means a
     phone almost every time. */
  min-height: 100vh;
  min-height: 100svh;
  background: var(--paper, #efefef);
  color: var(--ink, #1c1c1c);
}
.mb__bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 18px 20px;
  max-width: 620px; margin: 0 auto;
}
.mb__back {
  display: inline-flex; align-items: center; gap: 7px;
  /* 44px minimum tap target, met with padding rather than a height so the
     text stays optically on the same line as the brand opposite it. */
  min-height: 44px; padding: 10px 2px;
  font-size: 13px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 66%, transparent);
  text-decoration: none;
}
.mb__back:hover { color: var(--ink); }
.mb__brand {
  font-family: var(--font-display); font-weight: 700;
  font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase;
  /* 72%, not the 50% this started at. 50% measured 3.19:1 on the #efefef
     bar — it looked like the quiet secondary label it is meant to be and
     failed AA by a wide margin. "Looks subtle" and "is readable" are
     decided by different things, and only one of them can be measured. */
  color: color-mix(in srgb, var(--ink) 72%, transparent);
}

.mb__wrap { max-width: 620px; margin: 0 auto; padding: 8px 20px 80px; }
.mb__quiet {
  font-size: 15px; padding: 48px 0;
  color: color-mix(in srgb, var(--ink) 60%, transparent);
}

.mb__card {
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: 14px;
  padding: 32px 28px;
}
.mb__icon { color: var(--accent); margin-bottom: 16px; }
.mb__title {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(24px, 5.5vw, 32px); line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 0 0 14px;
  /* Stated, not inherited: app.css declares color on h1 directly, and an
     inherited value never beats a declaration on the element. */
  color: var(--ink);
}
.mb__body {
  margin: 0 0 22px; font-size: 15.5px; line-height: 1.62;
  max-width: 54ch;
  color: color-mix(in srgb, var(--ink) 78%, transparent);
}

.mb__facts {
  list-style: none; margin: 0 0 24px; padding: 0;
  display: grid; gap: 10px;
}
.mb__facts li {
  display: flex; align-items: center; gap: 9px;
  font-size: 14.5px;
  color: color-mix(in srgb, var(--ink) 80%, transparent);
}
.mb__facts svg { color: var(--accent); flex: none; }

.mb__note {
  margin: 0 0 20px; padding: 13px 15px;
  border-radius: 9px;
  border-left: 3px solid color-mix(in srgb, var(--ink) 24%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  font-size: 14px; line-height: 1.55;
}
.mb__note--warn { border-left-color: var(--accent); }
.mb__err {
  margin: 0 0 18px; padding: 12px 14px;
  border-radius: 9px;
  border: 1px solid #c0392b;
  background: color-mix(in srgb, #c0392b 8%, transparent);
  /* Darkened rather than used at brand red: #c0392b on its own 8% tint is
     3.9:1, under the 4.5:1 body minimum. */
  color: #8e2a20;
  font-size: 14px; line-height: 1.55;
}

.mb__btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; min-height: 48px; padding: 0 22px;
  width: 100%;
  border-radius: 999px; border: 1px solid transparent;
  font-family: inherit; font-size: 15px; font-weight: 600;
  text-decoration: none; cursor: pointer;
  transition: background 220ms ease-out, color 220ms ease-out,
              border-color 220ms ease-out;
}
.mb__btn + .mb__btn { margin-top: 10px; }
.mb__btn--primary { background: var(--ink); color: #fff; }
.mb__btn--primary:hover { background: color-mix(in srgb, var(--ink) 86%, #fff); }
.mb__btn--ghost {
  background: transparent; color: var(--ink);
  border-color: color-mix(in srgb, var(--ink) 20%, transparent);
}
.mb__btn--ghost:hover { border-color: var(--ink); }
.mb__btn--danger {
  /* 5.9:1 against white. The obvious #c0392b is 4.2:1 with white text — it
     looks fine and fails AA, which is the usual way this gets shipped. */
  background: #a32b1e; color: #fff;
}
.mb__btn--danger:hover { background: #8a2419; }
.mb__btn[disabled] { opacity: 0.6; cursor: default; }

.mb__fine {
  margin: 10px 0 18px; font-size: 13px; text-align: center;
  /* 58% measured 4.21:1 on white — under the 4.5:1 body minimum, and the
     kind of near-miss that is invisible by eye. 68% clears it. */
  color: color-mix(in srgb, var(--ink) 68%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .mb *, .mb *::before, .mb *::after {
    transition: none !important; animation: none !important;
  }
}
`
