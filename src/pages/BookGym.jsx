// BookGym — the PUBLIC Hub class timetable + booking (route /book).
//
// ── What changed, and why ────────────────────────────────────────────
// This page used to be database-first: it called list_gym_classes on mount
// and rendered whatever came back. That had two problems for a visitor
// arriving from the landing page's "Book a Class" card:
//
//   1. supabase-bookings.sql has not been run, so the RPC does not exist.
//      A guest hit an error message where the timetable should be.
//   2. Even once it IS run, a network round-trip sits between the click and
//      any content. The club's timetable does not change minute to minute —
//      making someone wait on a database to find out that Yoga is Thursday
//      7pm is a cost with no benefit.
//
// So the timetable now renders SYNCHRONOUSLY from src/lib/hubClasses.js
// (transcribed from the club's own "MADE Hub Classes" sheet). Zero requests,
// zero loading state, works signed-out, works offline, works right now.
//
// Live seat counts and payment are a PROGRESSIVE ENHANCEMENT layered on top:
// if Supabase is configured AND the booking RPCs exist, the page upgrades
// itself with real availability. If not, booking falls back to the club's
// actual instruction from the sheet — join the group chat and claim a space.
// The visitor never sees a broken page either way.
//
// ── SECTION 3c · the calendar of cards ───────────────────────────────
// The week below is no longer a list of rows. Each day is a dated band and
// each class is a card, and a card OPENS IN PLACE (your choice) to show the
// coach, a class video and the class rating — so someone weighing up
// Tuesday's two classes never leaves the grid to compare them.
//
// What is visible with no database at all: the cards, the coach's name, and a
// one-line summary of what that coach leads, DERIVED from this same timetable
// (see coachRoster in hubClasses.js). What needs supabase-classes.sql +
// supabase-coaches-seed.sql: photos, credentials, coach-written bios, videos
// and star ratings. Those are absent rather than faked — a rating is real
// members' opinions of a named human being, and there is no honest way to
// derive one.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, User, ArrowRight, CheckCircle2, MessageCircle, Lock,
  Star, ChevronDown, MapPin, Ticket,
  // Aliased: `Link` is already react-router's navigation component in this
  // file, and lucide exports an icon of the same name.
  Link2 as LinkIcon,
} from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { tenant } from '../lib/theme'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../auth/AuthProvider'
import {
  classesByDay,
  upcomingClasses,
  formatTime,
  relativeDay,
  nextOccurrence,
  classAvailability,
  coachRoster,
  coachSlug,
  HUB_FOOTNOTE,
  HUB_PLACEHOLDER_PRICE_PENNIES,
  DISCIPLINE_IMAGE,
  classCopy,
} from '../lib/hubClasses'
import {
  usePublicClasses,
  usePublicCoaches,
  videoEmbed,
  ratingCopy,
  coachPath,
  fmtPrice,
  imageSrc,
  imageFocus,
} from '../lib/classes'

// ── Why the DATE is on the card and not on the day heading ───────────
// The first build of this dated each band — "MONDAY 28 SEP", "SUNDAY 27 SEP"
// — and the screenshot showed the week running backwards at the end. On a
// Sunday, "the next Monday" is tomorrow and "the next Sunday" is today, so a
// fixed Monday-to-Sunday order prints 28, 29, 30, 1, 2, 3, 27.
//
// Anchoring the whole week to one Monday fixes the ordering and breaks
// something worse. Anchor on the UPCOMING Monday and on a Wednesday morning
// the band reads "WEDNESDAY 7 OCT" above a class running tonight; anchor on
// the most recent Monday and most of the week is in the past.
//
// There is no anchor that works, because the date was attached to the wrong
// thing. A weekday repeats forever and has no date. Only a CLASS has a next
// occurrence — and at 12:22 on Sunday the noon class genuinely belongs to
// next Sunday while the band still says "Sunday". So each card states its own
// date, the band names the weekday, and the contradiction has nowhere to live
// rather than being hidden behind a cleverer anchor.

