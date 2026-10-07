-- ============================================================
-- Finish times on attendance — run this ONCE in the Supabase SQL editor.
--
-- Supabase → SQL Editor → New query → paste → Run.
--
-- Why this is a separate file: the app can create rows, but it cannot create
-- COLUMNS. The browser only ever holds the anon key, and DDL needs an owner
-- connection. So the one part of "runners can record their times" that the
-- app can't do for itself lives here.
--
-- Until it's run, the profile page still works — check-ins record normally,
-- the time field just doesn't appear, and a note on the page says why. After
-- it's run, refresh the page and the field is there. No redeploy needed:
-- the app detects the column from the data it already fetches.
--
-- Safe to run twice. `if not exists` makes it a no-op the second time.
-- ============================================================

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

-- Sanity check — should return one row describing the new column.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'attendance' and column_name = 'duration_seconds';
