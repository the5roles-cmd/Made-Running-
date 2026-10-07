-- ============================================================
-- DEMO SEED — everything the demo needs, in one paste.
--
--   1. the attendance.duration_seconds migration (finish times)
--   2. nine weeks of running history for nelson@nelsonuni.com
--   3. a full weekly Gym timetable
--
-- Supabase → SQL Editor → New query → paste all of this → Run.
--
-- This file REPLACES supabase-run-times.sql — that migration is step 1
-- here, so there is only one thing to paste.
--
-- PREREQUISITE: sign in to the app once as nelson@nelsonuni.com before
-- running this. The seed finds the workspace by following that account's
-- membership row, and there is nothing to follow until the account exists.
-- If it hasn't signed in yet the script stops with a clear message rather
-- than seeding the wrong org.
--
-- Why this is SQL and not something the app does for itself: the browser
-- only ever holds the anon key, so every query it makes is filtered by RLS
-- to the org of whoever is signed in. Back-filling one runner's history is
-- exactly the kind of thing RLS is there to prevent. The SQL editor runs as
-- owner, which is the right place for it.
--
-- SAFE TO RUN TWICE. Every insert is guarded by an existence check, so a
-- second run inserts nothing and reports the same totals.
-- ============================================================

-- ── 1. The finish-times column (was supabase-run-times.sql) ────────────
alter table attendance add column if not exists duration_seconds integer;

-- Whole seconds, always positive. A time of zero is a data-entry accident,
-- not a very fast 5k, and letting one in would poison every average.
do $$
begin
  alter table attendance
    add constraint attendance_duration_positive
    check (duration_seconds is null or duration_seconds > 0);
exception
  when duplicate_object then null;  -- already applied
end $$;


-- ── 2. The history ─────────────────────────────────────────────────────
-- Nine consecutive weeks ending last week (w/c Mon 10 Aug 2026). THIS week
-- is deliberately left empty: Monday's and Wednesday's runs have already
-- happened, so the profile opens with live "Check in" buttons to press
-- during the demo. The streak still reads 9 — the streak rule allows the
-- current week to be empty on purpose, because zeroing someone's habit
-- because it's only Tuesday would be a lie about it.
--
-- The pattern is 2 or 3 runs a week rather than a perfect 3, and the times
-- drift down over the nine weeks (33:55 → 30:18). Both on purpose: flawless
-- attendance and flat times look generated, and a visibly improving PB is
-- the thing a runner actually wants their profile to show them.
do $$
declare
  v_org     uuid;
  v_runner  uuid;
  v_session uuid;
  v_start   timestamptz;
  v_title   text;
  v_loc     text;
  r         record;
  n_new     int := 0;
