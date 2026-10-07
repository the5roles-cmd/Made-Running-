// ============================================================
// useMyRunner — everything the signed-in RUNNER's own screen needs:
// which record is mine, which of this week's runs I've checked into, the
// times I logged, and what my last week / last month / all-time look like.
//
// This hook is deliberately first-person. The admin screens (Runners,
// Attendance) answer "who came to this session"; this one answers "what have
// I done". Same two tables, opposite direction, and the queries are filtered
// by runner_id rather than by session precisely so a member can never pull
// the club register down to their phone.
//
// The link between an auth user and their club record is EMAIL, not a foreign
// key. `records` has no user_id column (verified against the live database),
// and adding one would mean a migration on the client's Supabase project.
// Email is the one field both sides already hold, so it is the join.
//
// The trade-off, stated plainly: email is not enforced unique on `records`,
// so a duplicate would make `.limit(1)` pick arbitrarily. Ordering by
// created_at makes the pick at least deterministic — the oldest record wins,
// which is the one with the attendance history attached.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'
import { useAuth } from '../auth/AuthProvider'
import { DEFAULT_RUN_KM, RUN_DAYS, dayBounds, occurrenceFor, startOfWeek } from './schedule'

// A display name for a brand-new record, best effort: the profile name they
// gave at signup, else the local part of the email. Never blank — `title` is
// what every other screen renders as the person's name.
function nameFromUser(user) {
  const meta = user?.user_metadata || {}
  return (meta.full_name || meta.name || user?.email?.split('@')[0] || 'Runner').trim()
}

// `select('*')` rather than a column list, specifically so duration_seconds
// comes along by itself the moment someone runs the migration — and, more
// importantly, so naming a column that might not exist never has to happen in
// a query. Asking PostgREST for a missing column is a 400, and a 400 is a red
// console error on the first screen a client sees.
const COLS = '*'

// PostgREST's two ways of saying "no such column": 42703 from Postgres itself
// on a read, PGRST204 from the schema cache on a write.
const MISSING_COLUMN = ['42703', 'PGRST204']
const isMissingColumn = (err) =>
  Boolean(err) &&
  (MISSING_COLUMN.includes(err.code) || /duration_seconds/.test(err.message || ''))

