// ============================================================
// Profile — the RUNNER's own screen, and the first thing a member sees after
// signing in (`/app` index).
//
// This is deliberately not a dashboard. A dashboard answers "how is the club
// doing", which is a coach's question; a member logging in wants to answer
// "am I down for this week's runs, and what have I actually done lately".
// Those are different products sharing a database, so they get different
// screens — see ROLE_NAV in constants.js for the other half of that split.
//
// Everything here is first-person and derived from the member's own
// attendance rows. There is no club-wide number on this page on purpose.
// ============================================================
import { useState } from 'react'
import { Check, Clock3, Flame, MapPin, Route, Timer } from 'lucide-react'

import { PageHead, Empty } from '../components/ui'
import SetupNotice from '../components/SetupNotice'
import { useAuth } from '../auth/AuthProvider'
import { useMyRunner } from '../lib/useMyRunner'
import {
  formatDayDate,
  formatDuration,
  formatKm,
  formatMiles,
  formatPace,
  formatTime,
  parseDuration,
  startOfWeek,
  thisWeekRuns,
} from '../lib/schedule'

// "15 km · 9.3 mi". Both units, always, rather than a unit toggle nobody
// finds: a UK running club talks in kilometres for the distance and miles for
// the bragging, and the conversion is free.
function Distance({ km }) {
  return (
    <>
      {formatKm(km)} km <span className="faint">· {formatMiles(km)} mi</span>
    </>
  )
}

// One period card. Four of these render from a loop instead of four
// near-identical blocks, so a change to the shape can only happen once.
function Period({ label, data }) {
  return (
    <div className="period">
      <div className="eyebrow">{label}</div>
      <div className="period__value">{data.runs}</div>
      <div className="period__sub">
        {data.runs === 1 ? 'run' : 'runs'} · <Distance km={data.km} />
      </div>
      {data.best && (
        <div className="period__sub mono" style={{ marginTop: 'var(--s2)', color: 'var(--accent-ink)' }}>
          best {formatDuration(data.best)}
        </div>
      )}
    </div>
  )
}

