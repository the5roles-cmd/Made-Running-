// Social Events — calendar of everything the club puts on OUTSIDE the weekly run.
// Sessions (the weekly group runs) live on Sessions.jsx. This page is for socials,
// talks, race trips, charity events, brand launches, workshops etc.
//
// Data comes from the seeded demo stub in src/lib/events.js — no Supabase table
// is required. See the SWAP POINT comment in that file for the production path.
import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Clock,
  Users,
  X,
  Ticket,
} from 'lucide-react'
import { PageHead, Empty } from '../components/ui'
import {
  fetchSocialEvents,
  eventsForMonth,
  eventsForDay,
  typeForValue,
} from '../lib/events.js'

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function todayMidnight() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function isPast(date) {
  return new Date(date) < todayMidnight()
}

function isToday(year, month, day) {
  const t = todayMidnight()
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
}

// Build the 6-row × 7-col grid for a given month, starting on Monday.
function buildCalendarGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  // JS getDay(): 0=Sun … 6=Sat. We want Mon=0 offset.
  const rawDow = firstOfMonth.getDay()
  const mondayOffset = (rawDow + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  // Leading blanks
  for (let i = 0; i < mondayOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Trailing blanks to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ── Type colour pill ───────────────────────────────────────────────────────

function TypeChip({ type }) {
  const meta = typeForValue(type)
  return (
    <span
      className="chip"
      style={{
        background: meta.color + '18',
        color: meta.color,
        border: '1px solid ' + meta.color + '30',
        fontWeight: 600,
        fontSize: 'var(--fs-xs)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {meta.label}
    </span>
  )
}

// ── Event detail panel ─────────────────────────────────────────────────────

function EventDetail({ event, onClose }) {
  if (!event) return null
  const past = isPast(event.date)
  return (
    <div
      className="card card--raised"
      style={{
        position: 'relative',
        borderTop: '3px solid ' + typeForValue(event.type).color,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close event detail"
        style={{
          position: 'absolute',
          top: 'var(--s3)',
          right: 'var(--s3)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          minHeight: 44,
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <X size={18} />
      </button>

      <div className="stack" style={{ gap: 'var(--s3)', paddingRight: 'var(--s7)' }}>
        <div>
          <TypeChip type={event.type} />
          {past && (
            <span
              className="chip"
              style={{ marginLeft: 'var(--s2)', opacity: 0.6, fontSize: 'var(--fs-xs)' }}
            >
              Past
            </span>
          )}
        </div>

        <h2
          className="display"
          style={{ fontSize: 'var(--fs-lg)', color: 'var(--ink)', margin: 0 }}
        >
          {event.title}
        </h2>

        <p
          className="muted"
          style={{ fontSize: 'var(--fs-sm)', marginInline: 'auto', maxWidth: 'none' }}
        >
          {event.description}
        </p>

        <div
          className="stack"
          style={{ gap: 'var(--s2)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s3)' }}
        >
          <div className="rowflex" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
            <CalendarDays size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>{fmtDate(event.date)}</span>
          </div>
          <div className="rowflex" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
            <Clock size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>
              {event.startTime}
              {event.endTime ? ` – ${event.endTime}` : ''}
            </span>
          </div>
          <div className="rowflex" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
            <MapPin size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>{event.location}</span>
          </div>
          {event.chapter && (
            <div className="rowflex" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
              <Users size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--fs-sm)' }}>{event.chapter}</span>
            </div>
          )}
          <div className="rowflex" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
            <Ticket size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>
              {event.isFree ? 'Free' : `£${event.price}`}
              {event.capacity != null
                ? ` · ${event.going}/${event.capacity} going`
                : ` · ${event.going} going`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Upcoming event row ─────────────────────────────────────────────────────

function UpcomingRow({ event, isSelected, onClick }) {
  const meta = typeForValue(event.type)
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--s3)',
        padding: 'var(--s3) var(--s4)',
        borderRadius: 'var(--radius)',
        border: isSelected
          ? '1px solid ' + meta.color + '60'
          : '1px solid transparent',
        background: isSelected ? meta.color + '0d' : 'transparent',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'background var(--dur) var(--ease), border-color var(--dur) var(--ease)',
        minHeight: 44,
        textDecoration: 'none',
      }}
    >
      {/* Date stamp */}
      <div
        style={{
          flexShrink: 0,
          width: 42,
          textAlign: 'center',
          paddingTop: 2,
        }}
      >
        <div
          style={{
            fontSize: 'var(--fs-xl)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: meta.color,
            lineHeight: 1,
          }}
        >
          {new Date(event.date).getDate()}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 2 }}>
          {new Date(event.date).toLocaleDateString('en-GB', { month: 'short' })}
        </div>
      </div>

      {/* Colour bar */}
      <div
        style={{
          width: 3,
          borderRadius: 999,
          background: meta.color,
          alignSelf: 'stretch',
          flexShrink: 0,
          minHeight: 36,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 'var(--fs-sm)',
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.title}
        </div>
        <div
          className="muted"
          style={{ fontSize: 'var(--fs-xs)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {event.startTime} · {event.location}
        </div>
        <div style={{ marginTop: 4 }}>
          <TypeChip type={event.type} />
        </div>
      </div>
    </button>
  )
}

// ── Calendar grid ──────────────────────────────────────────────────────────

function CalendarGrid({ year, month, events, selectedEvent, onSelectEvent }) {
  const cells = buildCalendarGrid(year, month)

  return (
    <div>
      {/* Day headers — fixed 7 columns, no overflow */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 1,
          marginBottom: 'var(--s1)',
        }}
      >
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="eyebrow"
            style={{
              textAlign: 'center',
              padding: 'var(--s2) 0',
              fontSize: 'var(--fs-xs)',
              letterSpacing: '0.06em',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 1,
          background: 'var(--line)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={'blank-' + idx}
                style={{ background: 'var(--bg-2)', minHeight: 60, padding: 'var(--s2)' }}
              />
            )
          }

          const dayEvents = eventsForDay(events, year, month, day)
          const todayCell = isToday(year, month, day)
          const hasSelected = dayEvents.some((e) => e.id === selectedEvent?.id)

          return (
            <div
              key={day}
              style={{
                background: hasSelected
                  ? 'var(--accent-soft)'
                  : todayCell
                  ? 'var(--surface-raised)'
                  : 'var(--surface)',
                minHeight: 60,
                padding: 'var(--s1)',
                cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                position: 'relative',
              }}
              onClick={() => {
                if (dayEvents.length > 0) {
                  const first = dayEvents[0]
                  onSelectEvent(selectedEvent?.id === first.id ? null : first)
                }
              }}
              role={dayEvents.length > 0 ? 'button' : undefined}
              tabIndex={dayEvents.length > 0 ? 0 : undefined}
              aria-label={
                dayEvents.length > 0
                  ? `${day} ${MONTH_NAMES[month]}: ${dayEvents.map((e) => e.title).join(', ')}`
                  : undefined
              }
              onKeyDown={(ev) => {
                if (dayEvents.length > 0 && (ev.key === 'Enter' || ev.key === ' ')) {
                  const first = dayEvents[0]
                  onSelectEvent(selectedEvent?.id === first.id ? null : first)
                }
              }}
            >
              {/* Day number */}
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: todayCell ? 700 : 400,
                  color: todayCell ? 'var(--accent-contrast)' : 'var(--ink)',
                  background: todayCell ? 'var(--accent)' : 'transparent',
                  marginBottom: 'var(--s1)',
                }}
              >
                {day}
              </div>

              {/* Event dots / labels */}
              {dayEvents.slice(0, 3).map((ev) => {
                const meta = typeForValue(ev.type)
                return (
                  <div
                    key={ev.id}
                    style={{
                      background: meta.color,
                      color: '#fff',
                      fontSize: '0.62rem',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 4px',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    {ev.title}
                  </div>
                )
              })}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', paddingLeft: 2 }}>
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Events() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [allEvents, setAllEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSocialEvents().then((data) => {
      setAllEvents(data)
      setLoading(false)
    })
  }, [])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
    setSelectedEvent(null)
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
    setSelectedEvent(null)
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedEvent(null)
  }

  // Events visible in the current calendar month
  const monthEvents = eventsForMonth(allEvents, viewYear, viewMonth)

  // Upcoming (future or today) across ALL months for the sidebar list
  const upcomingEvents = allEvents
    .filter((e) => new Date(e.date) >= todayMidnight())
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  return (
    <div className="page">
      <PageHead
        eyebrow="Community"
        title="Social Events"
        sub="Socials, talks, race trips, brand collabs, and charity nights."
      />

      {loading ? (
        <div className="card" style={{ padding: 'var(--s7)', textAlign: 'center' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Loading events…</span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 'var(--s5)',
          }}
        >
          {/* ── Top: calendar + detail side-by-side on wide screens ───── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 'var(--s5)',
            }}
          >
            {/* Calendar card */}
            <div className="card card--raised" style={{ minWidth: 0 }}>
              {/* Month nav */}
              <div
                className="rowflex"
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--s4)',
                  gap: 'var(--s3)',
                  flexWrap: 'wrap',
                }}
              >
                <h2
                  className="display"
                  style={{ fontSize: 'var(--fs-lg)', margin: 0 }}
                >
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </h2>
                <div className="rowflex" style={{ gap: 'var(--s2)' }}>
                  {!isCurrentMonth && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={goToday}
                      style={{ minHeight: 44 }}
                    >
                      Today
                    </button>
                  )}
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={prevMonth}
                    aria-label="Previous month"
                    style={{ minHeight: 44, minWidth: 44, padding: '0 var(--s2)' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={nextMonth}
                    aria-label="Next month"
                    style={{ minHeight: 44, minWidth: 44, padding: '0 var(--s2)' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <CalendarGrid
                year={viewYear}
                month={viewMonth}
                events={monthEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
              />

              {monthEvents.length === 0 && (
                <div style={{ marginTop: 'var(--s5)' }}>
                  <Empty
                    icon={CalendarDays}
                    title="No events this month"
                    hint="Nothing scheduled — check a neighbouring month or scroll the upcoming list."
                  />
                </div>
              )}
            </div>

            {/* Event detail — shown inline below calendar when an event is selected */}
            {selectedEvent && (
              <EventDetail
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
              />
            )}
          </div>

          {/* ── Upcoming list ──────────────────────────────────────────── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: 'var(--s4) var(--s5)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span className="eyebrow">Upcoming</span>
            </div>

            {upcomingEvents.length === 0 ? (
              <div style={{ padding: 'var(--s5)' }}>
                <Empty
                  icon={CalendarDays}
                  title="No upcoming events"
                  hint="Nothing in the calendar yet."
                />
              </div>
            ) : (
              <div
                className="stack"
                style={{ gap: 0, padding: 'var(--s2)' }}
              >
                {upcomingEvents.map((ev) => (
                  <UpcomingRow
                    key={ev.id}
                    event={ev}
                    isSelected={selectedEvent?.id === ev.id}
                    onClick={() => {
                      const next = selectedEvent?.id === ev.id ? null : ev
                      setSelectedEvent(next)
                      if (next) {
                        const d = new Date(next.date)
                        setViewYear(d.getFullYear())
                        setViewMonth(d.getMonth())
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
