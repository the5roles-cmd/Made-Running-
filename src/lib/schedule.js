// ============================================================
// The club's fixed weekly running schedule — Monday, Wednesday, Saturday.
//
// Why this lives in config rather than being read from the `sessions` table:
// the three days are a property of the CLUB, not of any particular week. A
// session row is the record that a given week's run happened; it may not exist
// yet for the current week (the seed ships Wednesday and Saturday but no
// Monday at all). Driving the UI from the table would make the profile show
// two boxes this week and three the next, which is not what the club's
// schedule actually is.
//
// So: the schedule renders from here, always three boxes, and the session row
// is resolved — or created — lazily at the moment someone checks in. See
// resolveSessionForDay() in useMyRunner.js.
//
// Titles and locations deliberately match supabase-seed.sql, so an existing
// seeded "Wednesday Track Night" is matched and reused rather than duplicated.
// The TIMES here are the club's real ones (Mon 7:15pm, Wed 5am, Sat 9am) and
// intentionally override the placeholder times in the seed — sessions are
// matched on the calendar day, not the timestamp, so the two can disagree
// without splitting a register in two. See dayBounds() below.
//
// distanceKm is a property of the run, not of a person's performance. Every
// club run is 5k, so a runner's mileage is exactly (runs attended × 5). If
// distances ever vary by day, change the number here and every total on the
// profile re-derives itself — no stored mileage to migrate, nothing to keep
// in sync, and no way for the two to drift apart.
// ============================================================

export const RUN_DAYS = [
  {
    key: 'mon',
    weekday: 1, // Date.getDay(): 0 = Sunday
    label: 'Monday',
    short: 'Mon',
    title: 'Monday Night Run',
    location: 'Platt Fields Park, Manchester',
    hour: 19,
    minute: 15,
    distanceKm: 5,
  },
  {
    key: 'wed',
    weekday: 3,
    label: 'Wednesday',
    short: 'Wed',
    title: 'Wednesday Track Night',
    location: 'Whitworth Park, Manchester',
    hour: 5,
    minute: 0,
    distanceKm: 5,
  },
  {
    key: 'sat',
    weekday: 6,
    label: 'Saturday',
    short: 'Sat',
    title: 'Saturday Long Run',
    location: 'Fallowfield Loop, Manchester',
    hour: 9,
    minute: 0,
    distanceKm: 5,
  },
]

// One run = 5k. Kept as a named fallback so attendance rows whose session no
// longer maps to a RUN_DAYS entry (a one-off, a changed schedule) still count
// toward mileage instead of silently contributing zero.
export const DEFAULT_RUN_KM = 5

export const KM_PER_MILE = 1.609344
export const toMiles = (km) => km / KM_PER_MILE

// Monday 00:00 of the week containing `d`. Monday-start to match the rest of
// the app (My profile, My runs and The Gym all bucket weeks this way) —
// getDay() calls Sunday 0, so Sunday has to be pulled BACK six days rather
// than forward one, which is the classic off-by-a-week bug here.
export function startOfWeek(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

export function endOfWeek(d = new Date()) {
  const end = startOfWeek(d)
  end.setDate(end.getDate() + 7)
  return end
}

// The actual Date this run falls on in the week containing `ref`.
export function occurrenceFor(day, ref = new Date()) {
  const date = startOfWeek(ref)
  date.setDate(date.getDate() + (day.weekday - 1)) // weekday 1 (Mon) = offset 0
  date.setHours(day.hour, day.minute, 0, 0)
  return date
}

// Midnight-to-midnight bounds for a run's calendar day. Used to match an
// existing session row: two rows for the same Wednesday should be treated as
// the same run even if the seeded time (18:30) differs by minutes from ours.
export function dayBounds(startsAt) {
  const from = new Date(startsAt)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from, to }
}

// This week's three runs, each with its concrete date and status.
// `past` covers today as well: you check in when you turn up, so the button
// has to stay live for the whole of the day itself, not just after the
// advertised start time — people arrive early.
export function thisWeekRuns(now = new Date()) {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  return RUN_DAYS.map((day) => {
    const startsAt = occurrenceFor(day, now)
    const dayStart = new Date(startsAt)
    dayStart.setHours(0, 0, 0, 0)
    return {
      ...day,
      startsAt,
      isToday: dayStart.getTime() === todayStart.getTime(),
      // Future runs cannot be checked into — attendance is a record of having
      // turned up, and letting someone mark Saturday on Monday would quietly
      // make the club's own attendance numbers fiction.
      isUpcoming: dayStart.getTime() > todayStart.getTime(),
    }
  })
}

