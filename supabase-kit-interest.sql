-- ── Kit interest list ────────────────────────────────────────────────────────
-- Backs the "Notify me when the kit drops" form on the landing page's Shop
-- section (QA, Oct 2026: the old "Coming soon" pill looked like a dead button
-- and the section did nothing). One email, one promise: a single message when
-- the first drop lands.
--
-- Same shape as the booking chain: the table is RLS-locked with NO policies,
-- so the anon key can neither read nor write it directly. The only door in is
-- kit_notify(), a SECURITY DEFINER function that validates, lowercases and
-- de-duplicates. The landing page treats PGRST202 ("function not found") as
-- "this feature is switched off" and says so honestly instead of pretending
-- the email was saved — so it is safe to deploy the frontend before running
-- this file.
--
-- Run in the Supabase SQL editor (project syltimnnqynqcfbrbswq).

create table if not exists public.kit_interest (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.kit_interest enable row level security;
-- No policies on purpose: nobody reads this table through the API. Staff
-- export it from the dashboard when the drop is ready.

create or replace function public.kit_notify(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mirror of the frontend check, enforced server-side because the frontend
  -- is advisory. Reject rather than silently drop so the UI can show a real
  -- error instead of a false "you're on the list".
  if p_email is null or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email';
  end if;

  insert into kit_interest (email)
  values (lower(trim(p_email)))
  on conflict (email) do nothing;
  -- Duplicate signups succeed silently: "you're on the list" is true either
  -- way, and distinguishing them would leak who has already signed up.
end;
$$;

revoke all on function public.kit_notify(text) from public;
grant execute on function public.kit_notify(text) to anon, authenticated;
