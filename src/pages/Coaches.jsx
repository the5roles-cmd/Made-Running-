// ============================================================
// MADE RUNNING COACHES — the dedicated coach page. Route: /coaches
//
// Section 3b. Not a flow-chart step: the flow chart describes a BOOKING, and
// this page is not part of one. It is the page a class page links out to when
// someone wants to know who they would be training with before they commit.
// Adding it did not add, remove or reorder any step in the flow.
//
// WHY THIS PAGE EXISTS SEPARATELY FROM THE CLASS PAGE
//
// A bio belongs to the PERSON, not the class. Eight coaches cover the club's
// twelve classes: Micah has both Hot Kettlebells evenings, Jade has CaTcH a
// Circuit and the Monday morning class, K3 & Marvin have both Valley sessions.
// A bio stored per class would be the same paragraph in two places with no
// owner, and no page a coach could be pointed at to correct their own words.
//
// So /c/:slug shows a SHORT coach panel — that reader is mid-decision about one
// class and sending them away is a good way to lose the booking — and links
// here, to /coaches#<slug>, for the full write-up. One source, two surfaces.
//
// PUBLIC, like the class page and for the same reason: the audience arrives
// from a link pasted into a WhatsApp group and is not signed in. Behind
// RequireAuth this page could not be linked from the one page that needs it.
//
// It reads through public_coaches() rather than the coaches table, because RLS
// scopes that table to the caller's org memberships and a visitor has none —
// which is not an error, it is zero rows and a page that says "no coaches yet".
//
// NO COACH NAME, CLASS NAME OR TIMETABLE IS HARD-CODED HERE. All of it is read
// from the database, so renaming a class updates this page too.
// ============================================================
import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, MapPin, Pause, Star, Venus } from 'lucide-react'

import { tenant } from '../lib/theme'
import BrandLogo from '../components/BrandLogo'
import { classPath, fmtRecurrence, ratingCopy, usePublicCoaches } from '../lib/classes'