export function useMyRunner() {
  const { user, orgId } = useAuth()
  const [runner, setRunner] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Which day key is mid-write, so only that box shows a pending state rather
  // than the whole card greying out.
  const [pending, setPending] = useState(null)

  // Whether attendance.duration_seconds exists on THIS project's database.
  //
  // The column ships in supabase-setup.sql, but an org created before it was
  // added won't have it, and the app has no way to run DDL. So the capability
  // is inferred rather than assumed, and inferred OPTIMISTICALLY: assume the
  // column is there, notice from the shape of a returned row when it isn't,
  // and fall back once if a write proves otherwise.
  //
  // The obvious alternative — probe with `select('duration_seconds').limit(1)`
  // on mount — is worse than it looks. It costs a round trip on every load,
  // and on the databases where the answer is "no" it paints a red 400 in the
  // console of the very first screen after sign-in. Optimism costs a retry in
  // the rare case instead of an error in the common one.
  //
  // To turn times on: run the `alter table attendance add column if not
  // exists duration_seconds integer;` line from supabase-setup.sql.
  const [timesEnabled, setTimesEnabled] = useState(true)

  // Same out-of-order guard as AuthProvider: switching org mid-load must not
  // let the slower, older query win and paint another org's runner.
  const seqRef = useRef(0)

  const load = useCallback(async () => {
    if (!supabaseConfigured || !orgId || !user?.email) {
      setLoading(false)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)

    // 1. Find my record in this org.
    const email = user.email.toLowerCase()
    const { data: found, error: findErr } = await supabase
      .from('records')
      .select('id, title, email, phone, status, summary, tags, created_at')
      .eq('org_id', orgId)
      .ilike('email', email)
      .order('created_at', { ascending: true })
      .limit(1)

    if (findErr) {
      if (seq === seqRef.current) {
        setError(findErr.message)
        setLoading(false)
      }
      return
    }

    let mine = found?.[0] || null

    // 2. No record? Create one. Signing in IS joining, from the runner's point
    //    of view — making them fill a form to see their own profile would be
    //    asking them to prove something the club already knows.
    if (!mine) {
      const { data: created, error: createErr } = await supabase
        .from('records')
        .insert({
          org_id: orgId,
          title: nameFromUser(user),
          email,
          status: 'active',
          summary: 'Joined via the website.',
        })
        .select('id, title, email, phone, status, summary, tags, created_at')
        .single()
      if (createErr) {
        if (seq === seqRef.current) {
          setError(createErr.message)
          setLoading(false)
        }
        return
      }
      mine = created
    }

    // 3. My whole attendance history. It is a handful of rows per runner, and
    //    having all of it client-side is what makes the streak and the
    //    last-week / last-month totals below pure functions of one fetch
    //    rather than four separate count queries.
    const { data: rows } = await supabase
      .from('attendance')
      .select(COLS)
      .eq('org_id', orgId)
      .eq('runner_id', mine.id)
      .order('attended_at', { ascending: false })

    if (seq !== seqRef.current) return
    // A returned row is proof either way. No rows proves nothing, so the
    // optimistic default stands and a write will settle it.
    if (rows?.length) setTimesEnabled('duration_seconds' in rows[0])
    setRunner(mine)
    setAttendance(rows || [])
    setError(null)
    setLoading(false)
  }, [orgId, user])

  useEffect(() => {
    load()
  }, [load])

  // Find (or create) the session row for one of this week's runs.
  //
  // Matched on the calendar DAY, not the exact timestamp: a seeded 18:30 and
  // our 19:15 are the same Monday run, and two rows for it would split that
  // evening's register in half. Type is pinned to 'run' so a Hub workshop on
  // the same evening is never mistaken for the club run.
  const resolveSessionForDay = useCallback(
    async (day) => {
      const startsAt = occurrenceFor(day)
      const { from, to } = dayBounds(startsAt)

      const { data: existing } = await supabase
        .from('sessions')
        .select('id, starts_at')
        .eq('org_id', orgId)
        .eq('type', 'run')
        .gte('starts_at', from.toISOString())
        .lt('starts_at', to.toISOString())
        .order('starts_at', { ascending: true })
        .limit(1)

      if (existing?.[0]) return existing[0]

      const { data: created, error: err } = await supabase
        .from('sessions')
        .insert({
          org_id: orgId,
          type: 'run',
          title: day.title,
          location: day.location,
          starts_at: startsAt.toISOString(),
          recurring: true,
        })
        .select('id, starts_at')
        .single()
      if (err) throw new Error(err.message)
      return created
    },
    [orgId],
  )

  // Check in to one of this week's runs. `seconds` is optional — turning up is
  // the fact being recorded; the time is extra.
  const checkIn = useCallback(
    async (day, seconds = null) => {
      if (!runner || pending) return
      setPending(day.key)
      setError(null)
      try {
        const session = await resolveSessionForDay(day)

        // Idempotent by re-read rather than by a unique constraint — we can't
        // add one without a migration. The button is disabled while `pending`
        // is set, so this covers the remaining case: the same runner checking
        // in from two devices.
        const { data: dupe } = await supabase
          .from('attendance')
          .select(COLS)
          .eq('org_id', orgId)
          .eq('session_id', session.id)
          .eq('runner_id', runner.id)
          .limit(1)

        if (dupe?.[0]) {
          setAttendance((prev) =>
            prev.some((a) => a.id === dupe[0].id) ? prev : [dupe[0], ...prev],
          )
          return
        }

        // attended_at is the RUN's start time, not now(). Someone logging
        // Monday's run on Friday attended on Monday; stamping the click time
        // would file it under the wrong week and quietly break the streak.
        const payload = {
          org_id: orgId,
          session_id: session.id,
          runner_id: runner.id,
          attended_at: occurrenceFor(day).toISOString(),
          checked_in_by: user?.id || null,
        }
        if (timesEnabled && seconds) payload.duration_seconds = seconds

        let { data: inserted, error: insErr } = await supabase
          .from('attendance')
          .insert(payload)
          .select(COLS)
          .single()

        // The column isn't there. Record the check-in anyway and remember not
        // to offer times again — turning up is the fact that matters, and
        // losing it because an optional field is unsupported would be the
        // wrong thing to fail on.
        if (isMissingColumn(insErr)) {
          setTimesEnabled(false)
          delete payload.duration_seconds
          ;({ data: inserted, error: insErr } = await supabase
            .from('attendance')
            .insert(payload)
            .select(COLS)
            .single())
        }
        if (insErr) throw new Error(insErr.message)

        setAttendance((prev) => [inserted, ...prev])
      } catch (e) {
        setError(e.message)
      } finally {
        setPending(null)
      }
    },
    [runner, pending, orgId, user, timesEnabled, resolveSessionForDay],
  )

  // Add or correct the finish time on a check-in that already exists. Passing
  // null clears it — a mistyped time you can't erase is worse than no time.
  const saveTime = useCallback(
    async (attendanceId, seconds) => {
      if (!timesEnabled || !runner) return
      setError(null)
      const { data, error: err } = await supabase
        .from('attendance')
        .update({ duration_seconds: seconds })
        .eq('id', attendanceId)
        .eq('org_id', orgId)
        .eq('runner_id', runner.id) // belt-and-braces: only ever my own row
        .select(COLS)
        .single()
      if (err) {
        if (isMissingColumn(err)) {
          setTimesEnabled(false)
          return
        }
        setError(err.message)
        return
      }
      setAttendance((prev) => prev.map((a) => (a.id === data.id ? data : a)))
    },
    [timesEnabled, runner, orgId],
  )

  // ── Derived: this week, last week, last 30 days, all time ────────────────
  const derived = useMemo(() => {
    const weekStart = startOfWeek()
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const monthStart = new Date(weekEnd)
    monthStart.setDate(monthStart.getDate() - 30)

    // Attach the schedule day to each row once, here, so the UI never has to
    // do date maths inline.
    const rows = attendance.map((row) => {
      const at = new Date(row.attended_at)
      return { ...row, at, day: RUN_DAYS.find((d) => d.weekday === at.getDay()) || null }
    })

    const attendedThisWeek = {}
    for (const row of rows) {
      if (row.at >= weekStart && row.at < weekEnd && row.day) attendedThisWeek[row.day.key] = row
    }

    // One shape for every period so the UI renders them from a loop instead of
    // four near-identical blocks.
    const summarise = (subset) => {
      const times = subset.map((r) => r.duration_seconds).filter(Boolean)
      return {
        runs: subset.length,
        km: subset.reduce((t, r) => t + (r.day?.distanceKm ?? DEFAULT_RUN_KM), 0),
        best: times.length ? Math.min(...times) : null,
        avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      }
    }

    const inRange = (from, to) => rows.filter((r) => r.at >= from && r.at < to)

    // Streak = consecutive weeks, counting back from this one, containing at
    // least one run. The current week is allowed to be empty without breaking
    // it — it's Monday morning for someone, and zeroing a 12-week streak
    // because the week has barely started would be a lie about their habit.
    const weeks = new Set(rows.map((r) => startOfWeek(r.at).getTime()))
    let streak = 0
    const cursor = new Date(weekStart)
    if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7)
    while (weeks.has(cursor.getTime())) {
      streak += 1
      cursor.setDate(cursor.getDate() - 7)
    }

    return {
      rows,
      attendedThisWeek,
      streak,
      periods: {
        thisWeek: summarise(inRange(weekStart, weekEnd)),
        lastWeek: summarise(inRange(lastWeekStart, weekStart)),
        last30: summarise(inRange(monthStart, weekEnd)),
        allTime: summarise(rows),
      },
    }
  }, [attendance])

  return {
    runner,
    loading,
    error,
    pending,
    timesEnabled,
    checkIn,
    saveTime,
    refresh: load,
    ...derived,
  }
}
