-- ============================================================
-- CLASS BOOKING — seed the REAL MADE Hub timetable as class records.
--
-- Run AFTER supabase-classes.sql.
--
-- This is the migration that takes the twelve classes out of the front-end
-- file src/lib/hubClasses.js and makes them DATA, which your rule requires:
-- "The name and timetable are pulled from the class record, never
-- hard-coded." Once this has run, hubClasses.js is dead and gets deleted.
--
-- Idempotent: keyed on (org_id, slug), so re-running updates rather than
-- duplicating. Safe to run twice.
--
-- ── A modelling decision you should sanity-check ──────────────
-- Each WEEKLY SLOT is its own class, so "Hot Kettlebells" becomes three
-- classes (Mon 9.30 with Jade, Mon 7.30pm with Micah, Sat 7.30pm with
-- Micah) with three separate links.
--
-- That is deliberate, not an accident of the schema. Those three genuinely
-- are different products: different coach, and the Monday morning one is
-- female-only. More importantly it is what makes Step 1 work — the coach's
-- name is shown with the class, and each coach shares the link to THEIR
-- class. Merging them into one "Hot Kettlebells" would mean a class with
-- three coaches and a female-only flag that is true only on Mondays.
--
-- A class's "own timetable" (Step 3) is therefore the next 8 dated
-- occurrences of its weekly slot.
-- ============================================================

do $$
declare
  v_org uuid;
  v_made int;
begin
  -- Resolve the tenant the same way every other seed in this project does.
  select id into v_org from orgs where public_join_slug = 'maderunning' limit 1;
  if v_org is null then
    raise exception 'No org with public_join_slug = ''maderunning''. Run supabase-seed.sql first.';
  end if;

  -- ── The twelve real classes, transcribed from the club's PDF ──
  -- Columns: slug, name, coach_name, day(0=Sun..6=Sat), time,
  --          female_only, paused, pause_note, description
  insert into classes (
    org_id, slug, name, coach_name, recurrence_day, recurrence_time,
    female_only, is_paused, pause_note, description, capacity, price_pennies
  )
  values
    -- Monday
    (v_org, 'hot-kettlebells-mon-0930', 'Hot Kettlebells', 'Jade',    1, '09:30', true,  false, null, null, 40, 1000),
    (v_org, 'hot-kettlebells-mon-1930', 'Hot Kettlebells', 'Micah',   1, '19:30', false, false, null, null, 40, 1000),

    -- Tuesday. The 5am HIIT was seeded paused ("starting back next week"
    -- on the club's PDF); the club confirmed it is running again (Oct
    -- 2026), so it seeds live like every other class.
    (v_org, 'hiit-tue-0500',            'HIIT',            'Hermen',  2, '05:00', false, false, null, null, 40, 1000),
    (v_org, 'catch-a-circuit-tue-1830', 'CaTcH a Circuit', 'Jade',    2, '18:30', false, false, null, null, 40, 1000),

    -- Wednesday
    (v_org, 'the-valley-wed-1845',      'The Valley',      'K3 & Marvin', 3, '18:45', false, false, null,
      'Hot kettlebells', 40, 1000),

    -- Thursday. The PDF names no coach for Dog Business HIIT — left NULL
    -- rather than guessed. The UI omits the "with …" line when it is absent.
    (v_org, 'dog-business-hiit-thu-1830','Dog Business HIIT', null,   4, '18:30', false, false, null, null, 40, 1000),
    (v_org, 'yoga-thu-1900',            'Yoga',            'Brittany',4, '19:00', false, false, null, null, 40, 1000),

    -- Friday
    (v_org, 'kettlebells-fri-0930',     'Kettlebells',     'Daria',   5, '09:30', true,  false, null, null, 40, 1000),
    (v_org, 'the-valley-fri-1045',      'The Valley',      'K3 & Marvin', 5, '10:45', false, false, null,
      'Hot kettlebells', 40, 1000),

    -- Saturday
    (v_org, 'hustle-hard-sat-0800',     'Hustle Hard',     'Malachi', 6, '08:00', false, false, null, null, 40, 1000),
    (v_org, 'hot-kettlebells-sat-1930', 'Hot Kettlebells', 'Micah',   6, '19:30', false, false, null, null, 40, 1000),

    -- Sunday
    (v_org, 'propain-hiit-sun-1200',    'The Propain HIIT Class', 'Nathaniel', 0, '12:00', false, false, null, null, 40, 1000)

  on conflict (org_id, slug) do update set
    name            = excluded.name,
    coach_name      = excluded.coach_name,
    recurrence_day  = excluded.recurrence_day,
    recurrence_time = excluded.recurrence_time,
    female_only     = excluded.female_only,
    is_paused       = excluded.is_paused,
    pause_note      = excluded.pause_note,
    description     = excluded.description;
    -- capacity and price_pennies are deliberately NOT overwritten on
    -- conflict. Once the club has set a different price or a smaller room
    -- capacity in the Classes editor, re-running this seed must not silently
    -- reset it.
    --
    -- Note this cuts both ways: the 1000 (£10.00) above only applies on FIRST
    -- insert, so a project that was seeded while the price was still 0 keeps
    -- the 0 however many times this file is re-run. Fix those in the editor,
    -- or with an explicit one-off:
    --   update classes set price_pennies = 1000 where price_pennies = 0;

  -- ── Generate the dated, bookable sessions (Step 4) ──────────
  select generate_class_sessions(v_org) into v_made;
  raise notice 'Seeded 12 classes. Generated % new sessions.', v_made;
end $$;


-- ── Verify ───────────────────────────────────────────────────
-- Expect 12 classes, and 8 weeks × 12 = ~96 sessions.
select
  c.name,
  c.coach_name,
  to_char(c.recurrence_time, 'HH24:MI')                as at,
  to_char(date '2001-01-07' + c.recurrence_day, 'Dy')  as on_day,
  c.capacity,
  c.slug,
  count(s.id)                                          as sessions_generated
from classes c
left join class_sessions s on s.class_id = c.id
group by c.id
order by c.recurrence_day, c.recurrence_time;
