// The Gym — the club's weekly class + event timetable (Module A · Community).
//
// This is the page formerly called "The Hub". Same `sessions` table, same
// org scoping; what changed is the SHAPE of the answer it gives.
//
// The old page was a flat table sorted by starts_at, which meant a member
// asking "what's on Tuesday?" had to read every row and do the date maths
// themselves — and a RECURRING class showed exactly once, at whatever
// timestamp it was first created, then slid into the past and disappeared.
// The `recurring` boolean existed on the table and nothing read it.
//
// A gym timetable is a weekly grid, so this page is one: pick a week, see
// seven days, each with the classes that fall on it. Recurring sessions are
// PROJECTED onto whichever week you're looking at (same weekday, same
// clock time); one-off events appear only in their own week. That single
// change is what makes eight seeded classes fill every week forever
// instead of needing a row per class per week.
//
// Booking is deliberately NOT done here. The public booking flow lives at
// /book (BookGym.jsx → list_gym_classes / book_gym_session RPCs, Stripe
// Checkout), and the club's live one is at sutekwellness.com/book. Sending
// members there rather than rebuilding a second, logged-in booking form
// keeps ONE seat-allocation path — two would race each other for the last
// mat, and only one of them would be taking payment.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Plus, Repeat, MapPin, ExternalLink } from 'lucide-react'

import Modal from '../components/Modal'
import SetupNotice from '../components/SetupNotice'
import { PageHead, Empty, Loading } from '../components/ui'
import { GYM_TIMETABLE_TYPES, isStaffRole } from '../lib/constants'
import { useList, useInsert } from '../lib/useData'
import { useAuth } from '../auth/AuthProvider'

// The club's real, public booking page. External on purpose — see the
// header note. Kept as a named constant so there is exactly one place to
// change it when the booking provider changes.
export const BOOKING_URL = 'https://sutekwellness.com/book'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const EMPTY_FORM = {
  title: '',
  type: GYM_TIMETABLE_TYPES[0]?.value || 'hub_training',
  chapter_id: '',
  starts_at: '',
  location: '',
  capacity: '',
  recurring: true, // a gym class is recurring far more often than not
}

