-- ── RLS audit: the inside half of the lockdown check ────────────────────────
-- (QA, Oct 2026: "is RLS enabled so members can't see each other's data?
--  I can't check that from outside.")
--
-- The OUTSIDE half has already been done and passed: every live table was
-- probed over PostgREST with the public anon key and returned zero rows —
-- including orgs, which is proven non-empty. But an outside probe has one
-- blind spot: a table that is EMPTY today looks identical with RLS on or
-- off, and an RLS-off table only starts leaking when data arrives. This
-- file closes that blind spot from inside, where pg_class can simply be
-- asked.
--
-- Run the whole file in the Supabase SQL editor. It is SAFE TO RUN TWICE:
-- step 2 only flips tables that need flipping, and enabling RLS on a table
-- that already has it is a no-op.

-- ── 1. The verdict: which public tables have RLS off? ──────────────────
-- Expected result: zero rows. Any table listed here is one INSERT away
-- from being publicly readable, because Supabase grants table privileges
-- to the anon role by default and RLS is the only thing filtering it.
select relname as "table with RLS OFF"
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
  and not relrowsecurity
order by relname;

-- ── 2. The fix: enable RLS on anything the audit caught ────────────────
-- A table with RLS enabled and NO policies is locked shut (deny-all) for
-- anon and authenticated — which is the correct default for any table
-- that only SECURITY DEFINER functions should touch (kit_interest is
-- built that way on purpose). So blanket-enabling cannot break a public
-- page: everything public already flows through definer RPCs.
do $$
declare t text; n int := 0;
begin
  for t in
    select relname from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r' and not relrowsecurity
  loop
    execute format('alter table %I enable row level security', t);
    n := n + 1;
    raise notice 'RLS enabled on %', t;
  end loop;
  raise notice 'Done: % table(s) fixed (0 means everything was already locked).', n;
end $$;

-- ── 3. For the record: tables locked shut (RLS on, zero policies) ──────
-- Informational only. These are deny-all to the API — fine and intended
-- for function-only tables; investigate only if a table the APP reads
-- directly ever shows up here.
select c.relname as "deny-all table (RLS on, no policies)"
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = c.relname)
order by c.relname;