begin
  -- Which workspace? Follow the account's own membership. Looking the org up
  -- by name would break the moment the client renames it.
  select m.org_id into v_org
  from auth.users u
  join memberships m on m.user_id = u.id
  where lower(u.email) = 'nelson@nelsonuni.com'
  order by m.created_at asc
  limit 1;

  if v_org is null then
    raise exception
      'No workspace found for nelson@nelsonuni.com. Sign in to the app once with that account, then run this again.';
  end if;

  -- The club record for that person. Same email join the app uses, and the
  -- same oldest-wins tiebreak, so this always picks the record the app will
  -- pick — email is not unique on `records`.
  select id into v_runner
  from records
  where org_id = v_org and lower(email) = 'nelson@nelsonuni.com'
  order by created_at asc
  limit 1;

  if v_runner is null then
    insert into records (org_id, title, email, status, summary)
    values (v_org, 'Nelson', 'nelson@nelsonuni.com', 'active', 'Joined via the website.')
    returning id into v_runner;
  end if;

  for r in
    -- Local Manchester wall-clock time, converted below. Mon 19:15,
    -- Wed 05:00, Sat 09:00 — the club's actual schedule.
    select * from (values
      (timestamp '2026-06-15 19:15', 2035),
      (timestamp '2026-06-20 09:00', 1994),
      (timestamp '2026-06-22 19:15', 2011),
      (timestamp '2026-06-24 05:00', 1978),
      (timestamp '2026-06-27 09:00', 1952),
      (timestamp '2026-07-01 05:00', 1966),
      (timestamp '2026-07-04 09:00', 1940),
      (timestamp '2026-07-06 19:15', 1948),
      (timestamp '2026-07-08 05:00', 1930),
      (timestamp '2026-07-11 09:00', 1915),
      (timestamp '2026-07-13 19:15', 1922),
      (timestamp '2026-07-18 09:00', 1901),
      (timestamp '2026-07-20 19:15', 1908),
      (timestamp '2026-07-22 05:00', 1889),
      (timestamp '2026-07-25 09:00', 1877),
      (timestamp '2026-07-29 05:00', 1884),
      (timestamp '2026-08-01 09:00', 1866),
      (timestamp '2026-08-03 19:15', 1871),
      (timestamp '2026-08-05 05:00', 1855),
      (timestamp '2026-08-08 09:00', 1843),
      (timestamp '2026-08-10 19:15', 1850),
      (timestamp '2026-08-12 05:00', 1832),
      (timestamp '2026-08-15 09:00', 1818)
    ) as t(local_start, secs)
  loop
    -- Europe/London, not UTC and not a fixed +01: this range crosses no DST
    -- boundary today, but hard-coding an offset makes the file wrong the
    -- next time it's reused in a different month.
    v_start := r.local_start at time zone 'Europe/London';

    v_title := case extract(dow from r.local_start)
                 when 1 then 'Monday Night Run'
                 when 3 then 'Wednesday Track Night'
                 else        'Saturday Long Run'
               end;
    v_loc   := case extract(dow from r.local_start)
                 when 1 then 'Platt Fields Park, Manchester'
                 when 3 then 'Whitworth Park, Manchester'
                 else        'Fallowfield Loop, Manchester'
               end;

    -- Reuse the day's session if one is already there. Matched on the
    -- calendar DAY and type='run', exactly like the app's own lookup, so a
    -- seeded run and a live check-in on the same date share one register
    -- instead of splitting it across two session rows.
    v_session := null;
    select id into v_session
    from sessions
    where org_id = v_org
      and type = 'run'
      and starts_at >=  (date_trunc('day', r.local_start)                     at time zone 'Europe/London')
      and starts_at <  ((date_trunc('day', r.local_start) + interval '1 day') at time zone 'Europe/London')
    order by starts_at asc
    limit 1;

    if v_session is null then
      insert into sessions (org_id, type, title, location, starts_at, recurring)
      values (v_org, 'run', v_title, v_loc, v_start, true)
      returning id into v_session;
    end if;

    -- attended_at is the RUN's start time, never now(). The week buckets and
    -- the streak are computed from this column, so a wrong timestamp here
    -- doesn't error, it just quietly files the run under the wrong week.
    if not exists (
      select 1 from attendance
      where org_id = v_org and session_id = v_session and runner_id = v_runner
    ) then
      insert into attendance (org_id, session_id, runner_id, attended_at, duration_seconds)
      values (v_org, v_session, v_runner, v_start, r.secs);
      n_new := n_new + 1;
    end if;
  end loop;

  raise notice 'Seeded % new attendance row(s) for nelson@nelsonuni.com.', n_new;
end $$;


-- ── 3. The Gym timetable ───────────────────────────────────────────────
-- Populates The Gym (/app/gym) with a full week of classes.
--
-- Everything here is `recurring = true`, and that is the whole trick: the
-- timetable PROJECTS a recurring row onto whichever week is being viewed
-- (same weekday, same clock time — see buildWeek() in Gym.jsx). So these
-- eight rows fill this week, next week and every week after, rather than
-- needing a row per class per week and a job to top them up.
--
-- starts_at on a recurring row is therefore a TEMPLATE, not an appointment.
-- It is anchored to the Monday of the current week so nothing is projected
-- into weeks before the class existed.

