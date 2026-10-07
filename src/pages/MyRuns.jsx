// My Runs — a member's own attendance, distance and finish times.
//
// There WAS a club-wide counterpart to this screen (Attendance.jsx) asking
// the same questions of everybody at once. It was deleted, and this one
// survived, which is the right way round: how far have I gone, am I getting
// faster, how does this week compare to the last — those are a runner's
// questions about themselves, and this is the only screen that answers them.
//
// It reads useMyRunner(), which already resolves the signed-in user to
// their `records` row by email and loads their attendance. Nothing here
// queries the database directly — a second query would be a second answer
// to "which record is mine", and the two would eventually disagree.
//
// ── The one genuinely tricky bit: for a TIME, down is good. ─────────────
// A generic delta component that paints negative red would tell a runner
// who just took 42 seconds off their PB that they had got worse. So times
// never use the percentage delta. They use an absolute difference and say
// "42s faster" / "18s slower" in words, because "-2.3%" is both correct
// and useless to someone standing in a park.
import { useMemo, useState } from 'react'
import { Footprints, TrendingUp, TrendingDown, Minus, Flame, Trophy } from 'lucide-react'

import SetupNotice from '../components/SetupNotice'
import { PageHead, Empty, Loading } from '../components/ui'
import { useMyRunner } from '../lib/useMyRunner'
import {
  DEFAULT_RUN_KM,
  formatDuration,
  formatKm,
  formatMiles,
  formatPace,
} from '../lib/schedule'

// Same three periods as Attendance.jsx, and the same bucketing rules, so a
// member and a coach are looking at the same shape of week.
const PERIODS = [
  { key: 'week', label: 'Week', days: 7, buckets: 7, bucketBy: 'day' },
  { key: 'month', label: 'Month', days: 30, buckets: 5, bucketBy: 'week' },
  { key: 'year', label: 'Year', days: 365, buckets: 12, bucketBy: 'month' },
]

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function pctChange(now, prev) {
  if (prev === 0) return now === 0 ? 0 : null
  return Math.round(((now - prev) / prev) * 100)
}