// Initials for a coach with no photo.
//
// Two cases the obvious version gets wrong, both of them in this club's actual
// coach list:
//
//   "K3 & Marvin" → "KM", not "K&". The ampersand is a word here, not a
//   separator, so non-alphanumerics are stripped and the empty token dropped
//   before first letters are taken.
//
//   "Brittany" → "B", not "BR". Every coach on this timetable is listed by
//   first name only, and slicing two letters off one word gives "BR", "HE",
//   "MI" — abbreviations of nothing, which read as a truncation bug rather
//   than as initials. One name, one letter.
function initialsOf(name = '') {
  const parts = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Coaches() {
  const { coaches, loading, missing } = usePublicCoaches()
  const { hash } = useLocation()
  const scrolledFor = useRef(null)

  useEffect(() => {
    document.title = `Coaches — ${tenant.name}`
  }, [])

  // ── Deep-link scrolling, and why it cannot be left to the browser ──
  // /coaches#micah is the link the class page hands out. The browser's own
  // fragment scrolling happens once, on navigation — at which point this
  // component has rendered a loading skeleton and #micah does not exist in the
  // DOM yet. The browser finds nothing, gives up, and never retries. The
  // visitor lands at the top of a list of eight people having clicked a link
  // that promised one of them.
  //
  // So the scroll waits for the data. Keyed on the hash via a ref rather than
  // a dependency array, because `coaches` changing must be allowed to trigger
  // the first scroll but must not re-hijack the page if the list ever
  // refreshes after someone has scrolled away themselves.
  useEffect(() => {
    if (loading) return
    const id = decodeURIComponent((hash || '').replace('#', ''))
    if (!id || scrolledFor.current === id) return
    const el = document.getElementById(id)
    if (!el) return
    scrolledFor.current = id
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Focus, not just scroll. A keyboard or screen-reader user who followed
    // "Read Micah's full profile" needs the reading position moved, not only
    // the pixels — otherwise the next Tab continues from the top of the page.
    // tabIndex={-1} on the article makes it focusable without adding it to the
    // tab order for everyone else.
    el.focus({ preventScroll: true })
  }, [hash, loading, coaches])

  return (
    <div className="co">
      <style>{COACHES_CSS}</style>

      <header className="co__hero">
        <Link to="/" className="co__lockup" aria-label={`${tenant.name} — back to home`}>
          {/* Dark hero (#141414) → white wordmark. alt="" — the Link above
              already announces the club and the destination. */}
          <BrandLogo on="dark" height={24} alt="">
            <span className="co__mark">{tenant.mark}</span>
            <span className="co__wordmark">{tenant.name}</span>
          </BrandLogo>
        </Link>
      </header>

      <main className="co__wrap">
        <p className="co__eyebrow">The people who take the sessions</p>
        {/* The club's name comes from the tenant config, so this heading reads
            correctly for whichever club the deployment belongs to. */}
        <h1 className="co__title">{tenant.name} Coaches</h1>

        {loading && (
          <div className="co__skel" aria-busy="true" aria-label="Loading coaches">
            <div className="co__skelCard" />
            <div className="co__skelCard" />
          </div>
        )}

        {/* Setup state, told apart from "no coaches" on purpose: one is a SQL
            file nobody has run, the other is a table nobody has filled, and
            they need completely different actions. */}
        {!loading && missing && (
          <div className="co__note">
            <h2 className="co__noteH">Coach profiles aren&rsquo;t switched on yet</h2>
            <p>
              Run <code>supabase-classes.sql</code> then{' '}
              <code>supabase-coaches-seed.sql</code> in the Supabase SQL editor,
              and this page will fill itself in.
            </p>
          </div>
        )}

        {!loading && !missing && coaches.length === 0 && (
          <div className="co__note">
            <h2 className="co__noteH">No coach profiles yet</h2>
            <p>
              Classes still show their coach&rsquo;s name on the timetable. Full
              profiles appear here once they&rsquo;ve been added.
            </p>
          </div>
        )}

        {!loading && coaches.length > 0 && (
          <>
            <p className="co__lede">
              {coaches.length === 1
                ? 'One coach leads the sessions.'
                : `${coaches.length} coaches lead the sessions.`}{' '}
              Tap a class to see its dates and book.
            </p>

            <div className="co__list">
              {coaches.map((c) => (
                <CoachCard key={c.slug} coach={c} highlighted={hash === `#${c.slug}`} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="co__pageFoot">
        <Link to="/book">See the full timetable</Link>
      </footer>
    </div>
  )
}

function CoachCard({ coach, highlighted }) {
  const rating = ratingCopy(coach.rating_avg, coach.rating_count)
  // jsonb_agg coalesces to '[]' in SQL, so this is an array — but a defensive
  // check costs nothing and `undefined.map` is a white screen on a public page.
  const classes = Array.isArray(coach.classes) ? coach.classes : []
  const bio = (coach.bio || '').trim()

  return (
    <article
      id={coach.slug}
      // Focusable only when arrived at deliberately — see the scroll effect.
      tabIndex={-1}
      className={`co__card${highlighted ? ' is-target' : ''}`}
      aria-labelledby={`co-${coach.slug}-h`}
    >
      <div className="co__head">
        {coach.photo_url ? (
          // The DB refuses any photo_url that is not https:// (the
          // coaches_photo_https CHECK), so this cannot become a mixed-content
          // or javascript: src. loading="lazy" because eight portraits below
          // the fold should not delay the first one.
          <img
            className="co__avatar"
            src={coach.photo_url}
            alt={coach.name}
            loading="lazy"
            width="72"
            height="72"
          />
        ) : (
          // aria-hidden: the initials are a visual stand-in for a photo, and
          // announcing "MI" before the coach's actual name is noise.
          <div className="co__avatar co__avatar--initials" aria-hidden="true">
            {initialsOf(coach.name)}
          </div>
        )}

        <div className="co__headText">
          <h2 className="co__name" id={`co-${coach.slug}-h`}>
            {coach.name}
          </h2>
          {coach.credentials && <p className="co__creds">{coach.credentials}</p>}
          {rating && (
            <p className="co__rating">
              <Star size={13} aria-hidden="true" />
              {/* The visible text is "4.3 · 3 ratings"; the label spells out
                  what the number means, since "4.3" alone tells a screen
                  reader nothing. */}
              <span aria-label={`Rated ${rating.avg} out of 5 from ${rating.count} ratings`}>
                {rating.label}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Rendered only when there is a bio. An empty <p> leaves a gap that
          reads as a loading failure rather than as "not written yet". */}
      {bio && <p className="co__bio">{bio}</p>}

      {/* A coach with no classes on the timetable. Says so, rather than
          rendering a name floating in white space — which is what this looked
          like in testing, and reads as a page that failed to load half a card.
          It happens for real: a coach between blocks, or one added before
          their class is. */}
      {classes.length === 0 && (
        <p className="co__none">Not on the current timetable.</p>
      )}

      {classes.length > 0 && (
        <div className="co__classes">
          <h3 className="co__classesH">
            {classes.length === 1 ? 'Leads' : `Leads ${classes.length} classes`}
          </h3>
          <ul className="co__classList">
            {classes.map((cl) => (
              <li key={cl.slug}>
                {/* Straight to the class's own page, where the dates and the
                    booking live. This is the link that turns a bio into a
                    booking, which is the only reason this page earns its
                    place. */}
                <Link className="co__classLink" to={classPath(cl.slug)}>
                  <span className="co__className">{cl.name}</span>
                  <span className="co__classMeta">
                    <CalendarDays size={12} aria-hidden="true" />
                    {fmtRecurrence(cl.recurrence_day, cl.recurrence_time)}
                  </span>
                  {cl.location && (
                    <span className="co__classMeta">
                      <MapPin size={12} aria-hidden="true" />
                      {cl.location}
                    </span>
                  )}
                  {cl.female_only && (
                    <span className="co__tag">
                      <Venus size={11} aria-hidden="true" /> Women only
                    </span>
                  )}
                  {/* A paused class stays listed with its state shown.
                      Hiding it reads as "cancelled" to a member who knows it
                      exists — the same rule the timetable follows. */}
                  {cl.is_paused && (
                    <span className="co__tag co__tag--paused">
                      <Pause size={11} aria-hidden="true" /> Paused
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

const COACHES_CSS = `
.co {
  /* svh, with vh as the fallback — see .bk on the timetable. */
  min-height: 100vh;
  min-height: 100svh;
  background: var(--bg);
  color: var(--ink);
  padding-bottom: 72px;
}
.co__hero {
  background: var(--sidebar-bg, #141414);
  padding: 20px 24px;
  position: relative;
}
.co__hero::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  background: var(--accent);
}
.co__lockup {
  display: inline-flex; align-items: center; gap: 10px;
  text-decoration: none; color: #fff; min-height: 44px;
  transition: opacity 200ms ease;
}
.co__lockup:hover { opacity: 0.72; }
.co__mark {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--accent); color: #fff;
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 700; font-size: 15px;
}
.co__wordmark {
  font-family: var(--font-display); font-weight: 700; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.14em;
}

.co__wrap { max-width: 720px; margin: 0 auto; padding: 36px 20px 0; }

.co__eyebrow {
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--accent-ink); margin: 0 0 10px;
}
.co__title {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(28px, 6.5vw, 40px); line-height: 1.06;
  text-transform: uppercase; margin: 0 0 14px;
}
.co__lede {
  margin: 0 0 26px; font-size: 15px; line-height: 1.6;
  color: var(--ink-soft, #5c5852);
}

.co__list { display: grid; gap: 16px; }

.co__card {
  background: var(--surface, #fff);
  border: 1px solid var(--line, #e3ded5);
  border-radius: 16px;
  padding: 20px;
  /* scroll-margin so a deep-linked card lands below the sticky header rather
     than tucked underneath it. */
  scroll-margin-top: 20px;
  transition: border-color 220ms ease, box-shadow 220ms ease;
}
.co__card:focus-visible,
.co__card.is-target {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
  outline: none;
}

.co__head { display: flex; gap: 14px; align-items: flex-start; }
.co__avatar {
  width: 72px; height: 72px; border-radius: 50%;
  object-fit: cover; flex: none;
  background: var(--bg-soft, #ece7de);
}
.co__avatar--initials {
  display: grid; place-items: center;
  font-family: var(--font-display); font-weight: 700; font-size: 22px;
  color: var(--accent-ink); letter-spacing: 0.04em;
  border: 1px solid var(--line, #e3ded5);
}
.co__headText { min-width: 0; padding-top: 2px; }
.co__name {
  font-family: var(--font-display); font-weight: 700;
  font-size: 20px; line-height: 1.2; margin: 0;
}
.co__creds {
  margin: 4px 0 0; font-size: 13px; color: var(--ink-soft, #5c5852);
}
.co__rating {
  margin: 7px 0 0; display: inline-flex; align-items: center; gap: 5px;
  font-size: 13px; font-weight: 600; color: var(--accent-ink);
}

.co__bio {
  margin: 16px 0 0; font-size: 15px; line-height: 1.62;
  color: var(--ink);
}

.co__none {
  margin: 14px 0 0; font-size: 13px; font-style: italic;
  color: var(--ink-soft, #5c5852);
}
.co__classes { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line, #e3ded5); }
.co__classesH {
  font-family: var(--font-display); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--ink-soft, #5c5852); margin: 0 0 10px;
}
.co__classList { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.co__classLink {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
  padding: 12px 14px; min-height: 44px;
  border: 1px solid var(--line, #e3ded5); border-radius: 11px;
  background: var(--bg, #f3efe8);
  text-decoration: none; color: inherit;
  transition: border-color 180ms ease, transform 180ms ease;
}
.co__classLink:hover { border-color: var(--accent); transform: translateY(-1px); }
.co__className { font-weight: 700; font-size: 14px; }
.co__classMeta {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12.5px; color: var(--ink-soft, #5c5852);
}
.co__tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-ink);
}
.co__tag--paused {
  background: color-mix(in srgb, #b26a00 16%, transparent); color: #7a4a00;
}

.co__note {
  background: var(--surface, #fff);
  border: 1px solid var(--line, #e3ded5);
  border-left: 3px solid var(--accent);
  border-radius: 12px; padding: 18px 20px;
}
.co__noteH {
  font-family: var(--font-display); font-weight: 700; font-size: 16px;
  margin: 0 0 8px;
}
.co__note p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--ink-soft, #5c5852); }
.co__note code {
  font-size: 12.5px; padding: 2px 6px; border-radius: 5px;
  background: var(--bg-soft, #ece7de);
}

.co__skel { display: grid; gap: 16px; }
.co__skelCard {
  height: 168px; border-radius: 16px;
  background: var(--surface, #fff);
  border: 1px solid var(--line, #e3ded5);
  animation: coPulse 1.4s ease-in-out infinite;
}
@keyframes coPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
/* Respect a reduced-motion preference: a pulsing block is decoration, and for
   some people it is a trigger. */
@media (prefers-reduced-motion: reduce) {
  .co__skelCard { animation: none; }
  .co__classLink:hover { transform: none; }
}

.co__pageFoot {
  max-width: 720px; margin: 34px auto 0; padding: 0 20px;
  font-size: 13px;
}
.co__pageFoot a { color: var(--accent-ink); }
`