// "29 Sep"
const fmtDayNum = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// "K3 & Marvin" → "KM". Words that do not start with a letter ("&") are
// skipped, or the avatar for the club's shared-handle coaches would read "K&".
function initialsOf(name) {
  return (name || '')
    .split(/\s+/)
    .map((w) => w.match(/[a-z]/i)?.[0] || '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ── One coach, from up to three sources ──────────────────────────────
// Precedence matters and runs: coach profile → class row → this file.
//
//   name  — the DATABASE wins. If an admin corrects a spelling in Section 2
//           the card must show the correction, not the PDF transcription.
//   bio   — a real bio the coach WROTE beats the derived one. The derived
//           line is the floor, never the ceiling.
//   slug  — only set when a profile actually exists, because it becomes
//           /coaches#<slug>. Linking to an anchor with nothing behind it
//           scrolls nowhere and reads as a broken page — which today would
//           be every coach on the timetable, since the SQL is unrun.
function mergeCoach(cls, db, coachBySlug, bioByName) {
  const name = (db?.coach_name || cls.coach || '').trim() || null
  if (!name) return null

  const slug = db?.coach_slug || coachSlug(name)
  const profile = coachBySlug[slug] || null
  const written = (profile?.bio || '').trim()

  return {
    name,
    href: profile ? coachPath(slug) : null,
    photo: profile?.photo_url || null,
    credentials: (profile?.credentials || '').trim() || null,
    bio: written || bioByName[name] || null,
    // Drives the heading only: "About Jade" for words Jade wrote, "On the
    // timetable" for a sentence this app assembled. The club should never be
    // shown a paragraph in a coach's voice that the coach did not write.
    written: !!written,
  }
}

// ── Turning a refusal code into a sentence ───────────────────────────
// book_hub_class() answers a refusal with a machine reason, not prose, so
// that this file owns the wording and the database owns the rule. The two
// change for completely different motives: 'paused' becomes better copy
// because a member was confused, never because the rule moved.
//
// A map rather than a switch so the DEFAULT is forced to be written down.
// An unmapped reason with a switch falls out as `undefined`, and
// setFormErr(undefined) renders an empty red box — a page that visibly
// failed while saying nothing about it.
const REFUSAL_COPY = {
  email_required:
    'Please add an email address — it is how the coach confirms your place.',
  past:
    'That class has already started. Have a look at the next one on the timetable.',
  paused:
    'That class is paused at the moment. The timetable shows when it is back.',
  cancelled:
    'That session has been cancelled. Nothing has been charged.',
  no_session:
    'There is no upcoming date for that class yet. Please try another one.',
  unknown_class:
    'We could not find that class. It may have been renamed — please pick it from the timetable again.',
  unknown_org:
    'Something is wrong with this booking link. Please book from the timetable.',
}

function refusalMessage(reason) {
  return (
    REFUSAL_COPY[reason] ||
    'We could not book that just now. Please try again, or message the club.'
  )
}

// ── Payment link (Square via /api/checkout) ───────────────────────
// Returns a hosted-payment-page URL, or null for BOTH "no provider
// configured" ({ demo: true }) and any failure. Null is safe here because
// the caller treats it as "the club will send a payment link" — the
// booking itself is never at risk from a payment hiccup.
//
// Note what is NOT sent: a price. The server prices class places itself
// (see api/checkout.js) so DevTools cannot negotiate a discount. The
// bookingId doubles as the idempotency key server-side, so a retried
// request gets the SAME link back rather than a duplicate order.
async function fetchClassPayLink({ bookingId, title, places, email, successUrl }) {
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'class',
        bookingId,
        title,
        places,
        email,
        // Square sends the payer here AFTER a successful payment. Callers
        // that hold a manage token aim this at the manage-booking page so
        // the token survives the round-trip inside the URL itself.
        successUrl: successUrl || `${window.location.origin}/book?paid=1`,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.url || null
  } catch {
    return null
  }
}

export default function BookGym() {
  // `user` may legitimately be null — this page is public. It is used only to
  // pre-fill the booking form and soften the copy, never to gate access.
  const { user } = useAuth()

  const [active, setActive] = useState(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')
  // Square's payment page sends the payer back here with ?paid=1 after a
  // successful card payment (fetchClassPayLink's successUrl). Landing on a
  // bare timetable after paying reads as "did that go through?" — so the
  // return trip opens on a receipt, not a reset form. Lazy initialiser:
  // read once on mount, never re-parsed on re-render.
  const [done, setDone] = useState(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('paid') === '1'
      ? { paidReturn: true, total: 0 }
      : null
  )

  // ── Step 4b: who the booking is for ──────────────────────────────
  // Mirrors class_bookings.booked_for exactly ('me' | 'someone_else' |
  // 'group') so the form state maps onto the column with no translation.
  const [bookedFor, setBookedFor] = useState('me')
  const [attendeeName, setAttendeeName] = useState('')
  const [places, setPlaces] = useState(1)

  // ── Payment ──────────────────────────────────────────────────────
  // 'on_arrival' stays the default even though 'online' is real now
  // (Square payment links via /api/checkout): cash on the door is how most
  // of the club pays today, and on a deployment with no Square token the
  // online branch degrades to "the club will send a payment link" — honest,
  // but not a dead end anyone should fall into by default.
  const [payMethod, setPayMethod] = useState('on_arrival')

  // Set when the database refuses the booking for lack of room. Held as an
  // object rather than a boolean because the offer needs to name the class and
  // say how many places were actually left — "full" and "only 2 left, you
  // asked for 5" are different problems and the second one is often fixable
  // by the member without a waiting list at all.
  const [waitOffer, setWaitOffer] = useState(null)

  // The tab title. /coaches and /c/:slug each set their own; this page was the
  // one left on the generic site title, and it is the one that matters most —
  // it is the destination of the WhatsApp group link and the website timetable
  // button, so it is what someone sees in their tab and in a shared link.
  useEffect(() => {
    document.title = `Class timetable — ${tenant.name}`
  }, [])

  // Which card is open. A single id, not a Set: one open panel at a time is
  // what makes "compare Tuesday's two classes" work — with several open the
  // cards are pushed so far apart that the comparison the expansion exists to
  // support becomes a scroll.
  const [openId, setOpenId] = useState(null)

  // ── Artwork that has stopped loading ──────────────────────────────
  // The discipline defaults are bundled by Vite, so they cannot 404. A
  // per-class image_url is a URL somebody pasted, on a host we do not control,
  // and it can start failing months later — a Canva link that expires, a Drive
  // file moved, a CDN retired.
  //
  // Tracked in state rather than by hiding the node imperatively on error. The
  // imperative version happens to work (React does not reset attributes it did
  // not set) but it relies on that, and this component re-renders on every
  // panel toggle. State is the version that is true because of what it says,
  // not because of what React currently does.
  //
  // A new Set per failure rather than mutating: React compares by identity, so
  // an in-place `.add()` changes nothing on screen.
  const [badArt, setBadArt] = useState(() => new Set())
  const markBadArt = (url) =>
    setBadArt((s) => (s.has(url) ? s : new Set(s).add(url)))

  // Computed once per mount rather than per render: `new Date()` inside the
  // render body would return a different value on every re-render, so the
  // "Up next" list could reshuffle while someone is mid-click.
  const now = useMemo(() => new Date(), [])
  const week = useMemo(() => classesByDay(), [])
  const next = useMemo(() => upcomingClasses(now, 3), [now])

  // The two progressive-enhancement reads. Neither is awaited and neither has
  // an error branch here — see usePublicClasses in lib/classes.js for why a
  // timetable that already rendered must not sprout a failure banner.
  const { classesBySlug } = usePublicClasses()
  const { coaches } = usePublicCoaches()

  const coachBySlug = useMemo(() => {
    const m = {}
    for (const c of coaches || []) m[c.slug] = c
    return m
  }, [coaches])

  // The no-database floor: one derived line per coach, keyed by name because
  // that is the only key the local timetable has for a coach.
  const bioByName = useMemo(() => {
    const m = {}
    for (const c of coachRoster()) m[c.name] = c.bio
    return m
  }, [])

  // Prefill from the signed-in member. A member should never retype their own
  // name to book a class they are already known at.
  useEffect(() => {
    if (!user) return
    setFullName((v) => v || user.user_metadata?.full_name || '')
    setEmail((v) => v || user.email || '')
  }, [user])

  // The price of any class, database first, placeholder second. Defined here
  // rather than inline because the booking form needs it too, and the form is
  // rendered a long way from the card loop that first computed it.
  function priceOf(cls) {
    return classesBySlug?.[cls?.dbSlug]?.price_pennies ?? HUB_PLACEHOLDER_PRICE_PENNIES
  }

  // ── Coach payment policy: pay on arrival ONLY ────────────────────
  // The club's instruction: every class Jade coaches is paid at the door —
  // no online option is offered on any of them. The rule follows the COACH,
  // not a list of class slugs, so adding Jade to a new class or moving her
  // off one changes the payment options with no code edit here.
  //
  // Matched on the resolved coach name — database coach_name first, local
  // timetable second — the exact order every other coach fact on this page
  // resolves in (see the coach panel), so the database and this rule can
  // never disagree about who is teaching.
  //
  // Lowercased once per entry: 'Jade' in the DB, 'jade' here, same person.
  const ARRIVAL_ONLY_COACHES = ['jade']
  function isArrivalOnly(cls) {
    const name = (classesBySlug?.[cls?.dbSlug]?.coach_name || cls?.coach || '')
      .trim()
      .toLowerCase()
    return ARRIVAL_ONLY_COACHES.includes(name)
  }

  function startBooking(cls) {
    setActive(cls)
    setFormErr('')
    setWaitOffer(null)
    // Reset the Step 4b answers. Without this, booking a group of 5 and then
    // going Back and booking a different class silently carries 5 places over
    // — the member sees a £30 total on a class they wanted alone.
    setBookedFor('me')
    setAttendeeName('')
    setPlaces(1)
    setPayMethod('on_arrival')
  }

  // ── Step W1: the waiting list ────────────────────────────────────────
  // Only reachable from a `full` / `not_enough_seats` refusal, so it reuses
  // the details already typed into the booking form rather than asking for
  // them a second time — being told "sorry, full" and then made to retype
  // your name is the moment people give up.
  async function joinWaitlist() {
    if (busy || !active) return
    if (!email.trim()) {
      setFormErr('We need an email address to tell you if a place comes up.')
      return
    }
    setBusy(true)
    setFormErr('')
    const { data, error } = await supabase.rpc('join_class_waitlist', {
      p_slug: tenant.key,
      p_class_slug: active.dbSlug,
      p_full_name: fullName.trim(),
      p_email: email.trim(),
      p_phone: phone.trim() || null,
      p_places: bookedFor === 'group' ? places : 1,
      // Coerced, not trusted: an arrival-only class records on_arrival no
      // matter what the state says. The online radio is never rendered for
      // these classes, so this is defence, not a code path.
      p_payment_method: isArrivalOnly(active) ? 'on_arrival' : payMethod,
    })
    setBusy(false)
    if (error || !data?.ok) {
      setFormErr(
        error
          ? 'We could not add you to the waiting list just then. Please try again.'
          : refusalMessage(data?.reason)
      )
      return
    }
    setDone({
      title: data.class_name || active.title,
      live: true,
      waitlisted: true,
      position: data.position ?? null,
      places: bookedFor === 'group' ? places : 1,
      payMethod,
      // A waiting-list place is not a sale. Showing a total here would look
      // like a charge for something that has not happened.
      total: 0,
      manageToken: null,
    })
    setActive(null)
    setWaitOffer(null)
  }

  async function submitBooking(e) {
    e.preventDefault()
    if (busy || !active) return
    // Same coercion as the waitlist: an arrival-only class books as
    // on_arrival whatever the state claims. Everything below — the RPC,
    // the pay-link decision, both confirmation screens — reads THIS,
    // never payMethod directly, so one line enforces the policy end to end.
    const method = isArrivalOnly(active) ? 'on_arrival' : payMethod
    setFormErr('')
    if (!fullName.trim()) {
      setFormErr('Please tell us your name so the coach knows who to expect.')
      return
    }
    // Booking FOR someone means the coach needs their name, not yours — the
    // register would otherwise show a person who is not coming.
    if (bookedFor === 'someone_else' && !attendeeName.trim()) {
      // A real apostrophe, not &rsquo;: this string is set as JS state and
      // rendered as text, so an HTML entity would show as literal characters.
      setFormErr('Please add the name of the person you\u2019re booking for.')
      return
    }
    if (bookedFor === 'group' && places < 2) {
      setFormErr('A group booking needs at least 2 spaces.')
      return
    }
    setBusy(true)
    setWaitOffer(null)

    // ── The one rule of this function (QA, Oct 2026) ──────────────────
    // A confirmation screen may only ever follow a SAVED booking, and a
    // payment may only ever follow a confirmation. The previous version
    // "recorded the request optimistically" when the RPC was missing —
    // which showed a success screen for a booking that existed nowhere,
    // and for "pay online" took real card payments against a seat no
    // coach would ever see on a register. Both paths now end in
    // bookingUnavailable() below: an honest refusal that keeps the form
    // (and everything typed into it) on screen for a retry.
    const bookingUnavailable = () => {
      setFormErr(
        'Online booking isn\u2019t switched on just yet, so nothing has been ' +
        'saved and you haven\u2019t been charged. Come along and pay on ' +
        'arrival, or message the club on Instagram (@made.running) and ' +
        'they\u2019ll hold you a place.'
      )
      setBusy(false)
    }

    if (supabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('book_hub_class', {
          p_slug: tenant.key,
          // The DATABASE's id for this class, not the hard-coded one from
          // hubClasses.js — those ids ('mon-0930-hot-kettlebells') exist only
          // in that file and match no row.
          p_class_slug: active.dbSlug,
          p_full_name: fullName.trim(),
          p_email: email.trim() || null,
          p_phone: phone.trim() || null,
          p_booked_for: bookedFor,
          p_attendee_name: bookedFor === 'someone_else' ? attendeeName.trim() : null,
          p_places: bookedFor === 'group' ? places : 1,
          p_payment_method: method,
          // Step 3: where this booking came from. The website timetable is
          // this page; the group-chat link and walk-ins set their own.
          p_source: 'website',
        })
        // ── Every failure is told the truth, but not the SAME truth ──
        // book_hub_class does not raise on a refusal, it returns
        // { ok: false, reason }. So `!error` was never "it worked" — a full
        // class arrived here with error === null and was shown the
        // confirmation screen. The member walked away believing they had a
        // place in a class that had already turned them down. That is worse
        // than any error message.
        //
        // PGRST202 means the function itself is not in the database yet.
        // An error with NO code is the other deployment state: the Supabase
        // host did not answer at all. Both are states of OUR infrastructure
        // — the visitor gets "booking isn't switched on yet", which is what
        // those states mean from where they stand, and crucially NOT a
        // confirmation and NOT a checkout.
        //
        // Every error that carries any OTHER code came from a database that
        // IS answering mid-booking — a transient fault worth retrying, so
        // its message says "try again in a moment" instead.
        if (error) {
          const dbUnreachable = error.code === 'PGRST202' || !error.code
          if (!dbUnreachable) {
            setFormErr(
              'We could not reach the booking system just then. ' +
              'Please try again in a moment.'
            )
            setBusy(false)
            return
          }
          bookingUnavailable()
          return
        } else if (data?.ok) {
          const placesBooked = data.places ?? (bookedFor === 'group' ? places : 1)
          // 'Pay online' is real now: ask the checkout endpoint for a
          // Square-hosted payment link. A payment failure never blocks the
          // booking: the seat is already held in the database, so payUrl
          // stays null and the confirmation falls back to "the club will
          // send you a payment link".
          //
          // The member chose "pay online", so they are TAKEN to the card
          // page (window.location.assign below) rather than parked on a
          // confirmation with one more button to find — the club's
          // instruction, twice. The manage token is not lost by leaving:
          // Square's redirect_url is the manage-booking page itself, so
          // the token rides home in the URL after payment. The screen
          // behind the redirect still renders the button, which is the
          // fallback if navigation is ever blocked.
          const payUrl =
            method === 'online'
              ? await fetchClassPayLink({
                  bookingId: data.manage_token || null,
                  title: data.class_name || active.title,
                  places: placesBooked,
                  email: email.trim() || undefined,
                  successUrl: data.manage_token
                    ? `${window.location.origin}/booking/${data.manage_token}?paid=1`
                    : undefined,
                })
              : null
          setDone({
            title: data.class_name || active.title, live: true,
            places: placesBooked,
            payMethod: data.payment_method || method,
            total: data.total_pennies ?? (priceOf(active) * (bookedFor === 'group' ? places : 1)),
            startsAt: data.starts_at || null,
            seatsLeft: data.seats_left ?? null,
            payUrl,
            // The screen that renders between setDone and the Square page
            // actually loading (a second or two on 4G) must not read as a
            // finished booking — "REQUEST SENT" made members think they
            // were done and close the tab before the card page arrived.
            // This flag swaps that interim screen to "Taking you to
            // payment…", and it doubles as the fallback screen if the
            // navigation is ever blocked.
            redirecting: Boolean(payUrl),
            // Step 11: a guest has no login, so this token is their ONLY way
            // back to their own booking to cancel it. Kept in state so the
            // confirmation screen can hand it over — if it is lost here it
            // cannot be recovered without an admin.
            manageToken: data.manage_token || null,
          })
          setActive(null)
          setBusy(false)
          // Straight to the card page. setDone has already run, so if this
          // navigation is blocked the confirmation + pay button render as
          // the fallback instead of a dead end.
          if (payUrl) window.location.assign(payUrl)
          return
        } else {
          // A refusal. Each reason gets its own sentence because each has a
          // different thing the member can do about it.
          const seats = data?.seats_left
          if (data?.reason === 'full' || data?.reason === 'not_enough_seats') {
            // Not a dead end — Step W1. The offer is rendered as a button
            // rather than auto-joining, because a waiting list is a
            // commitment and nobody should be signed up to one by a click
            // they made on something else.
            setWaitOffer({
              reason: data.reason,
              seatsLeft: seats ?? 0,
              className: data.class_name || active.title,
            })
            setFormErr('')
          } else {
            setFormErr(refusalMessage(data?.reason))
          }
          setBusy(false)
          return
        }
      } catch {
        // A thrown fetch (host down mid-request) is the same infrastructure
        // state as PGRST202 above, and gets the same honest refusal.
        bookingUnavailable()
        return
      }
      return
    }

    // Supabase was never configured on this deployment: there is nothing to
    // save a booking INTO, so there is nothing to confirm and nothing to
    // charge for. (An earlier version ran a real Square checkout from here,
    // keyed on a browser-minted UUID — money taken for a seat that existed
    // in no system. That is the exact bug this function's one rule forbids.)
    bookingUnavailable()
  }

  return (
    <div className="bk">
      <style>{BOOK_CSS}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bk__hero">
        <Link to="/" className="bk__lockup" aria-label={`${tenant.name} — back to home`}>
          {/* Dark hero (#141414) → white wordmark. alt="" — the Link above
              already announces the club and the destination. */}
          <BrandLogo on="dark" height={24} alt="">
            <span className="bk__mark">{tenant.mark}</span>
            <span className="bk__wordmark">{tenant.name}</span>
          </BrandLogo>
        </Link>
        <p className="bk__eyebrow">The Hub</p>
        <h1 className="bk__title">Class timetable</h1>
        <p className="bk__lede">
          Every class at the Hub, every week. Drop in, book a space, and bring
          someone with you. Everyone welcome.
        </p>
      </header>

      <main className="bk__wrap">
        {done ? (
          <div className="bk__panel bk__panel--done" role="status">
            <CheckCircle2 size={38} className="bk__doneIcon" aria-hidden="true" />
            <h2 className="bk__doneTitle">
              {/* No "Request sent." fallback any more: every state that can
                  reach this panel is a saved booking, a saved waitlist place,
                  or a completed payment. The optimistic unsaved state was
                  removed with the offline fallback (QA, Oct 2026). */}
              {done.paidReturn
                ? 'Payment received.'
                : done.redirecting
                  ? 'Taking you to payment\u2026'
                  : done.waitlisted
                    ? "You're on the list."
                    : "You're booked in."}
            </h2>
            <p className="bk__doneBody">
              {done.redirecting ? (
                <>
                  We&rsquo;ve got your name down for <strong>{done.title}</strong> &mdash;
                  your space is secured once your payment goes through. Square&rsquo;s
                  secure card page is loading now.
                </>
              ) : done.paidReturn ? (
                <>
                  Your payment has gone through &mdash; that&rsquo;s everything done.
                  A coach will check you in on the day. See you there.
                </>
              ) : done.waitlisted ? (
                <>
                  You&rsquo;re{' '}
                  {done.position
                    // The position is the whole reason to say anything at all.
                    // "You're on a waiting list" is worrying; "you're next"
                    // is information someone can plan an evening around.
                    ? <>number <strong>{done.position}</strong> on the waiting list</>
                    : <>on the waiting list</>}{' '}
                  for <strong>{done.title}</strong>. If a place comes up
                  we&rsquo;ll email you — you&rsquo;ll have 12 hours to take it
                  before it passes to the next person.
                </>
              ) : (
                <>
                  {done.places > 1 ? (
                    <><strong>{done.places} spaces</strong> for <strong>{done.title}</strong> are reserved.</>
                  ) : (
                    <>Your space for <strong>{done.title}</strong> is reserved.</>
                  )}{' '}
                  See you there.
                </>
              )}
            </p>
            {/* What they owe and how, restated after booking. The member has
                just chosen a payment method three screens up; repeating it
                here is what stops "I thought I'd already paid" at the door. */}
            {done.total > 0 && (
              <p className="bk__donePay">
                {done.payMethod === 'online' ? (
                  done.payUrl ? (
                    <>
                      <strong>{fmtPrice(done.total)}</strong> to pay — taking you to
                      secure checkout. If nothing happens, use the button below.
                    </>
                  ) : (
                    <>
                      <strong>{fmtPrice(done.total)}</strong> to pay — the club will send
                      you a payment link.
                    </>
                  )
                ) : (
                  <>
                    <strong>{fmtPrice(done.total)}</strong> to pay on arrival.
                  </>
                )}
              </p>
            )}

            {/* Square-hosted payment page. This screen is normally never
                seen — submit() navigates straight to Square — so this
                button is the fallback for a blocked navigation. New tab
                here, deliberately: by the time someone is reading this,
                the auto-redirect has already failed once in this tab, and
                this confirmation still carries the manage-booking token
                below, shown exactly once. */}
            {done.payUrl && (
              <a
                className="bk__btn bk__btn--primary"
                href={done.payUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pay {fmtPrice(done.total)} now — secure checkout
              </a>
            )}

            {/* ── Step 11: how a GUEST cancels ─────────────────────────
                A member can cancel from their dashboard. A guest has no
                login at all, so this token is the only thing that proves
                the booking is theirs — and it is returned exactly once, on
                this screen. If it is not shown here it is unrecoverable
                without an admin, and the club gets a phone call instead of
                a freed place.

                Shown as a link rather than a bare token so it survives
                being copied into a notes app or sent to themselves.

                The link is its OWN block below the sentence, not a phrase
                inside it. Inline it measured 83×19px — a third of the 44px
                minimum, on a phone, for the one control that decides whether a
                place gets freed or silently held. Sentences also wrap: mid-copy
                the target can break across two lines and each half becomes
                smaller still. Out here it is a fixed 44px row that cannot be
                missed and cannot be split. */}
            {done.manageToken && (
              <>
                <p className="bk__doneManage">
                  Need to cancel later? Keep the link below — it&rsquo;s the only
                  way back to this booking without an account, and cancelling
                  frees your space for someone else straight away.
                </p>
                <Link
                  to={`/booking/${done.manageToken}`}
                  className="bk__doneLink"
                >
                  Manage this booking
                </Link>
              </>
            )}

            <button className="bk__btn bk__btn--ghost" onClick={() => setDone(null)}>
              Back to the timetable
            </button>
          </div>
        ) : active ? (
          // ── Booking form ───────────────────────────────────────
          <div className="bk__panel">
            <p className="bk__eyebrow bk__eyebrow--dark">You&rsquo;re booking</p>
            <h2 className="bk__formTitle">{active.title}</h2>
            {/* `when` is only present on cards that came from upcomingClasses().
                A class picked out of the weekly grid has none, so it must be
                computed — falling back to `new Date()` would confidently
                print "Today" for Thursday's Yoga booked on a Monday. */}
            <p className="bk__formMeta">
              {relativeDay(active.when || nextOccurrence(active, now), now)} · {formatTime(active.time)}
              {active.coach ? ` · with ${active.coach}` : ''}
            </p>

            {active.femaleOnly && (
              <p className="bk__flag">
                <Lock size={13} aria-hidden="true" /> This class is female only.
              </p>
            )}

            {formErr && <div className="bk__err" role="alert">{formErr}</div>}

            <form onSubmit={submitBooking} className="bk__form">
              <div className="bk__field">
                <label htmlFor="bk-name">Full name</label>
                <input
                  id="bk-name" className="bk__input" value={fullName} required
                  autoComplete="name" placeholder="e.g. Amara Okoye"
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="bk__field">
                <label htmlFor="bk-email">Email <span className="bk__opt">optional</span></label>
                <input
                  id="bk-email" type="email" className="bk__input" value={email}
                  autoComplete="email" placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="bk__field">
                <label htmlFor="bk-phone">Phone <span className="bk__opt">optional</span></label>
                <input
                  id="bk-phone" type="tel" className="bk__input" value={phone}
                  autoComplete="tel" placeholder="07700 900123"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* ── Step 4b: who is this for? ──────────────────────
                  A radiogroup, not a <select>: three options is below the
                  threshold where a dropdown earns its extra click, and the
                  choice changes what the rest of the form asks for, so it
                  needs to be visible rather than collapsed. */}
              <fieldset className="bk__fieldset">
                <legend className="bk__legend">Who&rsquo;s coming?</legend>
                <div className="bk__choices">
                  {[
                    { v: 'me', label: 'Just me' },
                    { v: 'someone_else', label: 'Someone else' },
                    { v: 'group', label: 'A group' },
                  ].map((o) => (
                    <label
                      key={o.v}
                      className={`bk__choice${bookedFor === o.v ? ' bk__choice--on' : ''}`}
                    >
                      <input
                        type="radio" name="bk-for" value={o.v}
                        checked={bookedFor === o.v}
                        onChange={() => {
                          setBookedFor(o.v)
                          // Places belongs to 'group' alone. Leaving a stale 5
                          // behind when someone switches back to "Just me"
                          // would book five seats for one person.
                          setPlaces(o.v === 'group' ? Math.max(2, places) : 1)
                        }}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {bookedFor === 'someone_else' && (
                <div className="bk__field">
                  <label htmlFor="bk-attendee">Their name</label>
                  <input
                    id="bk-attendee" className="bk__input" value={attendeeName}
                    placeholder="Who should the coach expect?"
                    onChange={(e) => setAttendeeName(e.target.value)}
                  />
                </div>
              )}

              {bookedFor === 'group' && (
                <div className="bk__field">
                  <label htmlFor="bk-places">How many spaces, including you?</label>
                  <input
                    id="bk-places" type="number" min="2" max="20" inputMode="numeric"
                    className="bk__input bk__input--num" value={places}
                    onChange={(e) => setPlaces(Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
                  />
                  {/* The group's own name for itself, exactly as the coach's
                      register will show it (your "Sarah + 4" rule). Shown back
                      before booking so the member can catch a wrong number
                      here rather than at the door. */}
                  <p className="bk__hint">
                    The register will read{' '}
                    <strong>{(fullName.trim() || 'You')} + {places - 1}</strong>, and{' '}
                    {places} of the {active.capacity || 40} spaces will be taken.
                  </p>
                </div>
              )}

              {/* ── Payment ────────────────────────────────────────
                  Total is computed, never typed: places × class price. */}
              <fieldset className="bk__fieldset">
                <legend className="bk__legend">Payment</legend>
                <div className="bk__choices">
                  <label className={`bk__choice${payMethod === 'on_arrival' ? ' bk__choice--on' : ''}`}>
                    <input
                      type="radio" name="bk-pay" value="on_arrival"
                      checked={payMethod === 'on_arrival'}
                      onChange={() => setPayMethod('on_arrival')}
                    />
                    Pay on arrival
                  </label>
                  {/* Hidden entirely — not disabled — on an arrival-only
                      class: a greyed "Pay online" reads as "broken", while
                      its absence reads as "this class is paid at the door",
                      which is the truth. payMethod cannot become 'online'
                      here because startBooking resets it per class and this
                      is the only control that sets it. */}
                  {!isArrivalOnly(active) && (
                    <label className={`bk__choice${payMethod === 'online' ? ' bk__choice--on' : ''}`}>
                      <input
                        type="radio" name="bk-pay" value="online"
                        checked={payMethod === 'online'}
                        onChange={() => setPayMethod('online')}
                      />
                      Pay online
                    </label>
                  )}
                </div>

                {isArrivalOnly(active) && (
                  <p className="bk__hint">
                    This class is pay on arrival — bring card or cash on the
                    day and pay {active.coach ? active.coach : 'the coach'} at
                    the door.
                  </p>
                )}

                <p className="bk__total">
                  <span>{places} × {fmtPrice(priceOf(active))}</span>
                  <strong>{fmtPrice(priceOf(active) * places)}</strong>
                </p>

                {/* Sets the expectation for the next screen: the space is
                    held first, THEN they pay on Square's page. Without this
                    line, landing back on a confirmation with a pay button
                    reads as "did my booking even work?". */}
                {payMethod === 'online' && (
                  <p className="bk__hint">
                    Your space is reserved first — then pay securely by card
                    on the confirmation screen.
                  </p>
                )}
              </fieldset>

              {/* ── Step W1: the class was full ──────────────────────
                  Shown in place of the error line, not next to it. A red
                  "sorry, full" plus a green "join the list" button is two
                  conflicting instructions; this is one panel that says what
                  happened and offers the single thing worth doing next.

                  `not_enough_seats` is separated out because it is usually
                  NOT a full class — it is a group of 5 asking for a room
                  with 2 left. Telling that member the class is full sends
                  them away when three of them could still come. */}
              {waitOffer && (
                <div className="bk__waitOffer" role="alert">
                  {waitOffer.reason === 'not_enough_seats' ? (
                    <>
                      <p className="bk__waitTitle">
                        Only {waitOffer.seatsLeft}{' '}
                        {waitOffer.seatsLeft === 1 ? 'space' : 'spaces'} left
                      </p>
                      <p className="bk__waitBody">
                        You asked for {places}. You can lower the number of
                        spaces above and book now, or join the waiting list for
                        all {places}.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="bk__waitTitle">This one is full</p>
                      <p className="bk__waitBody">
                        Join the waiting list and you&rsquo;ll be first to know
                        if someone cancels. Nothing to pay unless a place comes
                        up and you take it.
                      </p>
                    </>
                  )}
                  <button type="button" className="bk__btn bk__btn--primary"
                    onClick={joinWaitlist} disabled={busy}>
                    {busy ? 'Just a second…' : 'Join the waiting list'}
                  </button>
                </div>
              )}

              <div className="bk__actions">
                <button type="button" className="bk__btn bk__btn--ghost"
                  onClick={() => setActive(null)} disabled={busy}>
                  Back
                </button>
                <button type="submit" className="bk__btn bk__btn--primary" disabled={busy}>
                  {busy
                    ? 'Just a second…'
                    : waitOffer
                      // After a refusal the member has usually changed
                      // something (fewer spaces), so "Try again" describes
                      // what the button now does. "Book my space" would
                      // suggest the first attempt had not happened.
                      ? <>Try again <ArrowRight size={15} /></>
                      : <>Book my space <ArrowRight size={15} /></>}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* ── Up next ─────────────────────────────────────────
                A timetable answers "when is Yoga?". This answers "what
                can I get to today?" — which is the question someone
                arriving from a Book-a-Class button is actually asking. */}
            <section className="bk__next" aria-labelledby="bk-next-h">
              <h2 id="bk-next-h" className="bk__sectionTitle">Up next</h2>
              <div className="bk__nextGrid">
                {next.map((cls) => (
                  <button key={cls.id} className="bk__nextCard" onClick={() => startBooking(cls)}>
                    <span className="bk__nextWhen">{relativeDay(cls.when, now)}</span>
                    <span className="bk__nextTime">{formatTime(cls.time)}</span>
                    <span className="bk__nextTitle">{cls.title}</span>
                    {cls.coach && <span className="bk__nextCoach">with {cls.coach}</span>}
                  </button>
                ))}
              </div>
            </section>

            {/* ── The week, as a calendar of cards ─────────────────
                Days are BANDS, not columns. Seven columns across an
                editorial 720px column gives each day ~88px, which is
                narrower than the word "Kettlebells" — a real month grid
                would also be ~97% empty squares, since the club runs one
                or two classes a day. Dated bands carry the same "where am
                I in the week" orientation with none of the emptiness. */}
            <section aria-labelledby="bk-week-h">
              <h2 id="bk-week-h" className="bk__sectionTitle">
                <CalendarDays size={13} aria-hidden="true" /> This week at the Hub
              </h2>

              {week.map((group) => (
                <div key={group.day} className="bk__day">
                  <h3 className="bk__dayName">
                    <span>{group.name}</span>
                    <span className="bk__dayCount">
                      {group.classes.length} {group.classes.length === 1 ? 'class' : 'classes'}
                    </span>
                  </h3>

                  <div className="bk__cards">
                    {group.classes.map((cls) => {
                      const avail = classAvailability(cls)
                      const open = openId === cls.id
                      const panelId = `bk-panel-${cls.id}`

                      // The database half. Undefined until (and unless) the
                      // SQL has been run — every read below tolerates that.
                      const db = classesBySlug?.[cls.dbSlug]
                      const coach = mergeCoach(cls, db, coachBySlug, bioByName)
                      const rating = ratingCopy(db?.rating_avg, db?.rating_count)
                      const video = videoEmbed(db?.video_url)

                      // `??` not `||`: price_pennies of 0 means the club has
                      // deliberately made this class free, and `||` would treat
                      // that real decision as "unset" and overwrite it with the
                      // placeholder. Only a genuine null/undefined falls back.
                      const price = db?.price_pennies ?? HUB_PLACEHOLDER_PRICE_PENNIES

                      // This card's own next date. "Today"/"Tomorrow" beats a
                      // numeral when it applies; otherwise the numeral, which
                      // is the half the band heading cannot tell you.
                      //
                      // Suppressed entirely for a paused class: "Tuesday 5am,
                      // 6 Oct, starting back next week" states a date for a
                      // session nobody has said will run.
                      const when = nextOccurrence(cls, now)
                      const rel = relativeDay(when, now)
                      const soon = rel === 'Today' || rel === 'Tomorrow' ? rel : null

                      // ── The photo band (step 2 card artwork) ──────────
                      // Per-class image beats the discipline default, which is
                      // the whole reason the default exists: four files cover
                      // twelve classes, and any one class can be given its own
                      // without disturbing the other eleven.
                      //
                      // `imageSrc` is applied to the DATABASE value only. The
                      // bundled default has already been resolved by Vite from
                      // a file on disk, so putting it through a URL parser
                      // would reject it — build output is a path
                      // ('/assets/hiit-a1b2c3.webp'), not an absolute URL.
                      const art = (() => {
                        const own = imageSrc(db?.image_url)
                        if (own && !badArt.has(own)) return own
                        const fallback = DISCIPLINE_IMAGE[cls.discipline]
                        return fallback && !badArt.has(fallback) ? fallback : null
                      })()

                      return [
                        <article
                          key={cls.id}
                          className={`bk__card${art ? ' bk__card--art' : ''}${cls.paused ? ' bk__card--off' : ''}${open ? ' bk__card--open' : ''}`}
                        >
                          {/* The photo fills the WHOLE card, behind the text.
                              It began life as a strip across the top, because
                              every string on this card — time, class name,
                              coach, price, the Book button — was contrast-
                              measured against a solid --surface, and putting a
                              photo behind them would have made each of those
                              measurements a function of whichever pixels the
                              club happened to export. Readability would have
                              stopped being a property of the code.

                              A full-bleed photo is the better card, so the
                              guarantee is rebuilt rather than dropped: the
                              image never touches the text directly. A fixed
                              dark scrim sits between them (.bk__art::after),
                              deep enough that even a pure-white photo composites
                              to ~5:1 against the white type. The contrast floor
                              is therefore still set here, not by the club's
                              photographer — it just costs a layer now instead
                              of costing the artwork.

                              Rendered only when there is a real image. The
                              eleven cards without one keep the original light
                              treatment untouched; a grey placeholder behind
                              them would not read as "no photo yet", it would
                              read as broken.

                              aria-hidden because it is decoration with no
                              information in it — the class name, time and coach
                              are all real text on top. */}
                          {art && (
                            <div className="bk__art" aria-hidden="true">
                              <img
                                src={art}
                                /* Decorative, so alt is EMPTY — not missing.
                                   The class name, time and coach are all real
                                   text immediately below; alt="Hot Kettlebells"
                                   would make a screen reader announce the name
                                   twice, and the second time as an image. An
                                   absent alt is different again: that makes
                                   the reader fall back to reading the
                                   filename out. */
                                alt=""
                                /* Twelve cards, most of them below the fold on
                                   a phone. Lazy is the difference between the
                                   timetable appearing and the timetable
                                   appearing after twelve images.

                                   It is also the whole of the "the Yoga picture
                                   is missing" report: the Thursday card is a
                                   long way down /book, so the file is not
                                   fetched until it is scrolled to. That is the
                                   feature working. */
                                loading="lazy"
                                decoding="async"
                                /* Intrinsic size as METADATA, not as a
                                   layout-shift fix — this image is absolutely
                                   positioned and fills a box the card's own
                                   content has already sized, so it cannot shift
                                   anything whether the bytes arrive or not.

                                   Stated anyway because it is the ratio the
                                   artwork is specified at (16:9), so a file
                                   that does not match shows up in devtools
                                   rather than just looking subtly wrong. */
                                width="390"
                                height="220"
                                /* undefined, not 'center', when the club has
                                   not set a focus — so the surface's own CSS
                                   default applies. A card background and the
                                   11:3 banner on the class page want different
                                   defaults from the same file, and an inline
                                   'center' would win over both. */
                                style={{ objectPosition: imageFocus(db?.image_focus) || undefined }}
                                onError={() => markBadArt(art)}
                              />
                            </div>
                          )}

                          {/* The toggle is a button INSIDE the card, not the
                              card itself. "Book" has to be a button too, and
                              a button inside a button is invalid HTML that
                              browsers resolve by dropping one of them. */}
                          <button
                            className="bk__cardBtn"
                            aria-expanded={open}
                            aria-controls={panelId}
                            onClick={() => setOpenId(open ? null : cls.id)}
                          >
                            <span className="bk__cardTop">
                              {/* Time leads. On a timetable it is the thing
                                  people scan for — so it gets the display
                                  face and the tabular figures. */}
                              <span className="bk__time">{formatTime(cls.time)}</span>
                              {!cls.paused &&
                                (soon ? (
                                  <span className="bk__soon">{soon}</span>
                                ) : (
                                  <span className="bk__date">{fmtDayNum(when)}</span>
                                ))}
                            </span>

                            <span className="bk__name">
                              {cls.title}
                              {cls.subtitle && <span className="bk__sub"> ({cls.subtitle})</span>}
                            </span>

                            <span className="bk__meta">
                              {coach && (
                                <span className="bk__metaItem">
                                  <User size={12} aria-hidden="true" />with {coach.name}
                                </span>
                              )}
                              {rating && (
                                <span className="bk__metaItem bk__stars">
                                  <Star size={12} aria-hidden="true" fill="currentColor" />
                                  {rating.avg.toFixed(1)}
                                </span>
                              )}
                              {/* Price on the CARD, not only inside the panel.
                                  Someone scanning the week for a class they can
                                  afford should not have to open twelve panels to
                                  compare. Suppressed on a paused class, which
                                  cannot be bought at any price. */}
                              {!cls.paused && (
                                <span className="bk__metaItem bk__price">
                                  {fmtPrice(price)}
                                </span>
                              )}
                            </span>

                            <span className="bk__tags">
                              {cls.femaleOnly && <span className="bk__tag">Female only</span>}
                              {cls.paused && avail.note && (
                                <span className="bk__tag bk__tag--off">{avail.note}</span>
                              )}
                            </span>

                            <span className="bk__more">
                              {open ? 'Hide details' : 'Class details'}
                              <ChevronDown size={14} aria-hidden="true" className="bk__chev" />
                            </span>
                          </button>

                          {avail.bookable ? (
                            <button className="bk__book" onClick={() => startBooking(cls)}>
                              Book
                            </button>
                          ) : (
                            <span className="bk__book bk__book--off" aria-disabled="true">
                              {avail.label}
                            </span>
                          )}
                        </article>,

                        // ── The panel, opening in place ──────────────
                        // A sibling of the card spanning the whole band
                        // rather than a child of it: nested inside a
                        // ~230px card the coach photo, bio and a 16:9
                        // video would each get a third of the width they
                        // need. Full-bleed within the day keeps the
                        // expansion "in place" while giving it room.
                        open ? (
                          <div key={panelId} id={panelId} className="bk__panelOut">
                            {/* Falls back to placeholder copy, so the panel is
                                never an empty box with a Book button in it. The
                                database wins the moment a coach writes a real
                                description. classCopy() describes what a
                                kettlebell class IS and makes no claim about this
                                club — and only when the class NAME backs the
                                discipline tag up. */}
                            {(db?.description || classCopy(cls)) && (
                              <p className="bk__desc">
                                {db?.description || classCopy(cls)}
                              </p>
                            )}

                            {coach && (
                              <div className="bk__coach">
                                {coach.photo ? (
                                  <img
                                    className="bk__avatar"
                                    src={coach.photo}
                                    alt={`${coach.name}, coach at ${tenant.name}`}
                                    loading="lazy"
                                  />
                                ) : (
                                  // Initials, not a silhouette placeholder.
                                  // A generic head icon reads as "photo
                                  // missing"; initials read as a person.
                                  <span className="bk__avatar bk__avatar--initials" aria-hidden="true">
                                    {initialsOf(coach.name)}
                                  </span>
                                )}

                                <div className="bk__coachBody">
                                  <p className="bk__coachName">{coach.name}</p>
                                  {coach.credentials && (
                                    <p className="bk__coachCred">{coach.credentials}</p>
                                  )}
                                  {coach.bio && (
                                    <>
                                      <p className="bk__coachLabel">
                                        {coach.written ? `About ${coach.name}` : 'On the timetable'}
                                      </p>
                                      <p className="bk__coachBio">{coach.bio}</p>
                                    </>
                                  )}
                                  {coach.href && (
                                    <Link className="bk__coachLink" to={coach.href}>
                                      More about {coach.name} <ArrowRight size={13} />
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}

                            {video && (
                              <figure className="bk__video">
                                <iframe
                                  src={video.src}
                                  title={`${cls.title} at ${tenant.name}`}
                                  loading="lazy"
                                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                                {db?.video_caption && (
                                  <figcaption>{db.video_caption}</figcaption>
                                )}
                              </figure>
                            )}

                            {/* The price fact no longer waits for the database.
                                `price` already resolved to a real figure above,
                                so this list always has at least one row and the
                                panel never opens on a class whose cost is a
                                mystery right up until the booking form. */}
                            <ul className="bk__facts">
                              {db?.location && (
                                <li><MapPin size={13} aria-hidden="true" />{db.location}</li>
                              )}
                              <li><Ticket size={13} aria-hidden="true" />{fmtPrice(price)}</li>
                              {rating && (
                                <li className="bk__stars">
                                  <Star size={13} aria-hidden="true" fill="currentColor" />
                                  {rating.label}
                                </li>
                              )}
                            </ul>

                            {/* ── The route to the class's own page ────
                                Until now there was no link from the timetable
                                to /c/:slug anywhere in the app. Choosing to
                                open details in place removed the need for one
                                to read the detail — but not the need for the
                                link itself, because the class page is the thing
                                that gets pasted into the group chat, and a URL
                                nobody can reach without typing it is not a
                                shareable link.

                                Secondary to Book, and after it. Someone with
                                the panel open has already read the detail; the
                                page is for sending to someone who hasn't. */}
                            <div className="bk__panelActions">
                              {avail.bookable && (
                                <button
                                  className="bk__btn bk__btn--primary bk__panelBook"
                                  onClick={() => startBooking(cls)}
                                >
                                  Book {cls.title} <ArrowRight size={15} />
                                </button>
                              )}
                              {/* Names the class, so the link still makes sense
                                  read out of context — twelve panels otherwise
                                  give a screen reader twelve identical "Class
                                  page" links with no way to tell them apart. */}
                              <Link className="bk__panelPage" to={`/c/${cls.dbSlug}`}>
                                <LinkIcon size={13} aria-hidden="true" />
                                {cls.title} page
                              </Link>
                            </div>
                          </div>
                        ) : null,
                      ]
                    })}
                  </div>
                </div>
              ))}
            </section>

            <p className="bk__footnote">
              <MessageCircle size={14} aria-hidden="true" />
              {HUB_FOOTNOTE}
            </p>
          </>
        )}

        <p className="bk__links">
          {!user && (
            <>
              <Link to="/join">Join the community</Link>
              {' · '}
            </>
          )}
          <Link to="/">&larr; Back to home</Link>
        </p>
      </main>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────
// Scoped to .bk and kept beside the markup because this is a standalone
// public page with a look of its own — an editorial timetable, not an app
// screen. Tokens come from theme.css so it stays on-brand.
const BOOK_CSS = `
.bk {
  --bk-line: color-mix(in srgb, var(--ink) 12%, transparent);
  --bk-line-soft: color-mix(in srgb, var(--ink) 7%, transparent);
  /* svh = the height with the phone's address bar SHOWING. 100vh is the
     height with it hidden, i.e. the largest the viewport ever gets — so it
     guarantees a shell taller than the screen and a phantom scroll on a short
     timetable. vh first as the fallback for anything pre-2022. */
  min-height: 100vh;
  min-height: 100svh;
  background: var(--bg);
  color: var(--ink);
  padding-bottom: 64px;
}

/* Hero — the one dark slab on the page, echoing the sidebar and the coach
   application form so the club reads as one system. */
.bk__hero {
  background: var(--sidebar-bg, #141414);
  color: #fff;
  padding: 40px 24px 48px;
  text-align: center;
  position: relative;
}
.bk__hero::after {
  content: '';
  position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  background: var(--accent);
}
.bk__lockup {
  display: inline-flex; align-items: center; gap: 10px;
  text-decoration: none; color: #fff; margin-bottom: 28px;
  min-height: 44px;
  transition: opacity 200ms ease;
}
.bk__lockup:hover { opacity: 0.72; }
.bk__mark {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--accent); color: #fff;
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 700; font-size: 15px;
}
.bk__wordmark {
  font-family: var(--font-display); font-weight: 700;
  font-size: 14px; text-transform: uppercase; letter-spacing: 0.14em;
}
.bk__eyebrow {
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.18em;
  color: color-mix(in srgb, #fff 62%, transparent);
  margin: 0 0 10px;
}
.bk__eyebrow--dark { color: var(--muted); }
.bk__title {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(30px, 7vw, 46px); line-height: 1.05;
  text-transform: uppercase; letter-spacing: 0.01em;
  margin: 0 0 16px;
  /* Stated, not inherited. app.css sets color: var(--ink) directly on h1 for
     the light pages, and a declaration on the element always beats a value
     inherited from .bk__hero - inheritance only fills a gap, it never competes
     on specificity. Without this line the largest type on the page renders
     #1c1c1c on a #141414 hero: 1.08:1. Present, selectable, invisible. */
  color: #fff;
}
.bk__lede {
  font-size: 15px; line-height: 1.65;
  color: color-mix(in srgb, #fff 74%, transparent);
  max-width: 46ch; margin: 0 auto;
}

.bk__wrap { max-width: 720px; margin: 0 auto; padding: 0 24px; }

.bk__sectionTitle {
  font-family: var(--font-display); font-weight: 600;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em;
  color: var(--muted);
  margin: 40px 0 16px;
}

/* Up next — three cards, time-forward. */
.bk__nextGrid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.bk__nextCard {
  display: flex; flex-direction: column; gap: 2px;
  text-align: left; cursor: pointer;
  background: var(--sidebar-bg, #141414); color: #fff;
  border: 0; border-radius: 14px; padding: 18px 16px;
  min-height: 44px;
  transition: transform 200ms ease, opacity 200ms ease;
}
.bk__nextCard:hover { transform: translateY(-2px); opacity: 0.92; }
.bk__nextWhen {
  font-family: var(--font-display); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.16em;
  color: color-mix(in srgb, #fff 58%, transparent);
}
.bk__nextTime {
  font-family: var(--font-display); font-weight: 700;
  font-size: 24px; line-height: 1.1; font-variant-numeric: tabular-nums;
  margin: 4px 0 2px;
}
.bk__nextTitle { font-size: 13px; font-weight: 600; line-height: 1.35; }
.bk__nextCoach {
  font-size: 12px;
  color: color-mix(in srgb, #fff 58%, transparent);
}

/* ── The week: dated bands of cards ────────────────────────────────── */
.bk__sectionTitle { display: flex; align-items: center; gap: 7px; }

.bk__day { margin-bottom: 24px; }
/* Date on the right, day name on the left, one rule under both. The heavy
   rule is what makes a band read as a calendar row rather than a list header. */
.bk__dayName {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  font-family: var(--font-display); font-weight: 700;
  font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--ink);
  margin: 0 0 12px; padding-bottom: 8px;
  border-bottom: 2px solid var(--ink);
}
/* --muted, not --faint. Measured: --faint (#949494) on the page background
   is 2.64:1 at 10.5px, well under AA's 4.5. --muted (#5c5c5c) is 6.69.
   --faint is a fine colour for 15px body text and fails on small caps — the
   smaller the type, the MORE contrast it needs, not less. */
.bk__dayCount {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em;
  color: var(--muted);
}

/* 260px, not 212px. At 212 the 720px column resolves to THREE tracks, and no
   day on this timetable has three classes — so every band ended with a hole
   and the one-class days left a card stranded at a third of the width. Two
   tracks fill Monday exactly and give a single Wednesday card half the band.
   It also buys "The Propain HIIT Class" enough width to sit on two lines. */
.bk__cards {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.bk__card {
  display: flex; flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--bk-line-soft); border-radius: 14px;
  padding: 16px 16px 14px;
  transition: border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.bk__card:hover {
  transform: translateY(-2px);
  border-color: var(--bk-line);
  box-shadow: 0 6px 20px -12px color-mix(in srgb, var(--ink) 40%, transparent);
}
/* Touch feedback, replacing the grey rectangle app.css turns off.
   Written HERE, immediately after :hover, because the two have identical
   specificity and a tap on a phone fires both — last one written wins, so the
   press state has to sit below the hover state to be seen at all.
   Coarse pointers only: a mouse already has :hover and does not need a press
   state on top of it. A scale rather than a colour, so it survives a re-skin
   and any photo the club puts behind the card. 110ms — a press response that
   takes 200ms reads as lag rather than as feedback. */
@media (hover: none) and (pointer: coarse) {
  .bk__card:active {
    transform: scale(0.985);
    transition-duration: 110ms;
  }
  .bk__card--off:active { transform: none; }
}
/* A paused class is de-emphasised in the COLOURS, not with opacity.
   It started as an opacity of 0.6, and that is a contrast bug wearing a
   style's clothes: opacity fades everything, including "Starting back next
   week" — the one line on that card anybody needs. Measured, the "Not
   running" label was ~2.2:1 through the fade, half the AA floor, on the exact
   string that stops a member turning up to a class that is not on.
   A flat card and a greyed time say "this one is off" just as plainly while
   every word stays at full strength. */
.bk__card--off { background: color-mix(in srgb, var(--ink) 4%, var(--surface)); }
.bk__card--off .bk__time,
.bk__card--off .bk__name { color: var(--muted); }
.bk__card--off:hover { transform: none; box-shadow: none; }
/* The open card keeps the accent so the eye can see WHICH card the panel
   below belongs to — without it, an expansion under a three-card row is
   orphaned from its trigger. */
.bk__card--open {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* ── The photo, filling the card ─────────────────────────────────────
   A layer pinned to all four edges, UNDER the text.

   Rounded here at 13px rather than by putting overflow:hidden on .bk__card.
   13 and not 14 because the card's 14px radius is measured on the OUTSIDE of
   its 1px border and this layer sits inside that border — matching the outer
   number leaves a hairline of white showing through each curve, the kind of
   thing nobody can name but everybody can see.

   Doing it locally also leaves the card's own overflow alone, which the
   expansion accent ring and the hover shadow both draw outside. */
.bk__art {
  position: absolute; inset: 0;
  border-radius: 13px;
  overflow: hidden;
  /* Under the text, and untouchable. Without pointer-events:none the layer
     would sit on top of the card's hit area and swallow the tap that opens
     the details panel. */
  z-index: 0; pointer-events: none;
  /* A tone, not white. The image is lazy, so for the moment before it lands
     this is what shows; a white box reads as a rendering fault where a deep
     tone reads as a photo about to arrive — and it matches where the scrim
     is about to take the card anyway, so nothing jumps when it does.
     Derived from --ink so it follows a re-skin rather than pinning a grey. */
  background: color-mix(in srgb, var(--ink) 82%, var(--surface));
}
.bk__art img {
  display: block;
  width: 100%; height: 100%;
  /* cover, so the card is always filled edge to edge. The artwork is 16:9 and
     the card is nearer 5:4, so the crop is horizontal — which is the good
     direction for a room full of people with their arms up: nothing is taken
     off the top. image_focus is there for the photo where that is not true. */
  object-fit: cover;
  /* Default focus when the club has not set one. Centre is right for a wide
     photo being narrowed; the class-page banner sets a different default for
     the same file, which is why this is CSS and not an inline attribute. */
  object-position: center;
}

/* ── The scrim: where the contrast guarantee lives ───────────────────
   The reason a photo can go behind the text at all.

   Sized from the worst case rather than from this one photo: a pure-white
   image. At 62% a #100f0e overlay composites white down to about #6d, which
   is ~5.1:1 against the white type — clear of the 4.5:1 AA floor for body
   text with room to spare, and that is the FLOOR, not the average. A dark
   photo simply lands further past it.

   It deepens toward the bottom because that is where the Book button and the
   availability line sit, and those are the two strings a member acts on.

   The pleasant side effect: the club's Yoga export is only 390px wide, which
   would be visibly soft blown up across a card. Under a scrim this deep it
   reads as atmosphere. Softness is forgiven in a way that a crisp strip of
   the same file never forgave it. */
.bk__art::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(
    180deg,
    rgba(16, 15, 14, 0.62) 0%,
    rgba(16, 15, 14, 0.72) 55%,
    rgba(16, 15, 14, 0.9) 100%
  );
}

/* With a photo behind it, the whole card flips to light-on-dark. Done by
   REDEFINING THE TOKENS on the card rather than by writing a --art variant of
   every rule below: .bk__time, .bk__name, .bk__meta, .bk__tag, .bk__more and
   .bk__book all already read from these, so one block moves all of them and
   nothing can be missed or drift later.
   --bg is here because .bk__book:hover inverts to "background: var(--ink);
   color: var(--bg)" — without it the hover state is white on white. */
.bk__card--art {
  position: relative;
  /* An explicit "color", not just the token below it, and the difference is
     easy to miss: .bk__name sets no colour of its own, so it INHERITS — and
     the colour it inherits was already resolved from var(--ink) further up, on
     .bk. Redefining a custom property only changes var() lookups made inside
     the subtree; it cannot retroactively change a value an ancestor already
     computed. Measured, the class name stayed rgb(28,28,28) on a dark card
     until this line existed. */
  color: var(--ink);
  --ink: #fff;
  --muted: rgba(255, 255, 255, 0.82);
  --accent-ink: #fff;
  --bg: #15130f;
  --bk-line: rgba(255, 255, 255, 0.5);
  --bk-line-soft: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.16);
}
/* Lifts the content off the photo layer. Stacking context only — the elements
   stay in the flex column exactly where they were.

   :not(.bk__art) is load-bearing, not tidiness. Without it this rule also
   matches the photo layer, which is a direct child too — and since both
   selectors carry the same specificity (one class), the later one wins and
   turns "position: absolute" into "position: relative". The photo then drops
   into the flex column as an ordinary block: a strip at the top of the card at
   its own height, with the scrim confined to it and white text landing on the
   bare white card below. Which is precisely what the first build of this
   looked like on screen. */
.bk__card--art > *:not(.bk__art) { position: relative; z-index: 1; }
/* The tag pill needs more body over a photo than over paper: 12% of the
   accent against a mid-tone image is invisible. */
.bk__card--art .bk__tag {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
/* A text shadow, only here. On a flat --surface it would be a smudge; over a
   photo it is what keeps a letter legible when it happens to land on the one
   bright patch the scrim was averaged across. */
.bk__card--art .bk__time,
.bk__card--art .bk__name {
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
}

/* A paused class greys its photo, for the same reason the card greys its time
   rather than fading the whole card: the artwork is the loudest thing on it,
   and a full-colour photo over "Not running" is a card that looks live.
   grayscale removes the colour without touching the contrast of anything. */
.bk__card--off .bk__art img { filter: grayscale(1); }
/* ...and the scrim goes further down, because a greyscale photo is exactly
   where a member is least likely to read the one line that matters. */
.bk__card--off .bk__art::after {
  background: linear-gradient(
    180deg,
    rgba(16, 15, 14, 0.74) 0%,
    rgba(16, 15, 14, 0.88) 100%
  );
}

.bk__cardBtn {
  display: flex; flex-direction: column; gap: 6px;
  text-align: left; cursor: pointer;
  background: none; border: 0; padding: 0; margin: 0 0 12px;
  color: inherit; font: inherit;
}
.bk__cardTop { display: flex; align-items: baseline; gap: 8px; }

/* Tabular figures so 5am / 9.30am / 10.45am align on the decimal — a
   timetable where the numbers do not line up looks broken. */
.bk__time {
  font-family: var(--font-display); font-weight: 700;
  font-size: 20px; line-height: 1.1; font-variant-numeric: tabular-nums;
  color: var(--accent-ink);
}
.bk__soon {
  font-family: var(--font-display); font-size: 9.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em;
  padding: 3px 6px; border-radius: 4px;
  background: var(--accent); color: #fff;
  margin-left: auto;
}
/* Pushed right so the times still align down the column: without this the
   date sits hard against a variable-width time and the eye loses the edge
   that tabular-nums exists to create. */
.bk__date {
  margin-left: auto;
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.bk__name { font-size: 15px; font-weight: 600; line-height: 1.35; }
.bk__sub { font-weight: 400; color: var(--muted); }
.bk__meta {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 12.5px; color: var(--muted);
}
.bk__metaItem { display: inline-flex; align-items: center; gap: 5px; }
.bk__stars { color: var(--accent-ink); font-variant-numeric: tabular-nums; }
.bk__tags { display: flex; gap: 6px; flex-wrap: wrap; }
.bk__tag {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; padding: 3px 7px; border-radius: 5px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-ink);
}
.bk__tag--off {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--muted);
}
.bk__more {
  display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--muted);
}
.bk__cardBtn:hover .bk__more { color: var(--ink); }
.bk__chev { transition: transform 240ms ease; }
.bk__card--open .bk__chev { transform: rotate(180deg); }

.bk__book {
  margin-top: auto; cursor: pointer; width: 100%;
  min-height: 44px; padding: 0 18px;
  border: 1px solid var(--ink); border-radius: 10px;
  background: transparent; color: var(--ink);
  font-family: var(--font-display); font-weight: 600; font-size: 13px;
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
.bk__book:hover { background: var(--ink); color: var(--bg); }
.bk__book--off {
  display: grid; place-items: center;
  cursor: default; border-color: var(--bk-line); color: var(--muted);
  font-size: 12px;
}
.bk__book--off:hover { background: transparent; color: var(--muted); }

/* ── The in-place panel ────────────────────────────────────────────── */
/* 1 / -1 spans the whole band whatever the column count resolved to, so the
   coach bio and a 16:9 video get the full editorial width instead of a
   212px card's worth. */
.bk__panelOut {
  grid-column: 1 / -1;
  background: color-mix(in srgb, var(--ink) 3.5%, transparent);
  border: 1px solid var(--bk-line-soft); border-radius: 14px;
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
  animation: bkOpen 240ms ease-out both;
}
@keyframes bkOpen {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: none; }
}
.bk__desc { margin: 0; font-size: 14px; line-height: 1.65; max-width: 62ch; }

.bk__coach { display: flex; gap: 14px; align-items: flex-start; }
.bk__avatar {
  width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
  object-fit: cover;
}
.bk__avatar--initials {
  display: grid; place-items: center;
  background: var(--sidebar-bg, #141414); color: #fff;
  font-family: var(--font-display); font-weight: 700; font-size: 17px;
  letter-spacing: 0.02em;
}
.bk__coachBody { min-width: 0; }
.bk__coachName {
  font-family: var(--font-display); font-weight: 700; font-size: 16px;
  margin: 0 0 2px;
}
.bk__coachCred { margin: 0 0 8px; font-size: 12.5px; color: var(--muted); }
.bk__coachLabel {
  font-family: var(--font-display); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--muted); margin: 0 0 4px;
}
.bk__coachBio {
  margin: 0; font-size: 13.5px; line-height: 1.65; max-width: 58ch;
  color: var(--ink);
}
.bk__coachLink {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 10px;
  min-height: 44px;
  font-family: var(--font-display); font-weight: 600; font-size: 13px;
  color: var(--accent-ink); text-decoration: none;
}
.bk__coachLink:hover { text-decoration: underline; }

/* aspect-ratio rather than a padding-top hack, so the frame reserves its
   height before the iframe loads — no layout shift as the player arrives. */
.bk__video { margin: 0; }
.bk__video iframe {
  width: 100%; aspect-ratio: 16 / 9; display: block;
  border: 0; border-radius: 12px;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.bk__video figcaption {
  margin-top: 8px; font-size: 12.5px; color: var(--muted);
}

.bk__facts {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: 8px 20px;
  font-size: 13px; color: var(--muted);
}
.bk__facts li { display: inline-flex; align-items: center; gap: 6px; }
/* align-self: flex-start is gone: it existed to stop the button stretching
   across the panel's flex COLUMN, and the button now lives inside
   .bk__panelActions, a row whose align-items already centres it. Leaving it in
   would top-align the button against a link that is vertically centred.
   (No backticks in here — this whole block is a JS template literal, and a
   backtick would end the string mid-stylesheet.) */
.bk__panelBook { flex: 0 0 auto; }

/* ── Panel actions row ──
   wrap, not nowrap: two long class titles ("Hot Kettlebells Book / page") in a
   narrow day column would otherwise squeeze the button until its own label
   wrapped mid-word. Cross-axis centre so the link's text baseline sits with the
   button's rather than with its top edge.
   min-height 44px on the link — it is a tap target on a phone, and a 13px line
   of text is about 18px of it. */
.bk__panelActions {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;
}
.bk__panelPage {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; padding: 0 2px;
  font-size: 13px; font-weight: 600;
  color: var(--accent-ink); text-decoration: none;
}
.bk__panelPage:hover { text-decoration: underline; }

.bk__footnote {
  display: flex; align-items: flex-start; gap: 9px;
  margin-top: 36px; padding: 16px 18px;
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 12px;
  font-size: 13.5px; line-height: 1.6; color: var(--accent-ink);
}
.bk__footnote svg { flex-shrink: 0; margin-top: 3px; }

/* Panels — booking form + confirmation */
.bk__panel {
  background: var(--surface); border: 1px solid var(--bk-line-soft);
  border-radius: 16px; padding: 28px; margin-top: 40px;
}
.bk__panel--done { text-align: center; }
.bk__doneIcon { color: var(--accent); margin-bottom: 10px; }
.bk__doneTitle {
  font-family: var(--font-display); font-weight: 700; font-size: 22px;
  text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 10px;
}
.bk__doneBody {
  font-size: 14.5px; line-height: 1.65; color: var(--muted);
  max-width: 44ch; margin: 0 auto 22px;
}
.bk__formTitle {
  font-family: var(--font-display); font-weight: 700; font-size: 24px;
  margin: 0 0 6px; line-height: 1.15;
}
.bk__formMeta { font-size: 13.5px; color: var(--muted); margin: 0 0 20px; }
.bk__flag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--accent-ink);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  padding: 7px 11px; border-radius: 8px; margin: 0 0 18px;
}
.bk__err {
  background: color-mix(in srgb, #dc2626 9%, transparent);
  color: #b91c1c; border-radius: 10px; padding: 12px 14px;
  font-size: 13.5px; margin-bottom: 18px;
}
.bk__field { margin-bottom: 16px; }
.bk__field label {
  display: block; font-family: var(--font-display); font-weight: 600;
  font-size: 13px; margin-bottom: 6px;
}
/* --muted, not --faint — the same measured failure as .bk__dayCount above,
   and for the same reason. --faint (#949494) on the form's surface is 3.03:1
   at 12px against AA's 4.5 minimum. It reads as "quietly secondary", which is
   exactly the intent, and that is the trap: "looks subtle" and "is readable"
   are judged by different faculties and only one of them can be measured.
   --muted (#5c5c5c) is still visibly lighter than the label it hangs off.

   Worth saying why this one matters more than a decorative label would: this
   is the word that tells someone they may leave the phone field blank. A
   member who cannot read it either abandons the form or invents a number. */
.bk__opt {
  font-family: var(--font-body); font-weight: 400;
  font-size: 12px; color: var(--muted); margin-left: 6px;
}
.bk__input {
  width: 100%; min-height: 46px; padding: 0 14px;
  border: 1px solid var(--line); border-radius: 10px;
  background: var(--surface); color: var(--ink);
  font-family: var(--font-body); font-size: 15px;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.bk__input:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
/* ── 16px on phones, and it has to be exactly 16 ──────────────────────
   iOS Safari zooms the entire page in the instant a field with a font
   SMALLER than 16px takes focus. Not a preference — a hard threshold in
   WebKit, and 15px is under it.

   What that does to this form specifically: it is the guest booking form, so
   the member is mid-checkout on a phone. The page scales up, the field they
   just tapped slides off to one side, and the layout stays zoomed for the
   rest of the form — including the Book button they now have to hunt for.
   Nothing recovers it but a manual pinch.

   app.css already carries this rule with the same 900px breakpoint, but it
   targets .input/.select/.textarea — the signed-in app's vocabulary. The
   public booking flow has its own, so it was never covered. That is the whole
   bug: the fix existed and this form was outside it.

   900px rather than 640px on purpose, matching app.css: the trigger is a
   touch keyboard, not a narrow screen, and a tablet in portrait has one. */
@media (max-width: 900px) {
  .bk__input { font-size: 16px; }
}
.bk__actions { display: flex; gap: 10px; margin-top: 22px; }
.bk__btn {
  min-height: 46px; padding: 0 20px; border-radius: 10px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  font-family: var(--font-display); font-weight: 600; font-size: 14px;
  transition: opacity 200ms ease, background-color 200ms ease;
}
.bk__btn--primary { flex: 1; border: 0; background: var(--accent); color: #fff; }
/* The "Pay now" control on the confirmation is an <a> (it navigates to
   Square's hosted page), not a <button>. Same box, minus the anchor
   defaults it would otherwise inherit. */
a.bk__btn { text-decoration: none; }
.bk__btn--primary:hover { opacity: 0.9; }
.bk__btn--primary:disabled { opacity: 0.55; cursor: default; }
.bk__btn--ghost { border: 1px solid var(--line); background: transparent; color: var(--ink); }
.bk__btn--ghost:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }

.bk__links {
  text-align: center; margin-top: 40px;
  font-size: 13.5px; color: var(--muted);
}
/* inline-flex + min-height so the footer links are a real 44px thumb target.
   Measured at 390px they were 19px tall — the text height, because an inline
   <a> has no box to give padding to. */
.bk__links a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
  color: var(--accent-ink); text-decoration: none;
}
.bk__links a:hover { text-decoration: underline; }

/* Focus — one visible ring everywhere, white on the dark hero. */
.bk :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
.bk__hero :focus-visible { outline-color: #fff; }
.bk ::selection { background: color-mix(in srgb, var(--accent) 25%, transparent); }

/* ── Mobile ─────────────────────────────────────────────────────────
   Not a shrink. Four real changes:
   1. "Up next" goes 3-up → 1-up. Three cards across 375px leaves ~105px
      each, which breaks "The Propain HIIT Class" onto five lines.
   2. The class cards go 1-up. auto-fill's 212px minimum would technically
      fit one column at 375px anyway, but it is stated so the intent
      survives anyone editing that minimum.
   3. The coach block stops being a horizontal row. A 52px avatar plus a
      14px gap is 66px off a 335px content width, and the bio underneath
      it wraps to ~30 characters a line.
   4. The panel's padding comes in, because at 375px a 20px inset on both
      sides plus the page's own 20px is a fifth of the screen in margins. */
@media (max-width: 640px) {
  .bk__hero { padding: 32px 20px 38px; }
  .bk__wrap { padding: 0 20px; }
  .bk__nextGrid { grid-template-columns: 1fr; }
  .bk__nextCard { flex-direction: row; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .bk__nextTime { font-size: 20px; margin: 0; }
  .bk__nextTitle { flex: 1; }

  .bk__cards { grid-template-columns: 1fr; }
  .bk__panelOut { padding: 16px; gap: 14px; }
  .bk__coach { flex-direction: column; gap: 10px; }
  /* The row becomes a stack and the button goes full width. align-self:
     stretch alone no longer does that — the actions row is a flex ROW now, so
     stretch would grow the button vertically instead of horizontally. The
     direction change is what makes stretch mean "full width" again. */
  .bk__panelActions { flex-direction: column; align-items: stretch; }
  .bk__panelBook { align-self: stretch; }
  /* Centred under the full-width button rather than hanging off the left. */
  .bk__panelPage { justify-content: center; }
  .bk__panel { padding: 22px 18px; }
  .bk__actions { flex-direction: column-reverse; }
  .bk__btn { width: 100%; }
}

/* ── Price, Step 4b and payment ─────────────────────────────────────
   The price sits in the card meta row next to the coach and the stars, so
   it takes the same muted treatment rather than shouting: a member scanning
   the week is comparing times first and cost second. */
.bk__price { font-variant-numeric: tabular-nums; font-weight: 600; }

.bk__fieldset { border: 0; padding: 0; margin: 0 0 16px; min-width: 0; }
.bk__legend {
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted); padding: 0; margin-bottom: 8px;
}
.bk__choices { display: flex; flex-wrap: wrap; gap: 8px; }
/* The whole pill is the label, so the tap target is the visible shape
   rather than a 13px radio dot sitting next to it. */
.bk__choice {
  display: inline-flex; align-items: center; gap: 7px;
  min-height: 44px; padding: 0 14px;
  border: 1px solid var(--line, #dcdcdc); border-radius: 10px;
  background: #fff; cursor: pointer; font-size: 14px;
  transition: border-color 200ms ease, background-color 200ms ease;
}
.bk__choice:hover { border-color: var(--accent); }
.bk__choice--on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, #fff);
  font-weight: 600;
}
.bk__choice input { accent-color: var(--accent); width: 15px; height: 15px; }

.bk__input--num { max-width: 110px; }

.bk__hint {
  margin: 8px 0 0; font-size: 13px; line-height: 1.55; color: var(--muted);
}
.bk__hint--warn {
  padding: 9px 11px; border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 7%, #fff);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  color: var(--ink);
}

/* Total as a two-column row: the sum reads as an answer to the line above
   it, not as another form field. */
.bk__total {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 12px; margin: 12px 0 0; padding-top: 12px;
  border-top: 1px solid var(--line, #dcdcdc);
  font-size: 14px; color: var(--muted);
}
.bk__total strong {
  font-family: var(--font-display); font-size: 20px;
  font-variant-numeric: tabular-nums; color: var(--ink);
}

.bk__donePay {
  margin: 0 0 18px; font-size: 15px; line-height: 1.6;
  font-variant-numeric: tabular-nums;
}

/* The guest's cancel link. Quieter than the body copy on purpose — it is
   important but it is not the news, and setting it at the same weight as
   "You're booked in" makes the screen read as two headlines. */
.bk__doneManage {
  margin: 0 0 12px;
  font-size: 13.5px; line-height: 1.65;
  max-width: 46ch;
  color: color-mix(in srgb, var(--ink) 66%, transparent);
}
/* A block-level row, not a phrase. 44px is the floor, not the aspiration —
   this is the guest's only route back to their own booking. */
.bk__doneLink {
  display: inline-flex; align-items: center;
  min-height: 44px; padding: 0 18px;
  margin-bottom: 18px;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-display); font-weight: 600; font-size: 13.5px;
  /* Underlined AS WELL as boxed. The box makes it tappable; the underline is
     what tells someone who cannot distinguish it by colour that it navigates.
     A bordered box alone reads as a button, and a button on a confirmation
     screen reads as "do the thing again". */
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: border-color 200ms ease, background-color 200ms ease;
}
.bk__doneLink:hover {
  border-color: var(--ink);
  background: color-mix(in srgb, var(--ink) 4%, var(--surface));
}

/* ── The waiting-list offer ─────────────────────────────────────────
   Deliberately NOT styled like .bk__err. A full class is not the member's
   mistake and not a failure of the page; red would tell them something has
   gone wrong and the next thing they do is leave. This is a neutral panel
   with one action in it. */
.bk__waitOffer {
  margin: 4px 0 18px;
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
.bk__waitTitle {
  margin: 0 0 6px;
  font-family: var(--font-display); font-weight: 700;
  font-size: 16px; letter-spacing: 0.01em;
  color: var(--ink);
}
.bk__waitBody {
  margin: 0 0 14px;
  font-size: 14px; line-height: 1.6;
  max-width: 52ch;
  color: color-mix(in srgb, var(--ink) 74%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .bk *, .bk *::before, .bk *::after {
    transition: none !important; animation: none !important;
  }
  /* :active as well as :hover. The press state is a transform, so a member who
     has asked for reduced motion would otherwise still get the card jumping
     under their thumb — and on a phone that is the only one of the two they
     would ever see. */
  .bk__nextCard:hover, .bk__card:hover, .bk__card:active { transform: none; }
}
`