export function formatTime(date) {
  return date
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(' ', '')
    .toLowerCase()
}

export function formatDayDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Finish times ────────────────────────────────────────────────────────────
// Stored as whole seconds (see attendance.duration_seconds). Displayed as
// mm:ss under an hour and h:mm:ss over it — a 5k is a mm:ss distance for
// almost everyone, and padding every time to "00:32:40" makes the fast and
// the slow look equally institutional.

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

// Pace per kilometre, e.g. 6:32/km. Derived, never stored — a stored pace and
// a stored time are two numbers that can disagree, and one of them would be
// wrong.
export function formatPace(seconds, km = DEFAULT_RUN_KM) {
  if (!seconds || !km) return null
  return `${formatDuration(seconds / km)}/km`
}

// Accepts what people actually type: "32:40", "3240", "32.40", "32m40",
// "1:02:15", or plain minutes "32". Returns seconds, or null if it can't be
// read as a time. Deliberately permissive — this box appears on a phone in a
// park, and rejecting "32.40" on a technicality is a worse outcome than
// guessing the obvious meaning.
export function parseDuration(input) {
  if (input == null) return null
  const raw = String(input).trim()
  if (!raw) return null

  const parts = raw.split(/[^0-9]+/).filter(Boolean).map(Number)
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return null

  let seconds
  if (parts.length === 1) {
    // A lone number is minutes ("32"), except a 3–4 digit run that reads as
    // mmss ("3240"). Nobody enters a 3,240-minute run.
    const n = parts[0]
    seconds = raw.length >= 3 && !raw.includes(' ') ? Math.floor(n / 100) * 60 + (n % 100) : n * 60
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1]
  } else {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  if (!Number.isFinite(seconds) || seconds <= 0) return null
  // 12 hours. A cap stops a fat-fingered "3240000" becoming a personal best
  // that can never be beaten and permanently skews the average.
  if (seconds > 12 * 3600) return null
  return Math.round(seconds)
}

// ── Distance ────────────────────────────────────────────────────────────────
// Mileage is always derived from runs attended × the run's distance. There is
// no stored total to drift out of sync with the attendance log.
export function kmFor(runs) {
  return runs * DEFAULT_RUN_KM
}

export function formatKm(km) {
  return km % 1 === 0 ? String(km) : km.toFixed(1)
}

export function formatMiles(km) {
  return toMiles(km).toFixed(1)
}

/**
 * Distance credited for a single attendance row.
 *
 * Two inputs, and the order they're consulted matters:
 *
 *   1. sessionType — a check-in at a gym class or a Hub workshop is a real
 *      attendance, but it is not five kilometres, and counting it as such
 *      would inflate the club's mileage every time someone turned up to a
 *      strength session. Anything that isn't a run credits 0 km.
 *   2. the weekday — for an actual run, look up the RUN_DAYS entry so a
 *      day-specific distance is honoured if the schedule ever stops being
 *      three identical 5ks.
 *
 * A NULL/undefined sessionType is treated as a run. That's the optimistic
 * branch and it's deliberate: the join can be missing (useMyRunner selects
 * '*' with no session join, by design — see COLS there), and under-counting
 * a member's own mileage on their profile is a more visible wrong than
 * over-counting a workshop nobody has yet booked.
 *
 * @param {{ attended_at?: string|Date, at?: Date, sessionType?: string|null }} row
 * @returns {number} kilometres
 */
export function kmForAttendance(row) {
  if (!row) return 0
  const type = row.sessionType
  if (type && type !== 'run') return 0
  const at = row.at instanceof Date ? row.at : new Date(row.attended_at)
  if (Number.isNaN(at.getTime())) return DEFAULT_RUN_KM
  const day = RUN_DAYS.find((d) => d.weekday === at.getDay())
  return day?.distanceKm ?? DEFAULT_RUN_KM
}
