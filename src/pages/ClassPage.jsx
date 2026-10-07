// ============================================================
// CLASS PAGE — flow-chart Steps 3, 4 and 4b. Route: /c/:slug
//
//   Step 3  · The public page the shareable link opens. One class, its own
//             timetable, who it's for.
//   Step 4  · Pick a date. Live places left, capacity enforced.
//   Step 4b · Who is the booking for — me / someone else / a group.
//
// THIS PAGE IS PUBLIC. No auth, no membership, no shell. It is what a runner
// sees when they tap a link in the WhatsApp group, and what a stranger sees
// when they arrive from the website timetable — your "internal" and "external"
// user types land on the same page and are told apart later, by how they
// continue (Sections 4 and 5).
//
// Because it is public it CANNOT read the classes table directly: RLS scopes
// that read to the caller's org memberships, and a visitor has none. It goes
// through public_class_by_slug() instead. See the header of the Step 3 block
// in src/lib/classes.js.
//
// NO CLASS NAME IS HARD-CODED HERE. Not in the title, not in the page <title>,
// not in a single message. Every one is read from the class row, so renaming
// "The Valley" changes this page, the tab title and every notice on it — while
// the URL, which is the slug, stays valid for everyone who already has it.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight, CalendarDays, Check, Clock, Info, MapPin, Pause, PlayCircle,
  Star, Tag, User, UserPlus, Users, Venus,
} from 'lucide-react'

import { tenant } from '../lib/theme'
import {
  coachNameOf, coachPath, dayNumber, fmtClockFromStamp, fmtDayDate, fmtPrice,
  fmtTime, dayLabel, monthKey, monthLabel, ratingCopy, relativeWhen, stateCopy,
  usePublicClass, usePublicReviews, usePublicSessions, videoEmbed, weekdayShort,
  imageSrc, imageFocus,
} from '../lib/classes'
import {
  HUB_CLASSES, DISCIPLINE_IMAGE, DISCIPLINE_FILM, deriveCoachBio, hubClassByDbSlug,
  hubClassToPublic,
} from '../lib/hubClasses'
import ShareRow, { SHARE_CSS } from '../components/ShareRow'

// Step 4b's three options (schema: booked_for check constraint).
// `places` is fixed at 1 for the first two; only 'group' is variable, because
// only a group changes how many seats the booking consumes.
const WHO = [
  { value: 'me', label: 'Me', hint: 'Just my place', Icon: User },
  { value: 'someone_else', label: 'Someone else', hint: "I'm booking for a friend", Icon: UserPlus },
  { value: 'group', label: 'A group', hint: 'Me plus others', Icon: Users },
]