-- Gym classes need the 'gym_class' session type and a price column. Both
-- come from supabase-bookings.sql; repeated here so the timetable works
-- whether or not the full booking migration has been run. Additive and
-- idempotent — running both files in either order is safe.
alter table sessions drop constraint if exists sessions_type_check;
alter table sessions add constraint sessions_type_check
  check (type in ('run','hub_workshop','hub_training','hub_networking','gym_class'));
alter table sessions add column if not exists price_pennies int not null default 0;

do $$
declare
  v_org    uuid;
  v_monday date;
  r        record;
  n_new    int := 0;
begin
  select m.org_id into v_org
  from auth.users u
  join memberships m on m.user_id = u.id
  where lower(u.email) = 'nelson@nelsonuni.com'
  order by m.created_at asc
  limit 1;

  if v_org is null then
    raise exception
      'No workspace found for nelson@nelsonuni.com. Sign in to the app once with that account, then run this again.';
  end if;

  -- Monday of the current week. date_trunc('week') is ISO — Monday-start —
  -- which matches startOfWeek() in the app. Using CURRENT_DATE rather than a
  -- literal means this file stays correct whenever it is run.
  v_monday := date_trunc('week', current_date)::date;

  for r in
    -- dow: 0 = Monday here (an offset from v_monday, not Postgres' dow).
    select * from (values
      (0, time '07:00', 'Strength & Conditioning', 'hub_training',   16, 1000),
      (1, time '18:30', 'Mobility & Recovery',     'gym_class',      12,  800),
      (2, time '06:30', 'Sunrise HIIT',            'gym_class',      20, 1000),
      (3, time '19:00', 'Run Technique Clinic',    'hub_workshop',   14,    0),
      (4, time '07:00', 'Core & Conditioning',     'gym_class',      16,  800),
      (5, time '11:00', 'Post-run Stretch',        'gym_class',      24,    0),
      (6, time '10:00', 'Yoga for Runners',        'gym_class',      18, 1200)
    ) as t(dow, at_time, title, kind, cap, pence)
  loop
    -- Guarded on title so a second run updates nothing and inserts nothing.
    if not exists (
      select 1 from sessions
      where org_id = v_org and title = r.title and type = r.kind
    ) then
      insert into sessions (org_id, type, title, location, starts_at, recurring, capacity, price_pennies)
      values (
        v_org, r.kind, r.title, 'Sutek Wellness, Manchester',
        ((v_monday + r.dow) + r.at_time) at time zone 'Europe/London',
        true, r.cap, r.pence
      );
      n_new := n_new + 1;
    end if;
  end loop;

  -- One NON-recurring event, so the one-off branch of the timetable is
  -- exercised too — a page that has only ever rendered repeating rows has
  -- only ever tested half of itself.
  if not exists (
    select 1 from sessions where org_id = v_org and title = 'Members'' Social — Q&A with the coaches'
  ) then
    insert into sessions (org_id, type, title, location, starts_at, recurring, capacity, price_pennies)
    values (
      v_org, 'hub_networking', 'Members'' Social — Q&A with the coaches',
      'Sutek Wellness, Manchester',
      ((v_monday + 3) + time '20:00') at time zone 'Europe/London',
      false, 40, 0
    );
    n_new := n_new + 1;
  end if;

  raise notice 'Seeded % new gym session(s).', n_new;
end $$;


-- ── 4. Sanity check ────────────────────────────────────────────────────
-- Expect: 23 runs, 115 km, best 30:18, 9 distinct weeks.
select
  count(*)                                          as runs,
  count(*) * 5                                      as km,
  to_char((min(a.duration_seconds) || ' seconds')::interval, 'MI:SS') as best_time,
  count(distinct date_trunc('week', a.attended_at)) as weeks,
  min(a.attended_at)::date                          as first_run,
  max(a.attended_at)::date                          as last_run
from attendance a
join records r on r.id = a.runner_id
where lower(r.email) = 'nelson@nelsonuni.com';

-- Expect: 8 rows — 7 weekly classes plus the one-off members' social.
select title, type, capacity, recurring,
       to_char(starts_at at time zone 'Europe/London', 'Dy HH24:MI') as slot
from sessions
where type <> 'run'
order by starts_at;