// ── Week maths ───────────────────────────────────────────────
// Weeks run Monday→Sunday. getDay() returns 0 for Sunday, so the shift is
// (day + 6) % 7 rather than (day - 1): that maps Sun→6 and Mon→0 without a
// negative branch.
function startOfWeek(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtTime(d) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtRange(monday) {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const a = monday.toLocaleDateString('en-GB', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const b = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${a} – ${b}`
}

function typeLabel(v) {
  return GYM_TIMETABLE_TYPES.find((t) => t.value === v)?.label || v
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
function money(pennies) {
  if (!pennies) return 'Free'
  return gbp.format(pennies / 100)
}

/**
 * Place every session onto the seven days of the week beginning `monday`.
 *
 * Two kinds of row, handled differently on purpose:
 *   recurring — its starts_at is a TEMPLATE, not an appointment. We keep
 *               the weekday and clock time and move the date into the
 *               displayed week, so it appears every week from its start
 *               date onwards. Weeks BEFORE it was created stay empty,
 *               because a class that didn't exist yet shouldn't appear to
 *               have run.
 *   one-off   — a real appointment. Shown only in its own week.
 *
 * Sessions with no starts_at at all are dropped rather than defaulted to
 * midnight: "Mon 00:00" on a timetable is a lie, and an unscheduled class
 * belongs in the staff list, not on a member's week view.
 *
 * @param {Array} sessions
 * @param {Date} monday - start of the displayed week
 * @returns {Array<{ date: Date, name: string, items: Array }>} seven entries
 */
function buildWeek(sessions, monday) {
  const days = DAY_NAMES.map((name, i) => ({ date: addDays(monday, i), name, items: [] }))

  for (const s of sessions) {
    if (!s.starts_at) continue
    const src = new Date(s.starts_at)
    if (Number.isNaN(src.getTime())) continue

    if (s.recurring) {
      const idx = (src.getDay() + 6) % 7
      const slot = days[idx]
      // Don't back-date a recurring class into weeks before it started.
      // Compare against the START of that day so a 19:00 class created on
      // the same day still shows.
      const dayStart = new Date(slot.date)
      const srcDayStart = new Date(src)
      srcDayStart.setHours(0, 0, 0, 0)
      if (dayStart < srcDayStart) continue

      const when = new Date(slot.date)
      when.setHours(src.getHours(), src.getMinutes(), 0, 0)
      slot.items.push({ ...s, _when: when })
    } else {
      const slot = days.find((d) => sameDay(d.date, src))
      if (slot) slot.items.push({ ...s, _when: src })
    }
  }

  for (const d of days) d.items.sort((a, b) => a._when - b._when)
  return days
}

export default function Gym() {
  const navigate = useNavigate()
  const { effectiveRole } = useAuth()
  const staff = isStaffRole(effectiveRole)

  const { rows, loading, refresh } = useList('sessions', {
    order: 'starts_at',
    ascending: true,
    select: '*, chapters(name)',
  })
  const { rows: chapters } = useList('chapters', { order: 'name', ascending: true })
  const { rows: allAttendance } = useList('attendance', { order: 'attended_at', ascending: false })
  const insert = useInsert('sessions')

  const gymValues = GYM_TIMETABLE_TYPES.map((t) => t.value)
  const sessions = useMemo(
    () => rows.filter((s) => gymValues.includes(s.type)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  )

  // Week navigation. `offset` is in weeks from the current one, so "Today"
  // is just offset = 0 rather than a second piece of state to keep in sync.
  const [offset, setOffset] = useState(0)
  const thisMonday = useMemo(() => startOfWeek(new Date()), [])
  const monday = useMemo(() => addDays(thisMonday, offset * 7), [thisMonday, offset])
  const days = useMemo(() => buildWeek(sessions, monday), [sessions, monday])
  const today = new Date()

  const weekCount = days.reduce((n, d) => n + d.items.length, 0)

  function bookedCount(sessionId) {
    return allAttendance.filter((a) => a.session_id === sessionId).length
  }

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  function openModal() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function set(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await insert({
        title: form.title.trim(),
        type: form.type,
        chapter_id: form.chapter_id || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        location: form.location || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        recurring: !!form.recurring,
      })
      await refresh()
      setOpen(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = form.title.trim().length > 0 && !saving

  return (
    <div className="page">
      <SetupNotice />

      <PageHead
        eyebrow="Community"
        title="The Gym"
        sub="Classes and events, every week. Pick a slot and book your place."
      >
        {staff && (
          <button className="btn btn--ghost" onClick={openModal} style={{ minHeight: 44 }}>
            <Plus size={16} />
            New class
          </button>
        )}
        {/* External on purpose — the club's live booking + payment page.
            target=_blank so a member doesn't lose their place in the app;
            rel=noreferrer because target=_blank without it hands the new
            tab a window.opener reference back into this session. */}
        <a
          className="btn btn--primary"
          href={BOOKING_URL}
          target="_blank"
          rel="noreferrer"
          style={{ minHeight: 44 }}
        >
          <CalendarDays size={16} />
          Book a class
        </a>
      </PageHead>

      {/* ── Week bar ──────────────────────────────────────────
          Sticky at the top of the scroll area: on a phone the timetable is
          taller than the viewport, and losing the "which week am I in?"
          label three days down is exactly how someone books the wrong
          Tuesday. */}
      <div
        className="card gym-weekbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--s3)',
          padding: 'var(--s3) var(--s4)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <button
          className="btn btn--ghost"
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Previous week"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            {offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `${Math.abs(offset)} weeks ${offset > 0 ? 'ahead' : 'ago'}`}
          </div>
          <div className="display" style={{ fontSize: 'var(--fs-md)', whiteSpace: 'nowrap' }}>
            {fmtRange(monday)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          {offset !== 0 && (
            <button
              className="btn btn--ghost"
              onClick={() => setOffset(0)}
              style={{ minHeight: 44 }}
            >
              Today
            </button>
          )}
          <button
            className="btn btn--ghost"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Next week"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <div className="card">
          <Empty
            icon={Dumbbell}
            title="No classes on the timetable yet"
            hint={
              staff
                ? 'Add your first class — tick “Repeats weekly” and it will appear every week.'
                : 'The timetable is being set up. Book directly in the meantime.'
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          {weekCount === 0 && (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Nothing scheduled this week. Try the arrows above.
            </p>
          )}

          {days.map((day) => {
            const isToday = sameDay(day.date, today)
            const past = day.date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
            // Empty days are hidden rather than rendered as seven "—" rows:
            // on a phone that is most of a screen of nothing between the two
            // classes someone actually came to find.
            if (day.items.length === 0) return null

            return (
              <section key={day.date.toISOString()} className="stack" style={{ gap: 'var(--s2)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--s2)',
                    opacity: past ? 0.55 : 1,
                  }}
                >
                  <h2
                    className="display"
                    style={{ fontSize: 'var(--fs-md)', margin: 0 }}
                  >
                    {day.name}
                  </h2>
                  <span className="muted mono" style={{ fontSize: 'var(--fs-sm)' }}>
                    {day.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && <span className="chip chip--accent">Today</span>}
                </div>

                <div className="stack" style={{ gap: 'var(--s2)' }}>
                  {day.items.map((s) => {
                    const booked = bookedCount(s.id)
                    const full = s.capacity != null && booked >= s.capacity
                    return (
                      <article
                        key={`${s.id}-${day.date.toISOString()}`}
                        className="card gym-slot"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--s4)',
                          padding: 'var(--s3) var(--s4)',
                          opacity: past ? 0.55 : 1,
                        }}
                      >
                        {/* Time is the first thing scanned on a timetable,
                            so it gets the mono face and a fixed column —
                            proportional digits make a stack of times look
                            ragged even when they're all four characters. */}
                        <div
                          className="mono display"
                          style={{ fontSize: 'var(--fs-md)', minWidth: '4.5rem' }}
                        >
                          {fmtTime(s._when)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', flexWrap: 'wrap' }}
                          >
                            <span className="display" style={{ fontSize: 'var(--fs-sm)' }}>
                              {s.title}
                            </span>
                            <span className="chip">{typeLabel(s.type)}</span>
                            {s.recurring && (
                              <span className="muted" title="Runs every week" style={{ display: 'inline-flex' }}>
                                <Repeat size={12} aria-label="Weekly" />
                              </span>
                            )}
                          </div>
                          <div
                            className="muted"
                            style={{ fontSize: 'var(--fs-xs)', display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap', marginTop: 2 }}
                          >
                            {(s.location || s.chapters?.name) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={12} />
                                {s.location || s.chapters?.name}
                              </span>
                            )}
                            <span>
                              {s.capacity != null ? `${booked} / ${s.capacity} booked` : `${booked} booked`}
                            </span>
                            {s.price_pennies != null && <span>{money(s.price_pennies)}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
                          {staff && (
                            <button
                              className="btn btn--ghost"
                              onClick={() => navigate(`/app/sessions/${s.id}`)}
                              style={{ minHeight: 44 }}
                            >
                              Register
                            </button>
                          )}
                          {/* A full class still links out rather than going
                              dead: capacity here counts check-ins, not paid
                              bookings, so this page is not the authority on
                              whether a seat is genuinely gone. The booking
                              page is — so let it say so. */}
                          <a
                            className={full ? 'btn btn--ghost' : 'btn btn--primary'}
                            href={BOOKING_URL}
                            target="_blank"
                            rel="noreferrer"
                            style={{ minHeight: 44, whiteSpace: 'nowrap' }}
                          >
                            {full ? 'Join waitlist' : 'Book'}
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New class"
        footer={
          <div className="spread">
            <button className="btn btn--ghost" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ minHeight: 44 }}
            >
              {saving ? 'Saving…' : 'Add to timetable'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--s4)' }}>
          <div className="field">
            <label className="eyebrow" htmlFor="gym-title">
              Title <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              id="gym-title"
              className="input"
              placeholder="Strength & conditioning"
              value={form.title}
              onChange={set('title')}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="gym-type">Type</label>
            <select id="gym-type" className="select" value={form.type} onChange={set('type')}>
              {GYM_TIMETABLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="gym-chapter">Chapter</label>
            <select id="gym-chapter" className="select" value={form.chapter_id} onChange={set('chapter_id')}>
              <option value="">— None —</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="gym-starts">First session</label>
            <input
              id="gym-starts"
              type="datetime-local"
              className="input"
              value={form.starts_at}
              onChange={set('starts_at')}
            />
            <p className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
              With “Repeats weekly” ticked, this sets the day and time the class
              runs every week — not a one-off date.
            </p>
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="gym-location">Location</label>
            <input
              id="gym-location"
              className="input"
              placeholder="Sutek Wellness, Manchester"
              value={form.location}
              onChange={set('location')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="gym-capacity">Capacity</label>
            <input
              id="gym-capacity"
              type="number"
              min="0"
              className="input"
              placeholder="Leave blank for uncapped"
              value={form.capacity}
              onChange={set('capacity')}
            />
          </div>

          <label className="rowflex" style={{ gap: 'var(--s2)', fontSize: 'var(--fs-sm)', minHeight: 44 }}>
            <input type="checkbox" checked={form.recurring} onChange={set('recurring')} />
            Repeats weekly
          </label>

          {err && (
            <p className="muted" style={{ color: 'var(--error, #e55)', fontSize: 'var(--fs-sm)' }}>
              {err}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