/** Percentage delta — for counts and distances, where UP is good. */
function CountDelta({ now, prev, suffix = '' }) {
  const pct = pctChange(now, prev)
  if (pct === null) {
    return <div className="stat__delta up">First time in this period</div>
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  const cls = pct > 0 ? 'stat__delta up' : pct < 0 ? 'stat__delta down' : 'stat__delta muted'
  return (
    <div className={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} aria-hidden="true" />
      {pct > 0 ? '+' : ''}
      {pct}% · was {prev}
      {suffix}
    </div>
  )
}

/**
 * Absolute delta for a finish time. Down is good, so the wording carries the
 * meaning and the colour follows the wording rather than the sign.
 * Rendered in seconds under a minute ("42s faster") and mm:ss over it, since
 * "0:42 faster" reads like a lap time rather than a saving.
 */
function TimeDelta({ now, prev, label }) {
  if (!now) return <div className="stat__delta muted">No times logged</div>
  if (!prev) return <div className="stat__delta muted">Nothing to compare with yet</div>
  const diff = prev - now // positive = faster now
  if (diff === 0) return <div className="stat__delta muted">Same as {label}</div>
  const mag = Math.abs(diff)
  const pretty = mag < 60 ? `${mag}s` : formatDuration(mag)
  const faster = diff > 0
  return (
    <div
      className={faster ? 'stat__delta up' : 'stat__delta down'}
      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
    >
      {faster ? <TrendingDown size={12} aria-hidden="true" /> : <TrendingUp size={12} aria-hidden="true" />}
      {pretty} {faster ? 'faster' : 'slower'} than {label}
    </div>
  )
}

/** Split a window into labelled buckets and total the distance in each. */
function bucketise(rows, from, period) {
  const span = period.days / period.buckets
  const out = []
  for (let i = 0; i < period.buckets; i++) {
    const bFrom = new Date(from)
    bFrom.setDate(bFrom.getDate() + Math.round(i * span))
    const bTo = new Date(from)
    bTo.setDate(bTo.getDate() + Math.round((i + 1) * span))
    const subset = rows.filter((r) => r.at >= bFrom && r.at < bTo)
    out.push({
      label:
        period.bucketBy === 'day'
          ? bFrom.toLocaleDateString('en-GB', { weekday: 'narrow' })
          : period.bucketBy === 'week'
            ? bFrom.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : bFrom.toLocaleDateString('en-GB', { month: 'narrow' }),
      title: bFrom.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      km: subset.reduce((t, r) => t + (r.day?.distanceKm ?? DEFAULT_RUN_KM), 0),
      runs: subset.length,
    })
  }
  return out
}

const summarise = (subset) => {
  const times = subset.map((r) => r.duration_seconds).filter(Boolean)
  return {
    runs: subset.length,
    km: subset.reduce((t, r) => t + (r.day?.distanceKm ?? DEFAULT_RUN_KM), 0),
    best: times.length ? Math.min(...times) : null,
    avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  }
}

export default function MyRuns() {
  const { runner, rows, streak, periods, timesEnabled, loading, error } = useMyRunner()
  const [periodKey, setPeriodKey] = useState('month')
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[1]

  const stats = useMemo(() => {
    // Window ends at the end of TODAY, not at this moment: a run logged at
    // 19:15 must not drop out of "this week" because the page was opened at
    // lunchtime.
    const end = startOfDay(new Date())
    end.setDate(end.getDate() + 1)
    const from = new Date(end)
    from.setDate(from.getDate() - period.days)
    const prevFrom = new Date(from)
    prevFrom.setDate(prevFrom.getDate() - period.days)

    const inWindow = rows.filter((r) => r.at >= from && r.at < end)
    const inPrev = rows.filter((r) => r.at >= prevFrom && r.at < from)

    return {
      from,
      now: summarise(inWindow),
      prev: summarise(inPrev),
      buckets: bucketise(inWindow, from, period),
      // Oldest first: improvement is a thing you read forwards through time,
      // and the query hands these back newest-first.
      runsInWindow: [...inWindow].sort((a, b) => a.at - b.at),
    }
  }, [rows, period])

  const allTime = periods?.allTime || { runs: 0, km: 0, best: null, avg: null }
  const prevLabel = period.key === 'week' ? 'last week' : period.key === 'month' ? 'last month' : 'last year'

  // Time-comparison chart scale. Anchored to the SLOWEST run in the period so
  // every bar has something to be shorter than; a scale starting at zero
  // would squash a 30:18 and a 33:55 into visually identical bars, which is
  // exactly the difference the chart exists to show.
  const timed = stats.runsInWindow.filter((r) => r.duration_seconds)
  const slowest = timed.length ? Math.max(...timed.map((r) => r.duration_seconds)) : 0
  const fastest = timed.length ? Math.min(...timed.map((r) => r.duration_seconds)) : 0
  const maxBucket = Math.max(1, ...stats.buckets.map((b) => b.km))

  if (loading) {
    return (
      <div className="page">
        <SetupNotice />
        <PageHead eyebrow="Club" title="My runs" sub="Your distance, your times, your progress." />
        <Loading />
      </div>
    )
  }

  return (
    <div className="page">
      <SetupNotice />

      <PageHead
        eyebrow="Club"
        title="My runs"
        sub="Your distance, your times, and how this period compares to the last."
      />

      {error && (
        <div className="card" style={{ marginBottom: 'var(--s4)' }}>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>{error}</p>
        </div>
      )}

      {/* ── Personal odometer ─────────────────────────────────
          Outside the period tabs on purpose — it's the number that only
          ever goes up, and no tab should be able to change it. */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--s5)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 'var(--s5)',
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>
            Total distance — all time
          </div>
          <div
            className="display"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 4rem)',
              lineHeight: 1.05,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatKm(allTime.km)}
            <span className="muted" style={{ fontSize: '0.4em', marginLeft: '0.25em' }}>km</span>
          </div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>
            {formatMiles(allTime.km)} miles over {allTime.runs} run{allTime.runs === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
          {streak > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Flame size={12} aria-hidden="true" /> Streak
              </div>
              <div className="display" style={{ fontSize: 'var(--fs-xl, 1.5rem)', fontVariantNumeric: 'tabular-nums' }}>
                {streak} <span className="muted" style={{ fontSize: '0.6em' }}>wk{streak === 1 ? '' : 's'}</span>
              </div>
            </div>
          )}
          {allTime.best && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Trophy size={12} aria-hidden="true" /> Personal best
              </div>
              <div className="display mono" style={{ fontSize: 'var(--fs-xl, 1.5rem)' }}>
                {formatDuration(allTime.best)}
              </div>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                {formatPace(allTime.best)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Period selector ─────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Reporting period"
        style={{ display: 'flex', gap: 'var(--s2)', marginBottom: 'var(--s4)' }}
      >
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={p.key === periodKey}
            className={p.key === periodKey ? 'btn btn--primary' : 'btn btn--ghost'}
            onClick={() => setPeriodKey(p.key)}
            style={{ minHeight: 44 }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Period stats ────────────────────────────────────── */}
      <div className="grid grid--kpi" style={{ marginBottom: 'var(--s5)' }}>
        <div className="stat">
          <div className="stat__label">Distance this {period.label.toLowerCase()}</div>
          <div className="stat__value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatKm(stats.now.km)} <span className="muted" style={{ fontSize: '0.5em' }}>km</span>
          </div>
          <CountDelta now={stats.now.km} prev={stats.prev.km} suffix="km" />
        </div>
        <div className="stat">
          <div className="stat__label">Runs</div>
          <div className="stat__value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {stats.now.runs}
          </div>
          <CountDelta now={stats.now.runs} prev={stats.prev.runs} />
        </div>
        <div className="stat">
          <div className="stat__label">Best time</div>
          <div className="stat__value mono">{formatDuration(stats.now.best) || '—'}</div>
          <TimeDelta now={stats.now.best} prev={stats.prev.best} label={prevLabel} />
        </div>
        <div className="stat">
          <div className="stat__label">Average time</div>
          <div className="stat__value mono">{formatDuration(stats.now.avg) || '—'}</div>
          <TimeDelta now={stats.now.avg} prev={stats.prev.avg} label={prevLabel} />
        </div>
      </div>

      {/* ── Distance shape ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--s5)' }}>
        <div className="eyebrow" style={{ marginBottom: 'var(--s4)' }}>
          Distance by {period.bucketBy}
        </div>
        {stats.now.km === 0 ? (
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
            No runs logged in this {period.label.toLowerCase()} yet. Check in from My profile
            after your next one.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--s2)', height: 160 }}>
            {stats.buckets.map((b, i) => (
              <div
                key={i}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}
                title={`${b.title} — ${formatKm(b.km)} km over ${b.runs} run${b.runs === 1 ? '' : 's'}`}
              >
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(2, (b.km / maxBucket) * 100)}%`,
                      background: b.km > 0 ? 'var(--accent)' : 'var(--line, #e5e5e5)',
                      borderRadius: 'var(--r2, 4px)',
                      transition: 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </div>
                <div className="muted mono" style={{ fontSize: 'var(--fs-xs)' }}>{b.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Time comparison ─────────────────────────────────── */}
      <div className="card">
        <div className="spread" style={{ marginBottom: 'var(--s4)', alignItems: 'baseline' }}>
          <div className="eyebrow">Time comparison</div>
          {timed.length > 1 && (
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Shorter bar = faster run
            </span>
          )}
        </div>

        {!timesEnabled ? (
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
            Finish times aren’t switched on for this club yet.
          </p>
        ) : timed.length === 0 ? (
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
            No finish times logged in this {period.label.toLowerCase()}. Add your time next to a
            run on My profile and it will appear here.
          </p>
        ) : (
          <div className="stack" style={{ gap: 'var(--s2)' }}>
            {timed.map((r) => {
              const isPb = r.duration_seconds === fastest
              // Floor the bar at 12% so the fastest run is still a visible
              // bar rather than a sliver that reads as missing data.
              const width = slowest ? Math.max(12, (r.duration_seconds / slowest) * 100) : 100
              return (
                <div
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}
                >
                  <div
                    className="muted mono"
                    style={{ fontSize: 'var(--fs-xs)', minWidth: '4.5rem', flexShrink: 0 }}
                  >
                    {r.at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        height: 10,
                        width: `${width}%`,
                        background: isPb ? 'var(--accent)' : 'var(--line, #e5e5e5)',
                        borderRadius: 999,
                        transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 'var(--fs-sm)',
                      minWidth: '5.5rem',
                      textAlign: 'right',
                      flexShrink: 0,
                      fontWeight: isPb ? 600 : 400,
                    }}
                  >
                    {formatDuration(r.duration_seconds)}
                    {isPb && (
                      <span className="chip chip--accent" style={{ marginLeft: 6 }}>PB</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length === 0 && !loading && (
        <div className="card" style={{ marginTop: 'var(--s5)' }}>
          <Empty
            icon={Footprints}
            title={runner ? 'No runs logged yet' : 'We haven’t matched you to a runner yet'}
            hint={
              runner
                ? 'Check in from My profile after your next run and everything here fills in.'
                : 'Ask a coach to add you to the club list using this email address.'
            }
          />
        </div>
      )}
    </div>
  )
}