export default function ClassPage() {
  const { slug } = useParams()
  const { cls: dbCls, loading, error, missing, notFound } = usePublicClass(slug)

  // ── Rendering this page before the database exists ────────────────
  // /book has always worked with no database, because it falls back to the
  // club's timetable in hubClasses.js. This page did not, so every /c/ link —
  // the links meant to be pasted into the WhatsApp group, the whole point of
  // the feature — opened a developer's setup notice instead of a class.
  //
  // The fallback is reshaped into the exact row public_class_by_slug() returns
  // (see hubClassToPublic), so everything below this line is unaware of which
  // half it is rendering. One code path, not two.
  const hub = useMemo(() => hubClassByDbSlug(slug), [slug])
  const fallback = useMemo(
    () =>
      hub
        ? hubClassToPublic(hub, {
            // Generated from the timetable, so it states only what the
            // timetable already says. See deriveCoachBio.
            coachBio: hub.coach ? deriveCoachBio(hub.coach, HUB_CLASSES) : null,
          })
        : null,
    [hub],
  )

  // The database WINS whenever it has a row. This is a floor, not an override:
  // the moment the SQL is run and a coach writes a real description, that is
  // what shows, with nothing here to undo or clean up.
  const cls = dbCls || fallback

  // True when we are showing the timetable's copy of a class rather than the
  // club's. It gates exactly one thing — the date picker, which needs real
  // session rows that only exist in the database. It does NOT dim the page or
  // stamp it with a warning: every fact on screen (name, day, time, coach,
  // price, who it's for) is true either way, and a banner saying otherwise
  // would train members to distrust a page that is correct.
  const preview = !dbCls && !!fallback

  // Step 4b state. `places` is DERIVED, never stored alongside bookedFor —
  // two sources of truth for "how many seats" is how a group of 4 ends up
  // booked as 1 after someone switches option and back.
  const [bookedFor, setBookedFor] = useState('me')
  const [groupSize, setGroupSize] = useState(2)
  const places = bookedFor === 'group' ? groupSize : 1

  const [selectedId, setSelectedId] = useState(null)
  const [bumped, setBumped] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  // ── The hero photo, and why a broken one must disappear ───────────
  // image_url is club-supplied and can 404 long after it passed validation —
  // a Drive link un-shared, a CDN folder tidied up. The CHECK constraint can
  // only prove it is https, never that it still resolves.
  //
  // A Set of failed URLs, not a boolean. The page shows one photo, so a
  // boolean is tempting — but there are TWO candidates in order (the class's
  // own photo, then the discipline artwork), and one flag cannot say which of
  // them died. Set it on the club's broken link and the fallback is suppressed
  // along with it; leave it unset and the same broken <img> re-renders and
  // re-fires onError forever. The URL itself is the only honest key.
  //
  // If both fail the band is simply gone and the page reads as it did before
  // the feature existed — never a broken-image icon at the top of a page where
  // somebody is deciding whether to pay.
  const [badArt, setBadArt] = useState(() => new Set())
  const markBadArt = (url) =>
    setBadArt((s) => (s.has(url) ? s : new Set(s).add(url)))

  const { sessions, loading: loadingDates } = usePublicSessions(cls?.id, places)

  // Section 3b. Keyed on the SLUG, not cls.id, so it fires in parallel with the
  // class read instead of waiting for it — reviews are decoration and must
  // never sit in the critical path to the Book button.
  const { reviews } = usePublicReviews(slug)

  // The tab title. Read from the row like everything else, so a rename shows
  // up in the browser tab and in a shared bookmark too.
  useEffect(() => {
    if (cls?.name) document.title = `${cls.name} — ${tenant.name}`
  }, [cls?.name])

  const selected = useMemo(
    () => sessions.find((s) => s.session_id === selectedId) || null,
    [sessions, selectedId],
  )

  // ── Section 3b: the dates, as a calendar of cards ───────────
  // Grouped under month headings rather than laid out in a real 7-column month
  // grid. A weekly class occurs ONCE a week, so eight occurrences span two or
  // three months — a true grid would be ~90% empty squares, which is a calendar
  // shape carrying no information and three screens of scrolling on a phone.
  // Month headings over a card grid give the same "where am I in the year"
  // orientation at a twelfth of the height.
  //
  // Grouping is keyed in Europe/London (see monthKey): a Sunday-evening class
  // in the last days of a month falls in a different MONTH depending on the
  // viewer's timezone, and a member in Spain must see the club's calendar.
  const months = useMemo(() => {
    const out = []
    for (const row of sessions) {
      const key = monthKey(row.starts_at)
      const last = out[out.length - 1]
      // Push-or-append against the LAST group only, never a lookup by key.
      // The rows arrive in date order from SQL, so this preserves that order;
      // a keyed map would risk re-ordering months by insertion.
      if (last && last.key === key) last.rows.push(row)
      else out.push({ key, label: monthLabel(row.starts_at), rows: [row] })
    }
    return out
  }, [sessions])

  // ── The ordering problem the flow chart contains ───────────
  // Step 4 (pick a date) comes BEFORE step 4b (who for), and I have kept that
  // order. But they are coupled: a date with 2 mats left is bookable for one
  // person and not for a group of five. So someone can legitimately choose a
  // date, then choose "a group of 5", and invalidate their own choice.
  //
  // Rather than reorder your steps, the selection is released and SAID OUT
  // LOUD. The date list above has already re-read with the new group size, so
  // the dates that do fit five are the ones still showing as available — they
  // are being sent somewhere real, not just refused.
  //
  // `places` is deliberately NOT stored in `bumped`, and that is a fix for a
  // bug this page actually had. The stepper goes 2 → 3 → 4 → 5 one click at a
  // time, so the effect fires on the FIRST size that doesn't fit (3) and then
  // never again, because the selection has already been cleared. Storing the
  // number froze the message at "it can't take 3" while the visitor was
  // looking at a group of 5. Only the facts that cannot change are captured;
  // the group size is read live at render.
  useEffect(() => {
    if (!selectedId || loadingDates) return
    const row = sessions.find((s) => s.session_id === selectedId)
    if (!row) return
    if (row.state !== 'ok') {
      setBumped({ seatsLeft: row.seats_left, when: row.starts_at, state: row.state })
      setSelectedId(null)
      setConfirmed(false)
    }
  }, [sessions, selectedId, loadingDates])

  // Which warning, if either, is still TRUE at this instant.
  //
  // A second bug found by stepping the group size back DOWN, and it was caused
  // by the fix above. `bumped` is cleared when a new date is picked or the
  // "who" changes — but not when the size returns to one that fits. With the
  // group at 5, Thu 29 Oct (2 places) is released and warned about; step back
  // to 2 and the cards correctly re-open that date while the warning, reading
  // `places` live, turned into "only has 2 places left, so it can't take 2".
  // A self-contradiction sitting in a role="alert", next to a grid that says
  // the opposite.
  //
  // The cause is that half this message is captured state and half is read
  // live, and only the captured half was guarded. So it is DERIVED, not
  // cleared: a stale warning cannot outlive its own truth, in either
  // direction, without a third place remembering to reset it.
  //
  // The reason is carried too, because a date can also be released by the
  // coach pausing it or by the last places going while it sat selected. Those
  // have nothing to do with the group size, so they get their own sentence
  // rather than a capacity explanation that would be a lie.
  const bumpKind = !bumped
    ? null
    : bumped.state === 'not_enough_seats'
      ? bumped.seatsLeft < places ? 'seats' : null
      : 'gone'

  function pick(row) {
    const copy = stateCopy(row.state, row.seats_left, places, cls)
    if (!copy.can) return
    setSelectedId(row.session_id)
    setBumped(null)
    setConfirmed(false)
  }

  function chooseWho(value) {
    setBookedFor(value)
    setBumped(null)
    setConfirmed(false)
    // Leaving 'group' resets the size so it cannot linger invisibly and be
    // re-applied later by a second click on "A group".
    if (value !== 'group') setGroupSize(2)
  }

  // ── Shells for the states that are not "a class" ───────────
  if (loading) {
    return (
      <Shell>
        <p className="cp__note">Loading…</p>
      </Shell>
    )
  }

  // ── One failure shell, not two ──────────────────────────────
  // There used to be a separate branch here for `missing` — the RPC returning
  // 404 because the SQL has never been run — showing the names of two .sql
  // files to run in Supabase. It was checked FIRST, which meant it won every
  // time, and on this deployment the RPC is always 404. So the page a member
  // got after mistyping a class link was a SQL instruction with no link out of
  // it. A dead end, in the club's own words, to somebody who did nothing wrong.
  //
  // The setup hint was only ever for a developer, and a developer opening a
  // real /c/ link now gets a working page from the timetable fallback, so it
  // was already nearly unreachable for them too. It belongs in the console,
  // where developers look and members never do — and NOT on a public page,
  // which has no business naming the club's database files to strangers.
  //
  // What is left is the one message that is true in every case that reaches
  // here, whatever the cause: we cannot show you this class, here is the
  // timetable.
  if ((missing || notFound || error) && !cls) {
    if (missing) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ClassPage] public_class_by_slug is missing. Run supabase-classes.sql ' +
        'then supabase-classes-seed.sql in the Supabase SQL editor. Classes on ' +
        'the timetable still render from hubClasses.js; this slug is not one of ' +
        `them: ${slug}`,
      )
    }
    // Deliberately does NOT say "wrong link". The commonest cause of landing
    // here is a class that has been retired since the link was shared, and
    // telling someone they mistyped a link they tapped is a dead end. The
    // timetable is the way forward either way.
    return (
      <Shell>
        <div className="cp__notice" role="status">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>We can&rsquo;t find that class.</strong>
            <p>
              It may have been renamed or taken off the timetable. Everything
              that&rsquo;s running this week is on the{' '}
              <Link to="/book">full timetable</Link>.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const free = Number(cls.price_pennies || 0) <= 0
  const anyBookable = sessions.some((s) => s.state === 'ok')

  // ── Section 3b derived values ───────────────────────────────
  // coachNameOf trims before deciding: one class on the club's timetable has
  // no coach at all and arrives as an empty string, not null.
  const coach = coachNameOf(cls)
  // Null unless the class has a linked profile. 11 of 12 classes have one
  // today, and the twelfth must render no link rather than /coaches#null.
  const coachHref = coachPath(cls.coach_slug)
  // Null unless the URL is on the host allowlist. A URL we will not frame
  // shows as a plain link, never as a raw iframe src — see videoEmbed().
  const video = videoEmbed(cls.video_url)

  // ── The club's own clip, from src/assets/class-films ───────────────
  // Suppressed the moment the class has ANY club-supplied video_url — not
  // just a frameable one. The `!cls.video_url` test rather than `!video` is
  // deliberate: an unframeable URL already renders the "Watch a clip of this
  // class" link below, and showing our discipline default beside it would put
  // two different videos under one description with nothing saying which is
  // the class. A club that pasted a link has answered the question.
  const film = !cls.video_url ? DISCIPLINE_FILM[hub?.discipline] || null : null
  // Null when rating_count is 0, because avg() over no rows is NULL and
  // "0.0 stars" is a review this class has not had.
  const rating = ratingCopy(cls.rating_avg, cls.rating_count)

  // ── The hero photo, resolved in the same order as /book ────────────
  // The class's own photo, then the discipline artwork, then nothing. Kept
  // identical to the card band on the timetable on purpose: a member taps a
  // card and lands here, and the image changing under them would read as
  // having tapped the wrong class.
  //
  // `hub` is looked up by slug from the timetable file, so it is there whether
  // or not the database is — which means the artwork fallback works on a real
  // database row too, not only in preview.
  const art = (() => {
    const own = imageSrc(cls.image_url)
    if (own && !badArt.has(own)) return own
    const generic = DISCIPLINE_IMAGE[hub?.discipline]
    return generic && !badArt.has(generic) ? generic : null
  })()

  // ── The link that gets shared ───────────────────────────────
  // REBUILT from the origin and the slug, not taken from
  // window.location.href. The href a member is standing on can carry things
  // that must not be passed on: a ?ref= from whoever shared it with THEM (so
  // the credit follows the wrong person forever), a #anchor from a tap on the
  // coach link, a utm_ pair from an Instagram click-through. Every one of those
  // would be copied into the group chat and re-copied out of it.
  //
  // The slug from useParams, not cls.slug: it is what the member typed or
  // tapped, so the link they pass on is the link they are actually on. Classes
  // keep their slug across a rename by design — see the header of this file —
  // so this stays valid however often the name changes.
  const shareUrl =
    typeof window === 'undefined'
      ? `/c/${slug}`
      : `${window.location.origin}/c/${slug}`

  // The one line that travels with the link. Built from the row, so a renamed
  // class shares under its new name and a re-timed class shares its new time —
  // no second copy of the timetable to forget to update.
  const shareText =
    `${dayLabel(cls.recurrence_day)}s at ${fmtTime(cls.recurrence_time)}` +
    `${coach ? ` with ${coach}` : ''}${cls.location ? `, ${cls.location}` : ''}`

  return (
    <Shell>
      {/* ── Step 3: the class ──────────────────────────────────
          Day and time come from the recurrence rule, which is the class's
          standing promise ("Mondays, 9.30am"). The dated list below comes from
          the generated sessions. They can differ — a cancelled week — and that
          is exactly why both are shown. */}
      {/* ── The hero photo ──────────────────────────────────────
          alt="" and aria-hidden, because it is decoration. The class name is
          the <h1> immediately underneath; an alt of "The Valley" would have a
          screen reader announce the same three words twice before reaching any
          new information, and an invented description of a photo nobody here
          has seen would be worse.

          No <figure>, no caption: this is the top of the page, not a piece of
          evidence being cited. */}
      {art && (
        <div
          /* Greyscale when paused, exactly as the card does on /book. The
             paused notice below says it in words; this says it before anyone
             has read a word, and keeps the two pages telling one story. */
          className={`cp__art${cls.is_paused ? ' cp__art--off' : ''}`}
          aria-hidden="true"
        >
          <img
            src={art}
            alt=""
            /* NOT lazy. This is above the fold on every screen size, and
               loading="lazy" on a hero delays the one image the page is
               judged by. The band on /book is lazy for the opposite reason —
               eleven of its twelve cards start off-screen. */
            decoding="async"
            width="660"
            height="180"
            style={{ objectPosition: imageFocus(cls.image_focus) }}
            onError={() => markBadArt(art)}
          />
        </div>
      )}

      <p className="cp__eyebrow">
        {dayLabel(cls.recurrence_day)}s · {fmtTime(cls.recurrence_time)}
      </p>
      <h1 className="cp__title">{cls.name}</h1>

      <ul className="cp__facts">
        {coach && (
          <li><User size={14} aria-hidden="true" />with {coach}</li>
        )}
        {cls.location && (
          <li><MapPin size={14} aria-hidden="true" />{cls.location}</li>
        )}
        <li>
          <Tag size={14} aria-hidden="true" />
          {free ? 'Free' : fmtPrice(cls.price_pennies)}
        </li>
        {/* Section 3b. In the facts row rather than its own block: the rating
            is a reason to trust the class, and it belongs next to the price
            where someone is weighing it up, not in a testimonials section
            further down the page than most people scroll. */}
        {rating && (
          <li className="cp__fact--rating">
            <Star size={14} aria-hidden="true" />
            <span aria-label={`Rated ${rating.avg} out of 5 from ${rating.count} ratings`}>
              {rating.label}
            </span>
          </li>
        )}
        {cls.female_only && (
          <li className="cp__fact--flag"><Venus size={14} aria-hidden="true" />Women only</li>
        )}
      </ul>

      {/* Paused is shown, never hidden. The class stays on the page with its
          reason, because removing it reads as "cancelled for good" to a member
          who knows it exists. */}
      {cls.is_paused && (
        <div className="cp__paused" role="status">
          <Pause size={16} aria-hidden="true" />
          <div>
            <strong>This class is paused.</strong>
            <p>
              {cls.pause_note
                ? cls.pause_note
                : coach
                  ? `Message ${coach} to find out when it restarts.`
                  : 'It will be back on the timetable when it restarts.'}
            </p>
          </div>
        </div>
      )}

      {/* `|| film` matters: a class with a clip but no description would
          otherwise drop the clip on the floor, because this gate — not the
          block below — decides whether it is ever reached. */}
      {(cls.description || cls.female_only || film) && (
        <section className="cp__about" aria-labelledby="cp-about-h">
          <h2 id="cp-about-h" className="cp__h2">Who it&rsquo;s for</h2>
          {cls.description && <p className="cp__body">{cls.description}</p>}

          {/* ── Section 3b: the class video, inside the description ──
              Placed here, in the description, because that is where it answers
              the question it is there to answer: "what actually happens in this
              class". Above the date picker on purpose — someone watches the
              clip to decide whether to book, so it has to come before the
              booking.

              The src has been through videoEmbed(): https-only, host
              allowlist, and rebuilt from a validated id rather than from the
              string the club pasted. cls.video_url is never used raw here. */}
          {video && (
            <figure className="cp__video">
              <div className="cp__videoFrame">
                <iframe
                  src={video.src}
                  // The class name, so a screen reader hears "The Valley — a
                  // look at the class" and not "YouTube video player".
                  title={`${cls.name} — a look at the class`}
                  loading="lazy"
                  // Deliberately narrow. No camera, no microphone, no
                  // geolocation, no payment: a video player on a public
                  // booking page has no business asking for any of them, and
                  // an allow list is how the browser is told so.
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  // referrerPolicy so the provider is not handed the full
                  // class URL — which identifies the club and the class — as a
                  // referrer on every page view.
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              {cls.video_caption && (
                <figcaption className="cp__videoCap">{cls.video_caption}</figcaption>
              )}
            </figure>
          )}

          {/* ── The club's own clip, self-hosted ──────────────────────
              A native <video>, not an iframe, because the file is in this
              repo. Nothing is fetched from another company, so there is no
              third-party player loading its own scripts and cookies onto a
              page where somebody is about to enter their name and pay.

              Sits in the same slot as the embed above and is mutually
              exclusive with it, so the description has exactly one video in
              it however the class is configured. */}
          {film && (
            <figure className="cp__video">
              <div className="cp__filmFrame">
                <video
                  className="cp__film"
                  src={film.src}
                  /* A still from THIS film, never from the card photo — the
                     two are different footage. Without a poster the browser
                     paints black until the first frame decodes, which on a
                     pale page reads as a broken embed. */
                  poster={film.poster || undefined}
                  controls
                  /* Nothing autoplays. The file is ~1MB and the member has
                     not asked for it yet; pulling it for everyone who scrolls
                     past spends their data on a decision they may already
                     have made. With +faststart, "metadata" is a few KB. */
                  preload="metadata"
                  /* Without this, iOS Safari takes the video fullscreen the
                     moment it plays, throwing the member out of the page they
                     were reading to decide whether to book. */
                  playsInline
                  /* 12 seconds. Without loop it stops on a frozen frame,
                     which looks like it failed rather than finished. */
                  loop
                  /* The class name, because a screen reader otherwise
                     announces this as an unlabelled "video". */
                  aria-label={`A short clip of ${cls.name}`}
                >
                  {/* Reached only if the browser cannot play h.264 at all.
                      A download link, not an apology — the file is ours and
                      the member can still watch it. */}
                  <a href={film.src}>Download a short clip of {cls.name}</a>
                </video>
              </div>
              {/* Stating "no sound" is not a detail. The clip is silent — the
                  source's audio track measured -91 dB, i.e. nothing — and a
                  member who presses play, hears silence and turns their phone
                  up blames the site. Saying so first costs one line. */}
              <figcaption className="cp__videoCap">
                {cls.video_caption || `A few seconds inside ${cls.name}. No sound.`}
              </figcaption>
            </figure>
          )}

          {/* A video_url the allowlist refused, or one from a host we do not
              frame. Shown as a link rather than dropped: the club put a real
              video there and silently hiding it looks like the field does not
              work. rel="noopener noreferrer" because this is an untrusted,
              club-supplied destination. */}
          {!video && cls.video_url && (
            <p className="cp__body cp__body--dim">
              <a href={cls.video_url} target="_blank" rel="noopener noreferrer">
                <PlayCircle size={14} aria-hidden="true" /> Watch a clip of this
                class
              </a>
            </p>
          )}

          <p className="cp__body cp__body--dim">
            {cls.female_only
              ? 'This is a women-only session. '
              : 'Everyone welcome, whatever your starting point. '}
            Up to {cls.capacity} people per session.
          </p>
        </section>
      )}

      {/* ── Section 3b: the coach ───────────────────────────────
          A SHORT panel, not the full bio. This reader is mid-decision about one
          class; the full write-up lives on /coaches, which owns it because a
          bio belongs to the person and three of these coaches teach more than
          one class. Two sentences here, a link for the rest.

          Rendered whenever there is a profile to show. A class with only
          coach_name text (no linked profile) already names its coach in the
          facts row above, so a panel repeating it with nothing added would be
          filler. */}
      {(cls.coach_bio || cls.coach_photo_url || cls.coach_credentials) && coach && (
        <section className="cp__coach" aria-labelledby="cp-coach-h">
          <h2 id="cp-coach-h" className="cp__h2">Your coach</h2>
          <div className="cp__coachRow">
            {cls.coach_photo_url && (
              // https-only is enforced by the coaches_photo_https CHECK.
              <img
                className="cp__coachPic"
                src={cls.coach_photo_url}
                alt={coach}
                loading="lazy"
                width="60"
                height="60"
              />
            )}
            <div className="cp__coachText">
              <p className="cp__coachName">{coach}</p>
              {cls.coach_credentials && (
                <p className="cp__coachCreds">{cls.coach_credentials}</p>
              )}
              {cls.coach_bio && <p className="cp__body">{cls.coach_bio}</p>}
              {coachHref && (
                // <Link>, not <a href>. An anchor would reload the whole
                // bundle to move between two pages of the same app.
                <Link className="cp__coachLink" to={coachHref}>
                  {/* Names the person, so the link makes sense read on its own
                      out of context by a screen reader. */}
                  Read {coach}&rsquo;s full profile
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Step 4, preview variant: no dates to pick ────────────
          When we are on timetable data there is no class row in the database,
          so there are no generated sessions and `id` is null by design. The
          three booking blocks below would render as an empty date list, a
          radio group that changes nothing, and a Continue button permanently
          disabled with "Pick a date to carry on" under it — a booking form
          that cannot be completed, which reads as broken rather than as
          not-yet-open.

          So they are replaced by ONE honest action. The day and time are
          repeated here rather than left to the eyebrow at the top, because
          this is the point where someone decides whether they can make it,
          and by now the eyebrow has scrolled off the screen. */}
      {preview ? (
        <section className="cp__dates" aria-labelledby="cp-dates-h">
          <h2 id="cp-dates-h" className="cp__h2">
            <CalendarDays size={16} aria-hidden="true" />When it runs
          </h2>
          <p className="cp__body">
            Every {dayLabel(cls.recurrence_day)} at {fmtTime(cls.recurrence_time)}
            {coach ? `, with ${coach}` : ''}.{' '}
            {cls.is_paused
              ? 'It is paused at the moment, so there are no dates to book yet.'
              : 'Dated places open on the timetable.'}
          </p>
          <div className="cp__foot">
            {/* A <Link>, styled as the CTA. Not a <button> that navigates:
                this goes to another page, so it should be openable in a new
                tab, copyable, and readable as a destination by a screen
                reader. */}
            <Link className="cp__cta" to="/book">
              See it on the timetable <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <>
      {/* ── Step 4: this class's own dated timetable ───────────── */}
      <section className="cp__dates" aria-labelledby="cp-dates-h">
        <h2 id="cp-dates-h" className="cp__h2">
          <CalendarDays size={16} aria-hidden="true" />Pick your date
        </h2>

        {loadingDates ? (
          <p className="cp__note">Checking availability…</p>
        ) : sessions.length === 0 ? (
          <p className="cp__note">
            No dates are on the calendar yet. Check the{' '}
            <Link to="/book">full timetable</Link>, or ask
            {coach ? ` ${coach}` : ' a coach'} in the group chat.
          </p>
        ) : (
          // One <ul> per month, each under its own heading. Not one flat list
          // with heading rows spliced in: a month heading inside a <ul> is not
          // valid list content, and a screen reader announcing "list, 8 items"
          // across three months describes something the eye does not see.
          months.map((m) => (
            <div className="cp__month" key={m.key}>
              <h3 className="cp__monthH">{m.label}</h3>
              <ul className="cp__cards">
                {m.rows.map((row) => {
                  const copy = stateCopy(row.state, row.seats_left, places, cls)
                  const isSel = row.session_id === selectedId
                  const rel = relativeWhen(row.starts_at)
                  return (
                    <li key={row.session_id}>
                      <button
                        type="button"
                        className={`cp__card cp__card--${copy.kind}${isSel ? ' is-sel' : ''}`}
                        onClick={() => pick(row)}
                        // Unavailable dates are disabled, not removed. "Full"
                        // is information — it tells someone to try another week
                        // or ask for the waiting list. A missing row tells them
                        // nothing at all.
                        disabled={!copy.can}
                        aria-pressed={isSel}
                      >
                        {/* The date block — the calendar "tile" part of the
                            card. aria-hidden because the day number and the
                            weekday are also in the accessible label below, and
                            hearing "Mon 29 Mon 29 September" is worse than
                            hearing it once. */}
                        <span className="cp__tile" aria-hidden="true">
                          <span className="cp__tileDow">{weekdayShort(row.starts_at)}</span>
                          <span className="cp__tileNum">{dayNumber(row.starts_at)}</span>
                        </span>

                        <span className="cp__cardBody">
                          {/* The class NAME on every card. This is the "cards
                              contain a class" part: a card lifted out of
                              context — screenshotted into the group chat, read
                              by someone who scrolled past the title — still
                              says which class it is. Read from the row, so a
                              rename changes all eight at once. */}
                          <span className="cp__cardName">{cls.name}</span>
                          <span className="cp__cardWhen">
                            {fmtDayDate(row.starts_at)}
                            <span className="cp__cardTime">
                              <Clock size={12} aria-hidden="true" />
                              {fmtClockFromStamp(row.starts_at)}
                            </span>
                            {rel && <em className="cp__rel">{rel}</em>}
                          </span>
                          {coach && <span className="cp__cardCoach">with {coach}</span>}

                          <span className="cp__cardFoot">
                            <span className={`cp__seats cp__seats--${copy.kind}`}>
                              {copy.label}
                            </span>
                            {isSel && (
                              <span className="cp__tick">
                                <Check size={14} aria-hidden="true" /> Selected
                              </span>
                            )}
                          </span>

                          {copy.note && <span className="cp__cardNote">{copy.note}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}

        {!loadingDates && sessions.length > 0 && !anyBookable && (
          <p className="cp__note cp__note--warn">
            {places > 1
              ? `No date has ${places} places together right now. Try a smaller group, or ask about the waiting list.`
              : cls.is_paused
                ? 'Booking is closed while the class is paused.'
                : 'Every date is full at the moment. Ask about the waiting list.'}
          </p>
        )}
      </section>

      {/* ── Step 4b: who is the booking for ───────────────────── */}
      <section className="cp__who" aria-labelledby="cp-who-h">
        <h2 id="cp-who-h" className="cp__h2">Who&rsquo;s it for?</h2>

        <div className="cp__whoGrid" role="radiogroup" aria-labelledby="cp-who-h">
          {WHO.map(({ value, label, hint, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={bookedFor === value}
              className={`cp__opt${bookedFor === value ? ' is-sel' : ''}`}
              onClick={() => chooseWho(value)}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="cp__optLabel">{label}</span>
              <span className="cp__optHint">{hint}</span>
            </button>
          ))}
        </div>

        {bookedFor === 'group' && (
          <div className="cp__group">
            <label htmlFor="cp-size">How many places altogether?</label>
            <div className="cp__stepper">
              <button
                type="button" onClick={() => setGroupSize((n) => Math.max(2, n - 1))}
                disabled={groupSize <= 2} aria-label="One fewer place"
              >−</button>
              <output id="cp-size">{groupSize}</output>
              <button
                type="button" onClick={() => setGroupSize((n) => Math.min(cls.capacity, n + 1))}
                disabled={groupSize >= cls.capacity} aria-label="One more place"
              >+</button>
            </div>
            {/* Your rule, made visible before anyone is surprised by it:
                a group of five takes five of the forty places, and the dates
                above have already been re-checked against that number. */}
            <p className="cp__groupNote">
              Counts as {groupSize} of the {cls.capacity} places. You&rsquo;ll be one line on
              the coach&rsquo;s register.
            </p>
          </div>
        )}

        {bumpKind === 'seats' && (
          <p className="cp__note cp__note--warn" role="alert">
            {fmtDayDate(bumped.when)} only has {bumped.seatsLeft}{' '}
            {bumped.seatsLeft === 1 ? 'place' : 'places'} left, so it can&rsquo;t take{' '}
            {places}. Pick another date above — the ones still available have room for{' '}
            {places}.
          </p>
        )}
        {bumpKind === 'gone' && (
          <p className="cp__note cp__note--warn" role="alert">
            {fmtDayDate(bumped.when)} isn&rsquo;t available any more. Pick another date
            above.
          </p>
        )}
      </section>

      {/* ── Handoff to Sections 4 / 5 ──────────────────────────
          Step 5 is the fork: sign in, or carry on as a guest. Neither branch
          is built yet, so this confirms the choice and says plainly what
          follows, rather than offering a button that does nothing. */}
      <div className="cp__foot">
        <button
          type="button"
          className="cp__cta"
          disabled={!selected}
          onClick={() => setConfirmed(true)}
        >
          Continue <ArrowRight size={16} aria-hidden="true" />
        </button>
        {!selected && <p className="cp__ctaHint">Pick a date to carry on.</p>}
      </div>

      {confirmed && selected && (
        <div className="cp__summary" role="status">
          <p className="cp__summaryHead">Your booking so far</p>
          <dl className="cp__summaryList">
            <div><dt>Class</dt><dd>{cls.name}</dd></div>
            <div>
              <dt>Date</dt>
              <dd>{fmtDayDate(selected.starts_at)} · {fmtClockFromStamp(selected.starts_at)}</dd>
            </div>
            <div>
              <dt>For</dt>
              <dd>
                {bookedFor === 'me' && 'Me'}
                {bookedFor === 'someone_else' && 'Someone else'}
                {bookedFor === 'group' && `A group of ${groupSize}`}
              </dd>
            </div>
            <div><dt>Places</dt><dd>{places}</dd></div>
            <div>
              <dt>Cost</dt>
              <dd>{free ? 'Free' : fmtPrice(cls.price_pennies * places)}</dd>
            </div>
          </dl>
          <p className="cp__summaryNext">
            <Info size={14} aria-hidden="true" />
            Next: sign in or carry on as a guest, then your details and payment.
            That&rsquo;s the next part of the build.
          </p>
        </div>
      )}
        </>
      )}

      {/* ── Section 3b: what members said ──────────────────────
          Below the date picker and the Continue button, not above them. Someone
          who arrived from the group chat has already decided to come; putting
          testimonials between them and the dates adds a scroll to every
          booking. Someone who is unsure scrolls, and finds them.

          ── A heading that now appears over an empty list ──
          This section used to render NOTHING until a review existed, and the
          reasoning was sound at the time: a "Reviews" heading over blank space
          reads as a class nobody liked rather than a class nobody has rated
          yet, and 11 of these 12 classes have no ratings.

          It renders always now, because the space is no longer empty — there is
          something true and useful to put in it. Who is allowed to review a
          class here is unusual and worth saying out loud: only people the
          register says were in the room. That is the difference between this
          list and the invented five-star blocks on every other gym's website,
          and a member reading "no reviews yet" next to "only people who came
          can leave one" draws a very different conclusion from a member reading
          "no reviews yet" on its own.

          The heading stays generic — "What members say" — and never counts or
          scores anything. cls.rating_avg is already in the facts row at the
          top, next to the price, where somebody is weighing the class up. */}
      <section className="cp__reviews" aria-labelledby="cp-rev-h">
        <h2 id="cp-rev-h" className="cp__h2">
          <Star size={16} aria-hidden="true" />
          What members say
        </h2>

        {reviews.length > 0 ? (
          <ul className="cp__revList">
            {reviews.map((r, i) => (
              // Keyed on created_at + index. No id comes back from
              // public_class_reviews and that is deliberate — a rating id is of
              // no use to a visitor and would be one more internal identifier
              // on a public page. The list is read-only and never reorders, so
              // a positional key is safe here.
              <li className="cp__rev" key={`${r.created_at}-${i}`}>
                <p className="cp__revStars">
                  {/* Filled stars up to the score, hollow after — a bare "4/5"
                      is harder to read at a glance than four filled shapes.
                      aria-hidden on the whole row with the score in the label,
                      so a screen reader hears "4 out of 5" once instead of
                      five separate star announcements. */}
                  <span aria-hidden="true" className="cp__revStarRow">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={13}
                        className={n <= r.stars ? 'cp__star is-on' : 'cp__star'}
                      />
                    ))}
                  </span>
                  <span className="cp__revName">
                    <span className="cp__srOnly">{r.stars} out of 5 — </span>
                    {r.rater_name}
                  </span>
                  {/* The date, because an undated review is read as a review of
                      this week's class. A relative phrase rather than a
                      timestamp: "last month" is the only precision that
                      matters here, and "14 Jun 2024" invites arithmetic. */}
                  {r.created_at && (
                    <span className="cp__revWhen">{relativeWhen(r.created_at)}</span>
                  )}
                </p>
                <p className="cp__revBody">{r.comment}</p>
              </li>
            ))}
          </ul>
        ) : (
          /* ── The empty state, which is a feature and not a gap ──
             Two sentences and no apology. The first says what is true; the
             second says WHY it is true, and the why is the interesting part.
             Deliberately does not beg ("be the first to review!") — a member
             who has not trained here yet cannot act on that, and a member who
             has does not need it. */
          <p className="cp__revNone">
            No reviews yet.{' '}
            {/* Named in full, because this is the sentence doing the work.
                Every other gym's five stars could have been typed by the
                owner; these cannot. */}
            Only people the register shows were at a session can leave one
            for {cls.name}, so there is nothing here until someone who
            actually trained has said something.
          </p>
        )}
      </section>

      {/* ── Share this class ────────────────────────────────────
          LAST, and after the reviews. The flow chart's Step 3 is "the page the
          shareable link opens"; this is the row that produces the link, and it
          belongs at the point where the reading is finished.

          Not next to the Book button, which was the other candidate. A share
          control beside a booking control competes with it for the same tap,
          and the club does not want a member who meant to book leaving with a
          copied link instead. Whoever came to book has booked by the time they
          reach this; whoever came to look has finished looking.

          shareText carries the day, time, coach and place — see where it is
          built above. Nothing about this row knows the class's name except by
          being handed it. */}
      <ShareRow url={shareUrl} title={cls.name} text={shareText} />
    </Shell>
  )
}

// Shared frame, so every state above (loading, missing, not-found, the real
// page) keeps the club's header instead of dumping a bare error on a white
// page. The one thing this page must never look like is broken.
function Shell({ children }) {
  return (
    <div className="cp">
      {/* Two strings, one <style>. SHARE_CSS travels with its component in
          components/ShareRow.jsx so the two cannot drift apart, but it is
          injected here because the Shell is the only thing on this page that
          renders exactly once — putting a <style> inside ShareRow would mean a
          second copy of the rules the day a second share row appears on a
          page. */}
      <style>{CLASS_CSS + SHARE_CSS}</style>
      <header className="cp__hero">
        <Link to="/" className="cp__lockup" aria-label={`${tenant.name} — back to home`}>
          <span className="cp__mark">{tenant.mark}</span>
          <span className="cp__wordmark">{tenant.name}</span>
        </Link>
      </header>
      <main className="cp__wrap">{children}</main>
      <footer className="cp__pageFoot">
        <Link to="/book">See the full timetable</Link>
      </footer>
    </div>
  )
}

const CLASS_CSS = `
.cp {
  /* svh, with vh as the fallback: 100vh on a phone is the viewport with the
     address bar hidden, so it is always a little taller than the screen. */
  min-height: 100vh;
  min-height: 100svh;
  background: var(--bg);
  color: var(--ink);
  padding-bottom: 72px;
}
.cp__hero {
  background: var(--sidebar-bg, #141414);
  padding: 20px 24px;
  position: relative;
}
.cp__hero::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  background: var(--accent);
}
.cp__lockup {
  display: inline-flex; align-items: center; gap: 10px;
  text-decoration: none; color: #fff; min-height: 44px;
  transition: opacity 200ms ease;
}
.cp__lockup:hover { opacity: 0.72; }
.cp__mark {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--accent); color: #fff;
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 700; font-size: 15px;
}
.cp__wordmark {
  font-family: var(--font-display); font-weight: 700; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.14em;
}

.cp__wrap { max-width: 640px; margin: 0 auto; padding: 36px 20px 0; }

/* ── Hero photo ──
   Negative margins cancel .cp__wrap's padding exactly, so the photo runs to
   the wrap's edges and sits flush under the accent rule on the header bar
   instead of floating in a 36px gap.

   aspect-ratio 11 / 3 is the ratio the club is briefed to export in
   (660×180 — see src/assets/classes/README.md), so at the intended ratio
   object-fit has nothing to crop and the subject they centred stays centred.
   It is a RATIO and not a height so the band scales with the viewport: a fixed
   height would letterbox the artwork on a phone, which is the one place it is
   guaranteed to be seen.

   The grey is the same tint as the timetable's band, so a slow image reveals
   itself into the same shape rather than flashing the page background.
   The box also reserves its own space before the image arrives, so there is no
   layout shift as it loads. */
.cp__art {
  margin: -36px -20px 24px;
  aspect-ratio: 11 / 3;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink) 8%, var(--surface));
  border-bottom: 1px solid var(--line);
}
.cp__art img {
  display: block; width: 100%; height: 100%; object-fit: cover;
  /* 38%, not centre — and this is exactly why the default belongs in CSS
     rather than in an inline style. The artwork is a 16:9 room shot; this
     banner is 11:3, so roughly half its height is thrown away. Centred, the
     cut lands across everyone's shoulders and takes the raised arms off the
     top of the frame, which is the one thing that makes the photo read as a
     yoga class at a glance. Biasing the window upward keeps them.

     The same file is a full-bleed card background on /book, where the crop is
     horizontal and centre is correct. Two surfaces, two defaults, one file —
     and image_focus still overrides both, per class. */
  object-position: center 38%;
}
.cp__art--off img { filter: grayscale(1); }

.cp__eyebrow {
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--accent-ink); margin: 0 0 10px;
}
.cp__title {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(28px, 6.5vw, 40px); line-height: 1.06;
  text-transform: uppercase; margin: 0 0 18px;
}
.cp__facts {
  list-style: none; margin: 0 0 22px; padding: 0;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.cp__facts li {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--ink-2);
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 999px; padding: 6px 12px;
}
.cp__facts li svg { color: var(--muted); flex: none; }
.cp__fact--flag {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
}

.cp__h2 {
  font-family: var(--font-display); font-weight: 700; font-size: 15px;
  text-transform: uppercase; letter-spacing: 0.1em;
  margin: 0 0 14px; display: flex; align-items: center; gap: 8px;
}
.cp__h2 svg { color: var(--accent); }
.cp__body { font-size: 15px; line-height: 1.65; margin: 0 0 10px; }
.cp__body--dim { color: var(--muted); font-size: 14px; }
.cp__about, .cp__dates, .cp__who { margin-bottom: 34px; }

.cp__paused, .cp__notice {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 10px; padding: 14px 16px; margin: 0 0 26px;
}
.cp__paused svg, .cp__notice svg { color: var(--accent); flex: none; margin-top: 2px; }
.cp__paused strong, .cp__notice strong { display: block; font-size: 14px; margin-bottom: 4px; }
.cp__paused p, .cp__notice p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.6; }
.cp__notice code {
  font-family: var(--font-mono); font-size: 12px;
  background: var(--surface-2); padding: 1px 5px; border-radius: 4px;
}

/* ── Dates: a calendar of class cards ── */
.cp__month { margin-bottom: 20px; }
.cp__monthH {
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted); margin: 0 0 10px;
  padding-bottom: 7px; border-bottom: 1px solid var(--line-soft, var(--line));
}
/* Two columns from 560px up, one below. auto-fit with a 240px floor rather
   than a fixed count, so a month with a single date does not render a
   half-width orphan card next to an empty cell. */
.cp__cards {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.cp__card {
  width: 100%; height: 100%; text-align: left; cursor: pointer;
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 12px; padding: 13px 14px; min-height: 60px;
  font: inherit; color: inherit;
  transition: border-color 160ms ease, background 160ms ease,
              box-shadow 160ms ease, transform 160ms ease;
}
.cp__card:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: var(--surface-raised);
  transform: translateY(-1px);
}
.cp__card:disabled { cursor: not-allowed; opacity: 0.72; }
.cp__card.is-sel {
  border-color: var(--accent); background: var(--surface-raised);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

/* The date tile — the calendar face of the card. */
.cp__tile {
  flex: none; width: 46px;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 6px 0 7px; border-radius: 9px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
}
.cp__card.is-sel .cp__tile {
  background: var(--accent);
}
.cp__card.is-sel .cp__tileDow,
.cp__card.is-sel .cp__tileNum { color: #fff; }
.cp__tileDow {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--accent-ink);
}
.cp__tileNum {
  font-family: var(--font-display); font-weight: 700; font-size: 20px;
  line-height: 1.05; color: var(--accent-ink);
  font-variant-numeric: tabular-nums;
}
/* A full or cancelled date drains the tile of accent colour, so "not
   available" is legible without reading the badge. Colour is never the only
   signal — the seats badge says it in words too. */
.cp__card--full .cp__tile,
.cp__card--off .cp__tile,
.cp__card--tight .cp__tile {
  background: var(--surface-2); border-color: var(--line);
}
.cp__card--full .cp__tileDow, .cp__card--full .cp__tileNum,
.cp__card--off .cp__tileDow,  .cp__card--off .cp__tileNum,
.cp__card--tight .cp__tileDow, .cp__card--tight .cp__tileNum { color: var(--muted); }
.cp__card--off .cp__tileNum { text-decoration: line-through; text-decoration-thickness: 1px; }

.cp__cardBody { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.cp__cardName {
  font-family: var(--font-display); font-weight: 700; font-size: 14.5px;
  line-height: 1.25;
}
.cp__cardWhen {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 7px;
  font-size: 12.5px; color: var(--muted);
}
.cp__cardTime { display: inline-flex; align-items: center; gap: 4px; }
.cp__cardCoach { font-size: 12px; color: var(--muted); }
.cp__cardFoot {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-top: 5px;
}
.cp__cardNote { font-size: 12px; color: var(--muted); line-height: 1.5; padding-top: 3px; }
.cp__rel {
  font-style: normal; font-weight: 600; font-size: 10.5px;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--accent-ink);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 4px; padding: 1px 5px; margin-left: 2px;
}
.cp__tick {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--accent); flex: none;
  font-size: 11.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.cp__seats {
  font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em;
  border-radius: 999px; padding: 4px 10px; white-space: nowrap;
  background: var(--surface-2); color: var(--muted);
}
.cp__seats--ok { background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent-ink); }
.cp__seats--tight { background: #fdf0e0; color: #8a5200; }
.cp__seats--full { background: #fbe6e4; color: #9a2b1f; }

.cp__note { font-size: 13.5px; color: var(--muted); line-height: 1.6; margin: 12px 0 0; }
.cp__note--warn {
  background: #fdf0e0; color: #7a4a00; border-radius: 8px;
  padding: 11px 13px; margin-top: 12px; font-size: 13px;
}
.cp__note a, .cp__pageFoot a { color: var(--accent-ink); }

/* ── Who's it for ── */
.cp__whoGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
@media (max-width: 480px) { .cp__whoGrid { grid-template-columns: 1fr; } }
.cp__opt {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
  padding: 14px; cursor: pointer; font: inherit; color: inherit;
  min-height: 84px; text-align: left;
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}
.cp__opt:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.cp__opt.is-sel {
  border-color: var(--accent); background: var(--surface-raised);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.cp__opt svg { color: var(--accent); }
.cp__optLabel { font-family: var(--font-display); font-weight: 700; font-size: 14px; }
.cp__optHint { font-size: 12px; color: var(--muted); line-height: 1.45; }

.cp__group {
  margin-top: 14px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 10px; padding: 14px 15px;
}
.cp__group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.cp__stepper { display: inline-flex; align-items: center; gap: 4px; }
.cp__stepper button {
  width: 40px; height: 40px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--surface-raised);
  font-size: 19px; line-height: 1; cursor: pointer; color: var(--ink);
}
.cp__stepper button:disabled { opacity: 0.4; cursor: not-allowed; }
.cp__stepper output {
  min-width: 52px; text-align: center;
  font-family: var(--font-display); font-weight: 700; font-size: 19px;
  font-variant-numeric: tabular-nums;
}
.cp__groupNote { margin: 10px 0 0; font-size: 12.5px; color: var(--muted); line-height: 1.55; }

/* ── Continue ── */
.cp__foot { margin-top: 6px; }
.cp__cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; min-height: 50px; border: none; border-radius: 10px;
  background: var(--accent); color: #fff; cursor: pointer;
  font-family: var(--font-display); font-weight: 700; font-size: 15px;
  text-transform: uppercase; letter-spacing: 0.08em;
  transition: opacity 160ms ease;
  /* The preview CTA is an <a>, not a <button>, because it navigates. Anchors
     bring an underline and the visited colour with them, so both are reset
     here rather than in a second class — one CTA, one look, whichever element
     is carrying it. */
  text-decoration: none;
}
.cp__cta:hover:not(:disabled) { opacity: 0.88; }
.cp__cta:disabled { opacity: 0.4; cursor: not-allowed; }
.cp__ctaHint { text-align: center; font-size: 12.5px; color: var(--muted); margin: 10px 0 0; }

.cp__summary {
  margin-top: 20px; background: var(--surface-raised);
  border: 1px solid var(--line); border-left: 3px solid var(--accent);
  border-radius: 10px; padding: 16px 18px;
}
.cp__summaryHead {
  font-family: var(--font-display); font-weight: 700; font-size: 12px;
  text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent-ink);
  margin: 0 0 12px;
}
.cp__summaryList { margin: 0; display: grid; gap: 7px; }
.cp__summaryList > div { display: flex; justify-content: space-between; gap: 16px; font-size: 13.5px; }
.cp__summaryList dt { color: var(--muted); }
.cp__summaryList dd { margin: 0; font-weight: 600; text-align: right; }
.cp__summaryNext {
  display: flex; gap: 8px; align-items: flex-start;
  margin: 14px 0 0; padding-top: 13px; border-top: 1px solid var(--line-soft);
  font-size: 12.5px; color: var(--muted); line-height: 1.55;
}
.cp__summaryNext svg { color: var(--accent); flex: none; margin-top: 2px; }

/* ── Section 3b: video, coach, ratings, reviews ── */

/* Screen-reader-only. Used to prefix a review with its score so the star row
   can be aria-hidden and announced once, in words, instead of five times. */
.cp__srOnly {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.cp__fact--rating { font-variant-numeric: tabular-nums; }

.cp__video { margin: 0 0 16px; }
/* aspect-ratio on the WRAPPER with the iframe absolutely filling it. The
   padding-bottom hack is no longer needed, but the wrapper still is: it
   reserves the space before the iframe loads, so the page does not reflow and
   shove the date picker down under someone's thumb mid-tap. */
.cp__videoFrame {
  position: relative; width: 100%; aspect-ratio: 16 / 9;
  background: #000; border-radius: 12px; overflow: hidden;
  border: 1px solid var(--line);
}
.cp__videoFrame iframe {
  position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
}
.cp__videoCap {
  margin: 8px 0 0; font-size: 12.5px; color: var(--muted); line-height: 1.55;
}

/* ── The self-hosted clip ────────────────────────────────────────────
   A separate frame from .cp__videoFrame, not a reuse of it, because the two
   hold different things. An iframe has to be absolutely positioned into a
   wrapper that reserves its space; a <video> with a poster reports its own
   intrinsic ratio and needs none of that. Sharing the class would mean
   position:absolute on an element that does not want it. */
.cp__filmFrame {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  /* Black under the film, matching the letterbox bars the browser draws if a
     future clip is not 16:9. A --surface backdrop would put two different
     shades of near-white either side of the picture. */
  background: #000;
  /* Kills the 4px inline-element descender gap under the video, which
     otherwise shows as a black sliver below the frame that reads as a
     rendering fault rather than a design. */
  line-height: 0;
}
.cp__film {
  display: block;
  width: 100%;
  height: auto;
  /* Reserves the right box BEFORE the poster or any metadata arrives, so the
     date picker below does not jump down under a thumb mid-tap. Stated rather
     than inferred: the intrinsic ratio is only known once the file responds,
     and on a slow connection that is seconds away. Matches the encode. */
  aspect-ratio: 16 / 9;
  /* cover, so a clip the club later swaps in at another ratio fills the frame
     instead of sitting in bars inside a rounded box. */
  object-fit: cover;
}

.cp__coach { margin-bottom: 34px; }
.cp__coachRow { display: flex; gap: 14px; align-items: flex-start; }
.cp__coachPic {
  width: 60px; height: 60px; border-radius: 50%; object-fit: cover;
  flex: none; background: var(--surface-2);
}
.cp__coachText { min-width: 0; }
.cp__coachName {
  font-family: var(--font-display); font-weight: 700; font-size: 16px;
  margin: 0;
}
.cp__coachCreds { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.cp__coachText .cp__body { margin-top: 8px; }
.cp__coachLink {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px; min-height: 44px; align-content: center;
  font-size: 13.5px; font-weight: 600; color: var(--accent-ink);
  text-decoration: none;
}
.cp__coachLink:hover { text-decoration: underline; }

.cp__reviews { margin-top: 34px; }
.cp__revList { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.cp__rev {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 11px; padding: 14px 15px;
}
.cp__revStars {
  display: flex; align-items: center; gap: 9px; margin: 0 0 7px;
  flex-wrap: wrap;
}
.cp__revStarRow { display: inline-flex; gap: 1px; }
.cp__star { color: var(--line); }
.cp__star.is-on { color: var(--accent); fill: currentColor; }
.cp__revName { font-size: 12.5px; font-weight: 600; color: var(--muted); }
/* Pushed to the far end of the row, and lighter than the name. It is the
   least important thing in the line and should be read last. */
.cp__revWhen {
  margin-left: auto; font-size: 11.5px; color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.cp__revBody { margin: 0; font-size: 14px; line-height: 1.6; }

/* The empty state. Boxed like a review card so the section has the same shape
   whether or not anyone has written anything — the heading does not sit over a
   bare paragraph on 11 of the 12 classes and over a neat stack of cards on the
   twelfth. Dashed border, because a dashed edge reads as "space for something"
   and a solid one reads as "a thing". */
.cp__revNone {
  margin: 0; padding: 15px 16px;
  border: 1px dashed var(--line); border-radius: 11px;
  background: color-mix(in srgb, var(--ink) 2%, var(--surface));
  font-size: 13.5px; line-height: 1.65; color: var(--muted);
  /* Checklist 02: body measure capped so the two sentences do not run the full
     640px wrap width at 14px, which is past a comfortable line length. */
  max-width: 56ch;
}

.cp__pageFoot { text-align: center; margin-top: 34px; font-size: 13px; }
/* The link was an 18px-tall tap target — a 13px line of text and nothing else.
   inline-flex plus min-height makes the whole 44px band tappable without
   changing how it looks, which matters more here than anywhere: this is the
   last thing on the page and the thumb reaching it is at the very bottom of
   the screen. Padding is horizontal too, so a near-miss either side still
   lands. */
.cp__pageFoot a {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 0 12px;
}

@media (prefers-reduced-motion: reduce) {
  .cp * { transition: none !important; }
}
`