// The inline "log your time" control. Lives inside a day row and only ever
// writes to that day's own attendance record.
function TimeForm({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial ? formatDuration(initial) : '')
  const parsed = parseDuration(value)
  const invalid = value.trim() !== '' && parsed === null

  return (
    <form
      className="timeform"
      onSubmit={(e) => {
        e.preventDefault()
        // An empty box saves null — clearing a mistyped time has to be
        // possible, or the first fat-fingered entry is permanent.
        if (invalid) return
        onSave(parsed)
      }}
    >
      <input
        className="input"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="32:40"
        inputMode="numeric"
        aria-label="Your finish time, minutes and seconds"
        aria-invalid={invalid || undefined}
        style={invalid ? { borderColor: 'var(--danger)' } : undefined}
      />
      <button className="btn btn--primary btn--sm" type="submit" disabled={invalid}>
        Save
      </button>
      <button className="btn btn--ghost btn--sm" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

function RunDay({ run, record, pending, timesEnabled, onCheckIn, onSaveTime }) {
  const [editing, setEditing] = useState(false)
  const done = Boolean(record)
  const busy = pending === run.key

  const state = done ? 'done' : run.isUpcoming ? 'upcoming' : 'open'

  return (
    <div className={`runday runday--${state}`}>
      {/* Icon stroke weights on this app are a two-value rule, not a free
          parameter: 2 (lucide's default) for every functional icon, and 1.4
          for the single oversized decorative glyph in <Empty>. A 20px tick
          reversed out of a solid accent circle is tempting to thicken —
          white-on-colour optically thins — but at 20px it is already the
          largest functional icon on the page, and bumping it to 2.5 made the
          weights non-monotonic against size (12px→2, 20px→2.5, 24px→1.4).
          The filled circle carries the emphasis; the stroke doesn't need to. */}
      <div className="runday__mark" aria-hidden="true">
        {done ? <Check size={20} /> : run.short}
      </div>

      <div>
        <div className="runday__day">
          {run.label}
          {run.isToday && (
            <span className="badge badge--accent" style={{ marginLeft: 'var(--s2)' }}>
              Today
            </span>
          )}
        </div>
        <div className="runday__meta">
          <span>{formatTime(run.startsAt)}</span>
          <span>{formatKm(run.distanceKm)}k</span>
          <span>{formatDayDate(run.startsAt)}</span>
        </div>
        <div className="runday__meta faint" style={{ marginTop: 2 }}>
          <MapPin size={12} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          {run.location}
        </div>
      </div>

      <div className="runday__action">
        {editing ? (
          <TimeForm
            initial={record?.duration_seconds}
            onCancel={() => setEditing(false)}
            onSave={(seconds) => {
              onSaveTime(record.id, seconds)
              setEditing(false)
            }}
          />
        ) : done ? (
          <div className="rowflex" style={{ gap: 'var(--s3)', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'right' }}>
              {record.duration_seconds ? (
                <>
                  <div className="runday__time">{formatDuration(record.duration_seconds)}</div>
                  <div className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 3 }}>
                    {formatPace(record.duration_seconds, run.distanceKm)}
                  </div>
                </>
              ) : (
                <div className="faint" style={{ fontSize: 'var(--fs-sm)' }}>Checked in</div>
              )}
            </div>
            {timesEnabled && (
              <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                <Timer size={14} />
                {record.duration_seconds ? 'Edit' : 'Add time'}
              </button>
            )}
          </div>
        ) : run.isUpcoming ? (
          // Not a disabled button — a disabled control invites you to keep
          // pressing it. Saying when it opens answers the question instead.
          <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
            <Clock3 size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Opens {run.label}
          </span>
        ) : (
          <button className="btn btn--primary" onClick={() => onCheckIn(run)} disabled={busy}>
            {busy ? 'Saving…' : 'Check in'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const {
    runner,
    loading,
    error,
    pending,
    timesEnabled,
    checkIn,
    saveTime,
    attendedThisWeek,
    rows,
    streak,
    periods,
  } = useMyRunner()

  const week = thisWeekRuns()
  const weekStart = startOfWeek()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const name = runner?.title || user?.user_metadata?.full_name || user?.email || 'Runner'
  const recent = rows.filter((r) => r.at < weekStart).slice(0, 6)

  return (
    <div className="page">
      <PageHead
        eyebrow="My profile"
        title={name}
        sub={
          loading
            ? 'Loading your runs…'
            : `${periods.allTime.runs} run${periods.allTime.runs === 1 ? '' : 's'} · ${formatKm(
                periods.allTime.km,
              )} km logged${streak ? ` · ${streak} week streak` : ''}`
        }
      >
        {streak > 1 && (
          <span className="badge badge--accent">
            <Flame size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            {streak} weeks
          </span>
        )}
      </PageHead>

      <SetupNotice />

      {error && (
        <div className="notice" style={{ borderColor: 'var(--danger)', marginBottom: 'var(--s5)' }}>
          <strong>Couldn’t save that.</strong>{' '}
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{error}</span>
        </div>
      )}

      {/* ── This week ─────────────────────────────────────── */}
      <section style={{ marginBottom: 'var(--s7)' }}>
        <div className="spread" style={{ marginBottom: 'var(--s4)' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>
            This week
          </h2>
          <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>
            {formatDayDate(weekStart)} – {formatDayDate(weekEnd)}
          </span>
        </div>

        <div className="runweek">
          {week.map((run) => (
            <RunDay
              key={run.key}
              run={run}
              record={attendedThisWeek[run.key]}
              pending={pending}
              timesEnabled={timesEnabled}
              onCheckIn={checkIn}
              onSaveTime={saveTime}
            />
          ))}
        </div>

        {!timesEnabled && !loading && (
          // Honest about a missing capability rather than silently hiding it.
          // The fix is one line of SQL and this is the only place anyone
          // would think to look for why the field isn't there.
          <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s3)' }}>
            Finish times are off — run <code>supabase-run-times.sql</code> in the Supabase SQL
            editor to turn them on. Check-ins work either way.
          </p>
        )}
      </section>

      {/* ── Past activity ─────────────────────────────────── */}
      <section style={{ marginBottom: 'var(--s7)' }}>
        <h2 className="display" style={{ fontSize: 'var(--fs-lg)', margin: '0 0 var(--s4)' }}>
          Your running
        </h2>
        <div className="periodgrid">
          <Period label="This week" data={periods.thisWeek} />
          <Period label="Last week" data={periods.lastWeek} />
          <Period label="Last 30 days" data={periods.last30} />
          <Period label="All time" data={periods.allTime} />
        </div>
      </section>

      {/* ── Earlier runs ──────────────────────────────────── */}
      <section>
        <h2 className="display" style={{ fontSize: 'var(--fs-lg)', margin: '0 0 var(--s4)' }}>
          Earlier runs
        </h2>
        {recent.length === 0 ? (
          <Empty
            icon={Route}
            title={loading ? 'Loading…' : 'Nothing before this week'}
            hint="Runs from previous weeks show up here once you have some."
          />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Date</th>
                  <th>Distance</th>
                  <th style={{ textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.day?.title || 'Club run'}</td>
                    <td className="muted">
                      {r.at.toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="muted">{formatKm(r.day?.distanceKm ?? 5)} km</td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {r.duration_seconds ? (
                        formatDuration(r.duration_seconds)
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
