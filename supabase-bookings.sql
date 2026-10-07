-- ============================================================
-- GYM-EVENT BOOKINGS — additive migration.
--
-- Apply this AFTER supabase-setup.sql (it depends on orgs, sessions,
-- records, my_org_ids(), and the public_join_slug column). Like every
-- other change in this project it is purely additive: new column, new
-- table, new functions — nothing here forks or drops existing data.
--
-- What it adds:
--   1. a 'gym_class' session type + a price (in integer pennies)
--   2. a `bookings` table (org-scoped, same RLS loop as everything else)
--   3. three SECURITY DEFINER RPCs so a NOT-logged-in member can list
--      bookable classes and reserve a seat — the same pattern as
--      register_runner (an anon caller has no membership row, so a plain
--      RLS insert would silently save nothing).
-- ============================================================

-- ── 1. Gym classes live on the existing `sessions` table ────────────
-- A gym class is just another session type, so it reuses everything
-- Sessions/Hub already do (chapter, time, capacity). Two additive changes:
-- widen the type CHECK to allow 'gym_class', and add a price.
alter table sessions drop constraint if exists sessions_type_check;
alter table sessions add constraint sessions_type_check
  check (type in ('run','hub_workshop','hub_training','hub_networking','gym_class'));

-- Price in integer pennies (e.g. £10.00 = 1000). NULL / 0 = free class.
-- Integer pennies, never a float: £10.00 has no exact binary float, and
-- Stripe itself takes amounts in the smallest currency unit, so pennies
-- pass straight through with no conversion or rounding.
alter table sessions add column if not exists price_pennies int not null default 0;

-- ── 2. Bookings ─────────────────────────────────────────────────────
-- One row per seat reserved. runner_id is nullable: a member can book
-- without ever having a CRM record (they give a name + contact on the
-- booking form), and staff can reconcile later.
--
-- status lifecycle:
--   pending   — seat held while the member is in Stripe Checkout
--   confirmed — free class, or paid class after payment succeeds
--   cancelled — released
-- A held ('pending') seat counts against capacity so two people can't
-- pay for the last mat at once; see book_gym_session below.
create table if not exists bookings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs (id) on delete cascade,
  session_id     uuid not null references sessions (id) on delete cascade,
  runner_id      uuid references records (id) on delete set null,
  full_name      text not null,
  email          text,
  phone          text,
  status         text not null default 'pending'
                 check (status in ('pending','confirmed','cancelled')),
  amount_pennies int  not null default 0,
  stripe_ref     text,          -- Stripe Checkout Session id, once known
  created_at     timestamptz not null default now()
);

create index if not exists bookings_session_idx on bookings (session_id);

-- RLS: staff (with a membership) see their org's bookings. The public
-- never SELECTs this table directly — they go through the definer RPCs
-- below, which is why no anon policy is needed here.
alter table bookings enable row level security;
drop policy if exists "bookings_org_select" on bookings;
drop policy if exists "bookings_org_insert" on bookings;
drop policy if exists "bookings_org_update" on bookings;
drop policy if exists "bookings_org_delete" on bookings;
create policy "bookings_org_select" on bookings for select using (org_id in (select my_org_ids()));
create policy "bookings_org_insert" on bookings for insert with check (org_id in (select my_org_ids()));
create policy "bookings_org_update" on bookings for update using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy "bookings_org_delete" on bookings for delete using (org_id in (select my_org_ids()));

-- ── 3a. Public: list bookable gym classes for this deployment ───────
-- Resolves the org from the slug (never a caller-supplied org_id), and
-- returns only future gym classes with a live seat count. seats_left =
-- capacity minus every seat that is confirmed OR currently held pending.
-- NULL capacity = uncapped, surfaced as a large sentinel the UI treats
-- as "always available".
create or replace function list_gym_classes(p_slug text)
returns table (
  id            uuid,
  title         text,
  location      text,
  starts_at     timestamptz,
  price_pennies int,
  capacity      int,
  seats_left    int
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.title,
    s.location,
    s.starts_at,
    s.price_pennies,
    s.capacity,
    case
      when s.capacity is null then 9999
      else greatest(
        s.capacity - (
          select count(*) from bookings b
          where b.session_id = s.id and b.status in ('pending','confirmed')
        ),
        0
      )
    end as seats_left
  from sessions s
  join orgs o on o.id = s.org_id
  where o.public_join_slug = p_slug
    and s.type = 'gym_class'
    and (s.starts_at is null or s.starts_at > now() - interval '2 hours')
  order by s.starts_at asc nulls last
$$;
grant execute on function list_gym_classes(text) to anon, authenticated;

-- ── 3b. Public: reserve a seat ──────────────────────────────────────
-- Serialises per-session with a transaction-scoped advisory lock so two
-- simultaneous callers can't both grab the last seat, then re-checks
-- capacity inside the lock. Free classes are confirmed immediately; paid
-- classes come back 'pending' for the caller to send to Stripe. Returns
-- the new booking id, the amount owed, and the status so the front-end
-- knows whether to route to payment.
create or replace function book_gym_session(
  p_slug      text,
  p_session_id uuid,
  p_full_name text,
  p_email     text default null,
  p_phone     text default null
)
returns table (booking_id uuid, amount_pennies int, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_org_id   uuid;
  v_session  sessions%rowtype;
  v_taken    int;
  v_status   text;
  v_id       uuid;
begin
  select id into v_org_id from orgs where public_join_slug = p_slug;
  if v_org_id is null then
    raise exception 'Unknown booking link';
  end if;
  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Name is required to book';
  end if;

  -- Only one booking transaction per session proceeds past this point.
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select * into v_session from sessions
    where id = p_session_id and org_id = v_org_id and type = 'gym_class';
  if not found then
    raise exception 'That class is not available to book';
  end if;

  if v_session.capacity is not null then
    select count(*) into v_taken from bookings
      where session_id = p_session_id and status in ('pending','confirmed');
    if v_taken >= v_session.capacity then
      raise exception 'Sorry — that class is fully booked';
    end if;
  end if;

  v_status := case when coalesce(v_session.price_pennies, 0) = 0 then 'confirmed' else 'pending' end;

  insert into bookings (org_id, session_id, full_name, email, phone, status, amount_pennies)
  values (
    v_org_id, p_session_id, trim(p_full_name),
    nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    v_status, coalesce(v_session.price_pennies, 0)
  )
  returning id into v_id;

  return query select v_id, coalesce(v_session.price_pennies, 0), v_status;
end;
$$;
grant execute on function book_gym_session(text, uuid, text, text, text) to anon, authenticated;

-- ── 3c. Public: mark a booking paid ─────────────────────────────────
-- Called when the member returns from Stripe Checkout. NOTE: for a demo
-- this is client-triggered, which is fine to *show* the flow but is NOT
-- tamper-proof — a real deployment should confirm via a Stripe webhook
-- (checkout.session.completed) carrying the signing secret, and this
-- function should then only run server-side from that webhook. Left here,
-- and clearly flagged, as the exact seam to harden.
create or replace function mark_booking_paid(p_booking_id uuid, p_stripe_ref text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update bookings
     set status = 'confirmed',
         stripe_ref = coalesce(p_stripe_ref, stripe_ref)
   where id = p_booking_id and status = 'pending';
end;
$$;
grant execute on function mark_booking_paid(uuid, text) to anon, authenticated;
