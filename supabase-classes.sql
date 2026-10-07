-- ============================================================
-- CLASS BOOKING SYSTEM — Section 1: schema, roles, RLS.
--
-- Implements the Made Running class-booking flow chart. Every table and
-- column below carries the flow-chart step it serves, so the schema can
-- be read against the diagram without a translation layer.
--
-- Apply AFTER supabase-setup.sql (depends on orgs, memberships,
-- my_org_ids(), chapters). Purely ADDITIVE — nothing here drops or
-- rewrites existing data. The one destructive-looking statement is the
-- memberships role CHECK, which is replaced with a SUPERSET of itself.
--
-- NOTE on supabase-bookings.sql: that earlier migration created a
-- `bookings` table for one-off gym sessions. It is NOT superseded and NOT
-- dropped — if it was never run, leave it unrun. This system uses its own
-- `class_bookings` table because the shapes genuinely differ (groups,
-- sources, waitlists, refunds). Two small tables beat one table with half
-- its columns null.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 0. ROLES — add 'coach' (decision 14)
-- ════════════════════════════════════════════════════════════
-- A coach is a MEMBERSHIP ROLE, not a separate table. The alternative —
-- a `coaches` table keyed to auth.users — would mean two sources of truth
-- for "who is this person here", and the org-scoping would have to be
-- re-derived every time. Role on membership means a coach at one club is
-- automatically not a coach at another, for free.
--
-- Replacing the CHECK rather than adding one: Postgres ANDs multiple
-- CHECKs together, so adding a second constraint listing 'coach' would
-- still fail against the original that omits it.
alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('owner','admin','coach','member','viewer'));


-- ── Role helpers ────────────────────────────────────────────
-- All SECURITY DEFINER so RLS policies can call them without recursing
-- back through the very policies they are evaluating.

-- The caller's role in one org. NULL when they are not a member.
create or replace function my_role_in(p_org_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from memberships where user_id = auth.uid() and org_id = p_org_id limit 1
$$;

-- Staff = owner/admin. Deliberately EXCLUDES coach: a coach is trusted
-- with their own classes, never with the club-wide view. That distinction
-- is the whole point of the three-dashboard split.
create or replace function is_org_staff(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('owner','admin') from memberships
      where user_id = auth.uid() and org_id = p_org_id limit 1),
    false)
$$;

-- Every membership row belonging to the caller, across all their orgs.
-- classes.coach_id points at memberships(id), so this is how a coach's
-- own classes are identified in a policy.
create or replace function my_membership_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from memberships where user_id = auth.uid()
$$;


-- ════════════════════════════════════════════════════════════
-- 1. CLASSES — the named, renameable thing (Steps 1, 2, 3)
-- ════════════════════════════════════════════════════════════
-- "The Valleys Club" is a CLASS. It owns a timetable of dated sessions.
-- This two-level split is what makes Step 3 possible at all: a class link
-- has to open something durable that shows "that class's own timetable",
-- which a single dated row cannot do.
--
-- RENAMING: nothing anywhere stores a class NAME. Pages, links, dashboards,
-- reports and notifications all resolve it by class_id at read time, so a
-- rename propagates everywhere with no migration and no stale copies.
--
-- The LINK is the slug (decision 11: one link per class, not per session).
create table if not exists classes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs (id) on delete cascade,
  chapter_id    uuid references chapters (id) on delete set null,

  -- Coach attribution, two fields on purpose.
  -- coach_id links to a membership once that coach has a login.
  -- coach_name is the human name shown on the class (Step 1) and works
  -- before any coach has an account — which is the state the club is in
  -- today. Without the text field, seeding the real timetable would mean
  -- inventing twelve logins first.
  coach_id      uuid references memberships (id) on delete set null,
  coach_name    text,

  name          text not null,           -- renameable, never hard-coded
  slug          text not null,           -- the shareable link (Step 2)
  description   text,
  location      text,

  -- Decision 13: a session CANNOT override this. Capacity lives here and
  -- only here, so "max 40, configurable per class" has exactly one home.
  capacity      int  not null default 40 check (capacity > 0),

  -- Decision 12: price per CLASS, not per session.
  -- Integer pennies, never a float: £10.00 has no exact binary float, and
  -- Stripe takes the smallest currency unit, so pennies pass straight
  -- through with no conversion or rounding. 0 = free.
  price_pennies int  not null default 0 check (price_pennies >= 0),

  -- Decision 10: sessions are GENERATED from a weekly rule, not keyed in.
  -- day 0=Sunday..6=Saturday to match Postgres extract(dow) and JS getDay()
  -- so no translation table is ever needed.
  -- time as `time` not text: Postgres then sorts and adds intervals itself.
  recurrence_day   int  check (recurrence_day between 0 and 6),
  recurrence_time  time,
  generate_weeks   int  not null default 8 check (generate_weeks between 1 and 52),

  -- Female-only and paused come straight from the real Hub timetable.
  -- paused keeps a class VISIBLE but unbookable — hiding it would read as
  -- cancelled to members who know it exists.
  female_only   boolean not null default false,
  is_paused     boolean not null default false,
  pause_note    text,
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),

  -- Slug is the public URL. Unique per ORG, not globally, so two clubs on
  -- this platform can both have a "yoga" class without a collision.
  unique (org_id, slug)
);

create index if not exists classes_org_idx   on classes (org_id);
create index if not exists classes_coach_idx on classes (coach_id);


-- ════════════════════════════════════════════════════════════
-- 2. CLASS SESSIONS — the dated occurrences (Steps 3, 4, 13)
-- ════════════════════════════════════════════════════════════
-- One row per actual date you can book. Generated from the class's weekly
-- rule by generate_class_sessions() below.
--
-- No capacity column (decision 13) — capacity is read from the parent
-- class. Storing a copy here would let the two drift, and the first time
-- they disagreed nobody would know which was right.
create table if not exists class_sessions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs (id) on delete cascade,
  class_id      uuid not null references classes (id) on delete cascade,

  starts_at     timestamptz not null,

  -- Step 13: a coach cancels a whole session. The row is NEVER deleted —
  -- reports must still show it happened, and the people who were booked
  -- need to keep seeing why their booking ended.
  status        text not null default 'scheduled'
                check (status in ('scheduled','cancelled')),
  cancelled_at  timestamptz,
  cancelled_by  uuid references auth.users (id) on delete set null,
  cancel_reason text,

  created_at    timestamptz not null default now(),

  -- Stops the generator creating the same occurrence twice when it is
  -- re-run, which it will be — weekly, forever.
  unique (class_id, starts_at)
);

create index if not exists class_sessions_class_idx on class_sessions (class_id, starts_at);
create index if not exists class_sessions_org_idx   on class_sessions (org_id, starts_at);


-- ════════════════════════════════════════════════════════════
-- 3. CLASS BOOKINGS — one row per booking (Steps 4b–9, W1–W3)
-- ════════════════════════════════════════════════════════════
-- A GROUP IS ONE ROW, not N rows. places=5 means five seats.
-- This is what makes "Sarah + 4" a single dashboard line (your rule), and
-- what makes decision 4 (reduce a group's places) a single UPDATE rather
-- than a delete-some-of-these-rows problem.
--
-- The consequence, stated plainly because it is easy to get wrong later:
-- capacity maths must be SUM(places), never COUNT(*). Any future query
-- that counts rows will silently let a full class take more bookings.
create table if not exists class_bookings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs (id) on delete cascade,
  -- class_id is denormalised from the session on purpose: every dashboard
  -- and report groups by class, and carrying it avoids a join on the
  -- hottest read path in the system.
  class_id       uuid not null references classes (id) on delete cascade,
  session_id     uuid not null references class_sessions (id) on delete cascade,

  -- NULL = guest (no account). This is the link the User dashboard filters
  -- on. Deliberately auth.users and NOT records: the runner↔record link in
  -- this project is by EMAIL and email is not unique on records, which is
  -- fine for a profile page but is not sound as a security boundary.
  booker_user_id uuid references auth.users (id) on delete set null,

  booker_name    text not null,
  booker_phone   text,
  booker_email   text,          -- required for guests, enforced in the RPC

  -- Step 4b
  booked_for     text not null default 'me'
                 check (booked_for in ('me','someone_else','group')),
  attendee_name  text,          -- someone_else
  attendee_phone text,          -- someone_else

  places         int not null default 1 check (places > 0),
  -- Audit trail for decision 4. When a group of 5 drops to 3, places
  -- becomes 3 and this keeps 5, so reports can still show what was
  -- originally taken rather than quietly rewriting history.
  original_places int,

  -- Every booking remembers where it came from (your explicit rule).
  source         text not null default 'website'
                 check (source in ('group_chat','website','walk_in')),

  -- Payment. Three real-world states from your rules:
  --   online    + paid     → paid online
  --   on_arrival+ unpaid   → pay on arrival, not yet paid
  --   on_arrival+ paid     → paid on arrival (coach/admin marked it)
  payment_method text not null default 'on_arrival'
                 check (payment_method in ('online','on_arrival')),
  payment_status text not null default 'unpaid'
                 check (payment_status in ('unpaid','paid','refunded')),
  paid_at        timestamptz,
  stripe_ref     text,

  -- Decisions 1 & 2: always refundable, and automatic when a coach cancels.
  refunded_at        timestamptz,
  stripe_refund_ref  text,
  refund_reason      text,

  status         text not null default 'confirmed'
                 check (status in ('confirmed','cancelled')),
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users (id) on delete set null,

  -- Lets a GUEST manage their own booking. They have no login, so without
  -- an unguessable token there is no way for them to cancel (Step 11) or
  -- claim a waiting-list place. gen_random_uuid() is a CSPRNG here.
  manage_token   uuid not null default gen_random_uuid(),

  created_at     timestamptz not null default now()
);

create index if not exists class_bookings_session_idx on class_bookings (session_id);
create index if not exists class_bookings_user_idx    on class_bookings (booker_user_id);
create index if not exists class_bookings_class_idx   on class_bookings (class_id);
create unique index if not exists class_bookings_token_idx on class_bookings (manage_token);


-- ════════════════════════════════════════════════════════════
-- 4. WAITING LIST (decision 3)
-- ════════════════════════════════════════════════════════════
-- A SEPARATE table, not a booking status. If waitlisted people lived in
-- class_bookings they would have to be excluded from every capacity sum
-- forever, and the first query that forgot would overbook the class.
-- Different table = the capacity maths cannot see them at all.
--
-- Promotion rule (your decision): pay-on-arrival is auto-booked and
-- emailed; pay-online gets a time-limited claim link, because we cannot
-- charge a card without the person present.
create table if not exists class_waitlist (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs (id) on delete cascade,
  class_id       uuid not null references classes (id) on delete cascade,
  session_id     uuid not null references class_sessions (id) on delete cascade,

  user_id        uuid references auth.users (id) on delete set null,
  name           text not null,
  phone          text,
  email          text not null,   -- required: the ONLY way to reach them

  places         int  not null default 1 check (places > 0),
  payment_method text not null default 'on_arrival'
                 check (payment_method in ('online','on_arrival')),

  status         text not null default 'waiting'
                 check (status in ('waiting','offered','converted','expired','left')),
  offered_at     timestamptz,
  expires_at     timestamptz,     -- 12h claim window for online payers
  claim_token    uuid not null default gen_random_uuid(),
  booking_id     uuid references class_bookings (id) on delete set null,

  created_at     timestamptz not null default now()
);

-- Position in the queue is created_at order — no `position` column, which
-- would need renumbering every time someone leaves the list.
create index if not exists class_waitlist_session_idx on class_waitlist (session_id, created_at);
create unique index if not exists class_waitlist_token_idx on class_waitlist (claim_token);


-- ════════════════════════════════════════════════════════════
-- 5. DASHBOARD NOTIFICATIONS (Steps 8, 12, 14)
-- ════════════════════════════════════════════════════════════
-- Your rule: communication to coaches and admin happens on DASHBOARDS
-- ONLY, never to their phones. Making that a table rather than a
-- convention means the system has no mechanism to text them even by
-- accident — there is nowhere for a phone number to be read from here.
create table if not exists dashboard_notifications (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs (id) on delete cascade,

  -- Either aimed at a role (every admin) or one specific user (this coach).
  recipient_role text check (recipient_role in ('admin','coach')),
  recipient_user_id uuid references auth.users (id) on delete cascade,

  kind           text not null
                 check (kind in ('new_booking','user_cancelled',
                                 'session_cancelled','walk_in','waitlist_joined')),
  class_id       uuid references classes (id) on delete cascade,
  session_id     uuid references class_sessions (id) on delete set null,
  booking_id     uuid references class_bookings (id) on delete set null,
  body           text,

  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists dash_notif_org_idx  on dashboard_notifications (org_id, created_at desc);
create index if not exists dash_notif_user_idx on dashboard_notifications (recipient_user_id, read_at);


-- ════════════════════════════════════════════════════════════
-- 6. ROW-LEVEL SECURITY — role-aware, not just org-aware
-- ════════════════════════════════════════════════════════════
-- Every other table in this project uses one org-scoped policy:
--   org_id in (select my_org_ids())
-- which means "any member may see anything belonging to their club".
-- That is NOT sufficient here. Your spec says a coach sees only their own
-- classes and a user sees only their own bookings, and RequireStaff.jsx
-- already documents that hiding a screen is not the same as protecting it.
-- So these policies are scoped by ROLE and by OWNERSHIP, in SQL, where a
-- member editing their own JavaScript cannot reach.

alter table classes                 enable row level security;
alter table class_sessions          enable row level security;
alter table class_bookings          enable row level security;
alter table class_waitlist          enable row level security;
alter table dashboard_notifications enable row level security;

-- ── classes ──────────────────────────────────────────────────
-- Read: any member of the org may SEE the class list (they need to, to
-- book). Write: admins, or the coach who owns that class.
drop policy if exists classes_select on classes;
create policy classes_select on classes for select
  using (org_id in (select my_org_ids()));

drop policy if exists classes_insert on classes;
create policy classes_insert on classes for insert
  with check (is_org_staff(org_id));

drop policy if exists classes_update on classes;
create policy classes_update on classes for update
  using (is_org_staff(org_id) or coach_id in (select my_membership_ids()))
  with check (is_org_staff(org_id) or coach_id in (select my_membership_ids()));

drop policy if exists classes_delete on classes;
create policy classes_delete on classes for delete
  using (is_org_staff(org_id));

-- ── class_sessions ───────────────────────────────────────────
drop policy if exists class_sessions_select on class_sessions;
create policy class_sessions_select on class_sessions for select
  using (org_id in (select my_org_ids()));

drop policy if exists class_sessions_write on class_sessions;
create policy class_sessions_write on class_sessions for all
  using (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
  )
  with check (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
  );

-- ── class_bookings — the one that actually matters ───────────
-- Three-way read: admin sees the club; coach sees ONLY their classes'
-- bookings; everyone else sees ONLY their own. Guests are not covered here
-- at all — they have no JWT, and reach their booking through the
-- SECURITY DEFINER RPCs (Section 4) keyed on manage_token.
drop policy if exists class_bookings_select on class_bookings;
create policy class_bookings_select on class_bookings for select
  using (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or booker_user_id = auth.uid()
  );

-- Staff and coaches write directly (walk-ins, marking paid, cancelling a
-- session). Members book through the definer RPC, which is why there is no
-- broad member INSERT policy: an anon/guest caller has no membership row,
-- so a plain RLS insert would silently save nothing.
drop policy if exists class_bookings_insert on class_bookings;
create policy class_bookings_insert on class_bookings for insert
  with check (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
  );

-- A user may UPDATE their own booking — that is how Step 11 (cancel) and
-- decision 4 (reduce places) work for signed-in people.
drop policy if exists class_bookings_update on class_bookings;
create policy class_bookings_update on class_bookings for update
  using (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or booker_user_id = auth.uid()
  )
  with check (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or booker_user_id = auth.uid()
  );

-- No DELETE policy anywhere, deliberately. Cancellation sets a status;
-- bookings are never removed, because reports have to keep showing them.

-- ── class_waitlist ───────────────────────────────────────────
drop policy if exists class_waitlist_select on class_waitlist;
create policy class_waitlist_select on class_waitlist for select
  using (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or user_id = auth.uid()
  );

drop policy if exists class_waitlist_write on class_waitlist;
create policy class_waitlist_write on class_waitlist for all
  using (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or user_id = auth.uid()
  )
  with check (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or user_id = auth.uid()
  );

-- ── dashboard_notifications ──────────────────────────────────
-- Addressed to you personally, or to the admin role and you are an admin.
drop policy if exists dash_notif_select on dashboard_notifications;
create policy dash_notif_select on dashboard_notifications for select
  using (
    recipient_user_id = auth.uid()
    or (recipient_role = 'admin' and is_org_staff(org_id))
  );

drop policy if exists dash_notif_update on dashboard_notifications;
create policy dash_notif_update on dashboard_notifications for update
  using (
    recipient_user_id = auth.uid()
    or (recipient_role = 'admin' and is_org_staff(org_id))
  )
  with check (
    recipient_user_id = auth.uid()
    or (recipient_role = 'admin' and is_org_staff(org_id))
  );


-- ════════════════════════════════════════════════════════════
-- 7. CAPACITY — one definition, used everywhere
-- ════════════════════════════════════════════════════════════
-- Defined ONCE as a function so no screen can invent its own version.
-- SUM(places), not COUNT(*) — a group of 5 occupies 5 seats.
-- coalesce because SUM over zero rows is NULL, and NULL would make
-- seats_left NULL and every "12 of 40 left" label render blank.
create or replace function session_seats_taken(p_session_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(places), 0)::int
    from class_bookings
   where session_id = p_session_id
     and status = 'confirmed'
$$;

create or replace function session_seats_left(p_session_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select greatest(
    (select c.capacity
       from class_sessions s join classes c on c.id = s.class_id
      where s.id = p_session_id)
    - session_seats_taken(p_session_id),
    0)
$$;


-- ════════════════════════════════════════════════════════════
-- 8. SESSION GENERATION (decision 10)
-- ════════════════════════════════════════════════════════════
-- Turns each class's weekly rule into dated, bookable sessions N weeks
-- ahead. Idempotent: the unique(class_id, starts_at) index means re-running
-- it inserts only the genuinely new weeks, so this can be run daily,
-- weekly, or by hand with the same result.
--
-- This is the alternative to a coach re-keying twelve classes every week
-- forever, and it is why the class stores a rule rather than a date.
create or replace function generate_class_sessions(p_org_id uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_class   classes%rowtype;
  v_start   date;
  v_date    date;
  v_made    int := 0;
  v_weeks   int;
begin
  for v_class in
    select * from classes
     where is_active
       and recurrence_day is not null
       and recurrence_time is not null
       and (p_org_id is null or org_id = p_org_id)
  loop
    v_weeks := v_class.generate_weeks;

    -- First occurrence on/after today matching the class's weekday.
    -- (7 + target - current) % 7 lands on today when they already match,
    -- which is correct: a class later today is still bookable.
    v_start := current_date
             + ((7 + v_class.recurrence_day - extract(dow from current_date)::int) % 7);

    for i in 0 .. (v_weeks - 1) loop
      v_date := v_start + (i * 7);
      insert into class_sessions (org_id, class_id, starts_at)
      values (
        v_class.org_id,
        v_class.id,
        -- Built in the CLUB's timezone, not UTC. Composing a timestamptz
        -- from a local date+time and letting Postgres convert is what keeps
        -- a 9.30am class at 9.30am across the BST/GMT switch. Storing a
        -- fixed UTC offset would shift every class by an hour in October.
        (v_date + v_class.recurrence_time) at time zone 'Europe/London'
      )
      on conflict (class_id, starts_at) do nothing;
      if found then v_made := v_made + 1; end if;
    end loop;
  end loop;

  return v_made;
end;
$$;

grant execute on function generate_class_sessions(uuid) to authenticated;


-- ════════════════════════════════════════════════════════════
-- 9. SLUG HELPER
-- ════════════════════════════════════════════════════════════
-- "The Valleys Club" → "the-valleys-club". Used when a class is created so
-- the shareable link (Step 2) is generated from the class record rather
-- than typed by hand.
--
-- The slug is NOT regenerated on rename: the link a coach already pasted
-- into WhatsApp must keep working. The NAME updates everywhere (it is
-- always read from this row); the URL stays put. Renaming a class must not
-- silently kill every link already in circulation.
create or replace function slugify(p_text text)
returns text
language sql immutable as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'))
$$;


-- ════════════════════════════════════════════════════════════
-- 10. IS THIS SESSION BOOKABLE? — one gate, used by every screen
-- ════════════════════════════════════════════════════════════
-- Returns the FIRST reason a session cannot be booked, or 'ok'.
--
-- Why a single function and not an `if` on each page: the public class page,
-- the booking RPC, the walk-in form and the waitlist join all have to agree
-- on this. If each screen decided for itself, the page would say "full" and
-- the RPC would happily take the booking anyway — and that disagreement is
-- exactly how a class ends up with 41 people in a room for 40.
--
-- The UI never hard-codes these words; it maps the code to a message, so
-- the class NAME in that message is still read from the class record.
--
--   'ok'               → take the booking
--   'full'             → 0 seats. Offer the WAITING LIST (your decision).
--   'not_enough_seats' → seats left, but fewer than this group asked for.
--                        NOT the same as full, and the difference is the
--                        whole of decision 4: "only 2 places left — book for
--                        2, or join the waiting list for all 5". Collapsing
--                        it into 'full' would tell a group of 5 the class is
--                        closed while three mats sit empty.
--   'paused'           → no waiting list; show "contact <coach_name> directly"
--   'cancelled'        → this one date is off; other weeks may be fine
--   'past'             → the 15-minute grace window has closed
--
-- p_places is why this takes a second argument: the gate has to answer
-- "can THIS booking fit", not "is the session open". A session with one mat
-- left is open to a single booker and closed to a group of two, and only the
-- caller knows which one is asking.
drop function if exists session_bookable(uuid);
create or replace function session_bookable(p_session_id uuid, p_places int default 1)
returns text
language sql stable security definer set search_path = public as $$
  select case
    -- ORDER OF CHECKS IS PROVISIONAL. You asked to settle this after the
    -- build, so it lives in this one CASE and nowhere else — revisiting it
    -- later is reordering these lines, not hunting through screens.
    -- Current order: most specific and most permanent first.
    when s.status = 'cancelled'                        then 'cancelled'
    when now() > s.starts_at + interval '15 minutes'   then 'past'
    when c.is_paused                                   then 'paused'
    when session_seats_left(s.id) <= 0                 then 'full'
    when session_seats_left(s.id) < greatest(coalesce(p_places, 1), 1)
                                                       then 'not_enough_seats'
    else 'ok'
  end
  from class_sessions s
  join classes c on c.id = s.class_id
  where s.id = p_session_id
$$;

-- The 15-minute grace window (your decision): someone standing outside the
-- Hub at 9.31 for a 9.30 class can still book and pay.
--
-- It is a GRACE window, not a late-booking feature, and the difference
-- matters to the coach: 15 minutes is short enough that the register the
-- coach reads at the door is still the register they planned the session
-- from. A longer window would mean people appearing on the list after the
-- warm-up, which is the no-show problem in reverse — a name the coach has
-- already counted as absent.
--
-- Deliberately NOT a per-class column. Per-class grace would be twelve
-- different answers to "am I too late?", and no member would know which
-- one applied to them. If the club later wants one class to differ, this
-- is the single place to widen.

-- Bulk version, so a timetable page gets every status in one round trip
-- instead of one call per row. Same CASE, evaluated by the database.
--
-- Takes p_places too, so the timetable re-reads correctly the moment a
-- member changes their group size from 1 to 5 — the same class list can
-- legitimately show different states to the same person.
drop function if exists list_session_states(uuid);
create or replace function list_session_states(p_class_id uuid, p_places int default 1)
returns table (session_id uuid, starts_at timestamptz, seats_left int, state text)
language sql stable security definer set search_path = public as $$
  select s.id, s.starts_at, session_seats_left(s.id), session_bookable(s.id, p_places)
    from class_sessions s
   where s.class_id = p_class_id
   order by s.starts_at asc
$$;

grant execute on function session_bookable(uuid, int)    to anon, authenticated;
grant execute on function list_session_states(uuid, int) to anon, authenticated;
grant execute on function session_seats_left(uuid)       to anon, authenticated;
grant execute on function session_seats_taken(uuid)      to anon, authenticated;


-- ============================================================
-- END Section 1. Next: Section 2 — coach class management + links.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 11. THE PUBLIC CLASS PAGE (Step 3) — reading a class with no account
-- ════════════════════════════════════════════════════════════
-- This exists because of a wall that is easy to miss until the page is
-- built and blank. Read the classes policy again:
--
--   create policy classes_select on classes for select
--     using (org_id in (select my_org_ids()));
--
-- my_org_ids() reads the caller's MEMBERSHIP rows. An EXTERNAL visitor —
-- the person arriving from the website timetable, which your spec names as
-- one of the three user types — has no account, therefore no membership,
-- therefore zero rows. Not an error: an empty result. The public class page
-- would have rendered "class not found" for precisely the audience it is
-- built for, and it would have done so silently.
--
-- Widening classes_select to `true` would have been the one-line fix and is
-- the wrong one: it hands the whole platform's class list, across every
-- club on it, to anyone with the anon key (which ships in the JS bundle).
-- So the public read is a SECURITY DEFINER function with a narrow contract
-- instead — the same shape BookGym already uses (list_gym_classes).
--
-- ── Why the org slug is an ARGUMENT ──────────────────────────
-- classes is `unique (org_id, slug)` — slug is unique per CLUB, not
-- globally. Two clubs on this platform may both have a 'yoga' class, so a
-- lone class slug is not enough to identify a row.
--
-- The org is passed in, resolved from the deployment's tenant key, exactly
-- as BookGym passes tenant.key. That keeps the shared URL as short as
-- /c/hot-kettlebells-mon-0930 — which is the whole reason it is /c/ and not
-- /class/ (decision: it gets pasted into WhatsApp, where a long URL wraps).
--
-- The cost, stated so it is not a surprise later: one domain serves one
-- club. If this platform is ever hosted for several clubs on a SINGLE
-- domain, /c/:slug needs to become /c/:org/:slug. That is a routing change
-- only — this signature already takes the org, so no data migration.
--
-- ── What it deliberately does NOT return ─────────────────────
-- coach_id. It is a memberships uuid, the public has no use for it, and a
-- SECURITY DEFINER function is exactly the wrong place to leak internal
-- ids. coach_name is the public fact ("with Jade"); coach_id is plumbing.
--
-- ⚠️  THIS FUNCTION IS DEFINED TWICE IN THIS FILE, AND SECTION 12 WINS.
-- Section 3b re-creates it below with four extra columns (coach_slug,
-- coach_bio, coach_photo_url, coach_credentials) for the coach panel. This
-- version stays so the file still reads in the order the work was built, but
-- it is superseded a few hundred lines down — so if you are changing a column,
-- change it in SECTION 12 or your edit is silently overwritten on next run.
--
-- The drop below is what makes this file RE-RUNNABLE, and that is not a
-- nicety. Postgres cannot `create or replace` a function whose return type
-- changed, so on a database already migrated to the Section 12 shape this
-- statement fails — and it fails HERE, half way in, leaving Sections 13 and 14
-- (public_coaches, public_classes) never created. Re-running the setup file to
-- check it worked is a normal thing to do; it must not half-apply.
drop function if exists public_class_by_slug(text, text);
create or replace function public_class_by_slug(p_org_slug text, p_class_slug text)
returns table (
  id            uuid,
  name          text,
  coach_name    text,
  description   text,
  location      text,
  capacity      int,
  price_pennies int,
  recurrence_day  int,
  recurrence_time time,
  female_only   boolean,
  is_paused     boolean,
  pause_note    text
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.name, c.coach_name, c.description, c.location,
    c.capacity, c.price_pennies, c.recurrence_day, c.recurrence_time,
    c.female_only, c.is_paused, c.pause_note
  from classes c
  join orgs o on o.id = c.org_id
  where o.public_join_slug = p_org_slug
    and c.slug = p_class_slug
    -- is_active is checked here and not in the page. A retired class must
    -- 404, not render as bookable — but a PAUSED one must still render.
    -- Those are different states and the SQL comment on the column says why:
    -- hiding a paused class reads as "cancelled" to members who know it
    -- exists, so paused comes back and the page shows the reason.
    and c.is_active
$$;

grant execute on function public_class_by_slug(text, text) to anon, authenticated;

-- ── Step 4's data ────────────────────────────────────────────
-- Not a new function: the public page calls list_session_states() from
-- Section 10 with the id this returns. That is deliberate reuse, not
-- laziness — capacity is defined once (SUM(places), never COUNT(*)) and a
-- second "public" copy of the same maths is how the two versions
-- eventually disagree about whether a class is full.
--
-- Note on exposure, so nobody has to re-derive it: list_session_states is
-- SECURITY DEFINER and granted to anon, so a caller holding a class uuid
-- can read that class's dates and seat counts without being a member. That
-- is intended — it IS the public timetable. It carries no personal data
-- (dates, an integer, a state string), and reaching a class you were not
-- given requires guessing a v4 uuid.



-- ════════════════════════════════════════════════════════════
-- 12. COACH BIOS, CLASS VIDEO, CLASS RATINGS (Step 3, extended)
-- ════════════════════════════════════════════════════════════
-- Added after Section 3 was first built, to your requirement: the class page
-- shows the class as a card on a calendar, the coach's bio is readable, the
-- description can carry a short video, and the class shows its rating.
--
-- ── Why coaches become a TABLE and not three more columns ────
-- The obvious move is `alter table classes add column coach_bio text`. It is
-- one line and it is wrong, because of the data that is already seeded:
--
--   Micah        teaches Hot Kettlebells Mon 7.30pm AND Sat 7.30pm
--   K3 & Marvin  teach The Valley Wed 6.45pm AND Fri 10.45am
--
-- A bio on `classes` means Micah's bio is stored twice. Two copies with no
-- owner is not a style problem — it is a guarantee that one day they differ
-- and nobody can say which is current. The bio belongs to the PERSON, so the
-- person needs a row.
--
-- It cannot hang off `memberships` either, which is where coach_id points:
-- no coach at this club has a login yet (that is why classes.coach_name
-- exists at all), so keying bios to a login would mean inventing twelve
-- accounts before the club could write a sentence about anyone.
create table if not exists coaches (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs (id) on delete cascade,

  -- Same split as classes, for the same reason: `slug` is the stable key,
  -- `name` is the renameable display value. A coach changing how their name
  -- is written must not re-key their bio.
  slug       text not null,
  name       text not null,

  -- Once a coach DOES have a login this links them, and the coach's own
  -- dashboard (Section 7) can then be scoped through it. Nullable because
  -- today none of them do.
  membership_id uuid references memberships (id) on delete set null,

  bio        text,
  photo_url  text,
  -- Free text on purpose. "Level 3 PT, kettlebell specialist" is the sort of
  -- thing a club writes; an enum would force someone to pick from a list the
  -- club did not write.
  credentials text,

  is_active  boolean not null default true,
  created_at timestamptz not null default now(),

  unique (org_id, slug),
  -- https only, checked in the DATABASE rather than only in the form. This
  -- value is rendered into an <img src>, and a check constraint is the one
  -- place a bad value cannot get in through — a future admin screen, a direct
  -- SQL edit or an import all pass through here.
  constraint coaches_photo_https
    check (photo_url is null or photo_url ~* '^https://')
);

create index if not exists coaches_org_idx on coaches (org_id);

-- Link classes to the coach record. coach_name STAYS: it is the fallback for
-- a class whose coach has no profile row yet (the PDF names no coach for Dog
-- Business HIIT), and dropping it would break the seeded timetable.
alter table classes add column if not exists coach_profile_id uuid
  references coaches (id) on delete set null;

-- A short clip of the class, shown with the description (your requirement).
-- https-only for the same reason as photo_url, and it matters more here: this
-- URL ends up as an <iframe src>. A `javascript:` or `data:` URL in an iframe
-- is script execution on the public page, so the constraint is a real control
-- and not tidiness. The UI additionally allowlists the HOST — see videoEmbed()
-- in src/lib/classes.js. Two layers, because either alone has a gap: the
-- constraint cannot tell YouTube from an attacker's https site, and the
-- client check can be bypassed by anything that writes to the table directly.
alter table classes add column if not exists video_url text;
alter table classes add column if not exists video_caption text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'classes_video_https'
  ) then
    alter table classes add constraint classes_video_https
      check (video_url is null or video_url ~* '^https://');
  end if;
end $$;

-- ── The class card's photo band (timetable artwork) ─────────────────
-- A single landscape image shown as a ~90px strip across the TOP of the
-- class card on /book, and as a wider banner on the class page.
--
-- Deliberately not called photo_url, which already means something else in
-- this schema: coaches.photo_url is a person's headshot. A class's artwork is
-- a different kind of thing with a different aspect ratio, and reusing the
-- name across two tables is how someone later writes the headshot into the
-- banner slot.
--
-- https-only, same as coaches.photo_url and video_url. This one renders into
-- an <img src> rather than an <iframe src>, so it cannot execute script the
-- way a bad video_url could — but a http:// image on an https page is blocked
-- as mixed content and shows as a broken icon, which is its own kind of
-- "the club's site looks broken".
--
-- NO host allowlist here, unlike video_url. An <img> from an arbitrary host
-- cannot run code; the worst case is a hotlink that breaks or a tracking
-- pixel. Forcing an allowlist would mean the club could not use whatever
-- Canva/Drive/CDN URL they already have, which is the realistic way these
-- get filled in.
alter table classes add column if not exists image_url text;

-- What the club should keep in frame. The card crops to roughly 330x90 and
-- the class page banner is much wider, so the same file is cropped two ways
-- and the interesting part is not always the middle. Stored as a CSS
-- object-position value ('center', 'top', '50% 30%') and written straight
-- into the style attribute — constrained below precisely BECAUSE it is.
alter table classes add column if not exists image_focus text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'classes_image_https'
  ) then
    alter table classes add constraint classes_image_https
      check (image_url is null or image_url ~* '^https://');
  end if;

  -- image_focus ends up inside a style attribute, so it is an injection
  -- surface even though it is "just an alignment". The allowlist is the whole
  -- control: keywords, or one/two percentage values. Anything containing a
  -- semicolon, a brace or the word `url(` cannot match.
  if not exists (
    select 1 from pg_constraint where conname = 'classes_image_focus_safe'
  ) then
    alter table classes add constraint classes_image_focus_safe
      check (
        image_focus is null
        or image_focus ~ '^(left|right|top|bottom|center)( (left|right|top|bottom|center))?$'
        or image_focus ~ '^[0-9]{1,3}% [0-9]{1,3}%$'
      );
  end if;
end $$;

alter table coaches enable row level security;

-- Read: members of the club. The PUBLIC page does not use this policy — it
-- reads through public_class_by_slug() below, exactly like classes.
drop policy if exists coaches_select on coaches;
create policy coaches_select on coaches for select
  using (org_id in (select my_org_ids()));

-- Write: staff, or the coach editing their own row once they have a login.
drop policy if exists coaches_write on coaches;
create policy coaches_write on coaches for all
  using (is_org_staff(org_id) or membership_id in (select my_membership_ids()))
  with check (is_org_staff(org_id) or membership_id in (select my_membership_ids()));


-- ── RATINGS ─────────────────────────────────────────────────
-- Ratings are attached to a BOOKING, not just to a class, and that is the
-- whole design. "Anyone may rate any class" is a spam form: it costs nothing
-- to leave fifty one-star reviews on a rival's class, and a rating nobody
-- earned tells a member nothing.
--
-- Tying each rating to a booking row means a rating is only possible from
-- someone the register says was there, and the unique index below means one
-- booking rates once. It also gives a guest a way in without an account —
-- they hold their booking's manage_token (Section 3 of this file).
create table if not exists class_ratings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  class_id    uuid not null references classes (id) on delete cascade,
  session_id  uuid references class_sessions (id) on delete set null,

  -- The proof of attendance. Nullable ONLY so a coach/admin can enter a
  -- rating collected on paper; see the insert policy.
  booking_id  uuid references class_bookings (id) on delete set null,
  user_id     uuid references auth.users (id) on delete set null,

  -- Display name shown against the review. Deliberately a separate field
  -- from the booker's name so the club can show "Sarah K." rather than a
  -- full name, and so a public review never has to read the bookings table.
  rater_name  text,

  stars       int not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists class_ratings_class_idx on class_ratings (class_id);
-- Partial, because booking_id is nullable for paper entries and a plain
-- unique constraint would then allow only ONE of those per class.
create unique index if not exists class_ratings_booking_idx
  on class_ratings (booking_id) where booking_id is not null;

alter table class_ratings enable row level security;

drop policy if exists class_ratings_select on class_ratings;
create policy class_ratings_select on class_ratings for select
  using (org_id in (select my_org_ids()));

-- Insert: staff, the coach of that class, or the person whose booking it is.
-- There is no "any member may rate" branch.
drop policy if exists class_ratings_insert on class_ratings;
create policy class_ratings_insert on class_ratings for insert
  with check (
    is_org_staff(org_id)
    or class_id in (select id from classes where coach_id in (select my_membership_ids()))
    or booking_id in (select id from class_bookings where booker_user_id = auth.uid())
  );


-- ── The public read, rebuilt ─────────────────────────────────
-- DROP FIRST. Postgres will not `create or replace` a function whose RETURN
-- TYPE changed — it fails with "cannot change return type of existing
-- function" — and the signature here gains eight columns. Exactly the same
-- trap as session_bookable() in Section 10, which needed a drop to take its
-- second argument.
drop function if exists public_class_by_slug(text, text);
create or replace function public_class_by_slug(p_org_slug text, p_class_slug text)
returns table (
  id            uuid,
  name          text,
  coach_name    text,
  description   text,
  location      text,
  capacity      int,
  price_pennies int,
  recurrence_day  int,
  recurrence_time time,
  female_only   boolean,
  is_paused     boolean,
  pause_note    text,
  -- Added in Section 12
  -- coach_slug is the STABLE key, and it is what /coaches#<slug> is built
  -- from. Deliberately not the coach's name: "K3 & Marvin" slugified from the
  -- display value would change the moment someone fixed the spelling, and
  -- every link a coach had pasted into the group chat would stop landing on
  -- them. Note this is coaches.slug, NOT coaches.membership_id — a
  -- memberships uuid has no business on a public page.
  coach_slug    text,
  coach_bio     text,
  coach_photo_url text,
  coach_credentials text,
  video_url     text,
  video_caption text,
  image_url     text,
  image_focus   text,
  rating_avg    numeric,
  rating_count  int
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    -- The coach PROFILE wins when one exists; classes.coach_name is the
    -- fallback for a class whose coach has no row yet. coalesce and not a
    -- plain join, so linking a profile is an improvement rather than a
    -- migration that must happen before the page works.
    coalesce(co.name, c.coach_name) as coach_name,
    c.description, c.location,
    c.capacity, c.price_pennies, c.recurrence_day, c.recurrence_time,
    c.female_only, c.is_paused, c.pause_note,
    co.slug, co.bio, co.photo_url, co.credentials,
    c.video_url, c.video_caption,
    c.image_url, c.image_focus,
    -- Rounded to 1dp in SQL. Sending 4.333333333333333 to the browser and
    -- rounding it there means every screen that forgets shows a different
    -- number for the same class.
    (select round(avg(r.stars)::numeric, 1) from class_ratings r where r.class_id = c.id),
    (select count(*)::int          from class_ratings r where r.class_id = c.id)
  from classes c
  left join coaches co
         on co.id = c.coach_profile_id
        and co.is_active
  join orgs o on o.id = c.org_id
  where o.public_join_slug = p_org_slug
    and c.slug = p_class_slug
    and c.is_active
$$;

grant execute on function public_class_by_slug(text, text) to anon, authenticated;

-- ── Public reviews ──────────────────────────────────────────
-- Separate call, not folded into the row above, because it is a LIST and the
-- page wants the class immediately — the reviews can arrive a moment later
-- without holding up the title, the coach or the timetable.
--
-- Returns ONLY rater_name, stars, comment and date. No booking id, no user
-- id, no email. A SECURITY DEFINER function is precisely where an
-- over-broad `select *` becomes a public data leak, so the column list is
-- written out rather than inherited.
create or replace function public_class_reviews(
  p_org_slug text,
  p_class_slug text,
  p_limit int default 6
)
returns table (rater_name text, stars int, comment text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(trim(r.rater_name), ''), 'Made Running member'),
    r.stars,
    r.comment,
    r.created_at
  from class_ratings r
  join classes c on c.id = r.class_id
  join orgs o    on o.id = c.org_id
  where o.public_join_slug = p_org_slug
    and c.slug = p_class_slug
    -- Star-only ratings still count towards the average (above) but have
    -- nothing to show in a list of reviews.
    and r.comment is not null
    and trim(r.comment) <> ''
  order by r.created_at desc
  limit greatest(least(coalesce(p_limit, 6), 50), 1)
$$;

grant execute on function public_class_reviews(text, text, int) to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 13 · Class booking — the "Made Running Coaches" page
-- ═══════════════════════════════════════════════════════════════════
-- One public page, /coaches, that is the home of every coach's bio.
--
-- Why a dedicated page rather than only the panel on /c/:slug:
--
--   A bio belongs to the PERSON. Micah teaches Hot Kettlebells on Monday AND
--   Saturday; Jade teaches CaTcH a Circuit AND the Monday morning class; K3 &
--   Marvin teach both Valley sessions. Eight coaches cover twelve classes. Put
--   the bio only on the class page and the same paragraph is read in two
--   places with no page that owns it — and a coach who wants their own write-up
--   corrected has nowhere to point at.
--
-- The class page still shows a short coach panel (that reader is deciding
-- whether to book THIS class, and sending them away mid-decision is a good way
-- to lose the booking). It links to /coaches#<slug> for the full write-up.
-- Same data, one owner.
--
-- PUBLIC, not in-app. The whole point of the class page is that it is opened
-- from a link pasted into a WhatsApp group by someone who is not signed in. A
-- coaches page behind RequireAuth could not be linked from it for the audience
-- that actually reads it.

-- ── Why this needs a definer function, again ────────────────────────
-- coaches_select is `using (org_id in (select my_org_ids()))`. To an
-- anonymous visitor that is not an error — my_org_ids() returns nothing, the
-- predicate matches nothing, and the page renders "no coaches yet" with
-- nothing in any log. Verified: with SELECT granted to anon (Supabase's
-- default) the table read returns 0 rows.
--
-- Columns are listed explicitly. membership_id is ABSENT on purpose: it is an
-- internal memberships uuid, it is of no use to a visitor, and a definer
-- function is exactly where `select *` quietly becomes a public leak.
--
-- The classes each coach teaches come back as a jsonb array in the same row.
-- The alternative is one query per coach to fill in "teaches Yoga on
-- Thursdays" — one extra round trip per coach on a page whose entire job is
-- to list them.
create or replace function public_coaches(p_org_slug text)
returns table (
  slug        text,
  name        text,
  bio         text,
  photo_url   text,
  credentials text,
  classes     jsonb,
  rating_avg  numeric,
  rating_count int
)
language sql stable security definer set search_path = public as $$
  select
    co.slug,
    co.name,
    co.bio,
    co.photo_url,
    co.credentials,
    -- coalesce to an empty array, never null: a coach between timetables must
    -- render as a bio with no classes, and `null.map()` is a blank page.
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'slug',            c.slug,
                   'name',            c.name,
                   'recurrence_day',  c.recurrence_day,
                   'recurrence_time', c.recurrence_time,
                   'location',        c.location,
                   'female_only',     c.female_only,
                   'is_paused',       c.is_paused
                 )
                 order by c.recurrence_day, c.recurrence_time
               )
        from classes c
        where c.coach_profile_id = co.id
          and c.is_active
      ),
      '[]'::jsonb
    ) as classes,
    -- Rated across everything they teach. A coach's Monday class having one
    -- 5-star review and their Saturday class none is not two different
    -- coaches, and averaging in SQL keeps this figure identical to the
    -- per-class one on /c/:slug.
    (
      select round(avg(r.stars)::numeric, 1)
      from class_ratings r
      join classes c2 on c2.id = r.class_id
      where c2.coach_profile_id = co.id
    ),
    (
      select count(*)::int
      from class_ratings r
      join classes c2 on c2.id = r.class_id
      where c2.coach_profile_id = co.id
    )
  from coaches co
  join orgs o on o.id = co.org_id
  where o.public_join_slug = p_org_slug
    and co.is_active
  -- Alphabetical. Any "featured" ordering would need a column, and inventing
  -- a pecking order among a club's own coaches is not a decision to make in
  -- an ORDER BY clause.
  order by co.name
$$;

grant execute on function public_coaches(text) to anon, authenticated;


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 14 · THE WHOLE TIMETABLE, FOR THE PUBLIC /book PAGE
-- ═════════════════════════════════════════════════════════════════════
--
-- Class booking · Section 3c. /book shows every class in the week as a card,
-- and each card carries its rating and opens a panel with its video. That is
-- twelve classes' worth of ratings and video URLs.
--
-- ── Why this function exists at all ─────────────────────────────────
-- public_class_by_slug already returns exactly this data for ONE class. Twelve
-- cards could therefore be twelve calls — and on a phone on gym wifi that is
-- twelve round trips before the timetable finishes painting, to render a page
-- whose entire job is to show all of them at once. One call returns the set.
--
-- ── Why not widen classes_select instead ────────────────────────────
-- Same reason as every other public read here, and it is worth repeating
-- because the failure is silent: classes_select is `org_id in (select
-- my_org_ids())`. A visitor arriving from the WhatsApp link has no membership
-- row, so that matches nothing and the table read returns ZERO ROWS — not an
-- error, not a 403, nothing in any log. The page would simply say the club has
-- no classes. security definer is what lets an anonymous visitor read the
-- public timetable without opening the members table to the internet.
--
-- ── What is deliberately NOT returned ───────────────────────────────
-- No coach_profile_id, no org_id, no membership ids, and no seat counts. This
-- is the shape of the WEEK, not the state of any one session — live
-- availability belongs to list_session_states, which is per-class and
-- per-group-size. Columns are listed one by one rather than `select *`,
-- because inside a security definer function `*` is how a column added in six
-- months' time becomes a public leak nobody reviewed.
-- `create or replace` CANNOT add a column to a `returns table (...)`
-- signature. Postgres refuses with "cannot change return type of existing
-- function" and the whole script stops there — which, run in the Supabase SQL
-- Editor, leaves the database half-migrated with no obvious indication of how
-- far it got.
--
-- This file is meant to be re-runnable (create-or-replace, `if not exists`,
-- `drop policy if exists` throughout), and a signature that grows breaks that
-- promise. The drop restores it. Matches the pattern already used for
-- public_class_by_slug at two points above.
--
-- Safe to drop: nothing in the database depends on this function. It is called
-- only from the client, and the grant below is re-applied immediately.
drop function if exists public_classes(text);

create or replace function public_classes(p_org_slug text)
returns table (
  slug text,
  name text,
  coach_name text,
  coach_slug text,
  description text,
  location text,
  capacity int,
  price_pennies int,
  recurrence_day int,
  recurrence_time time,
  female_only boolean,
  is_paused boolean,
  pause_note text,
  video_url text,
  video_caption text,
  image_url text,
  image_focus text,
  rating_avg numeric,
  rating_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.slug,
    c.name,
    -- The linked profile's name wins over the free-text column, so correcting
    -- a spelling on the coach record fixes it everywhere the club is shown.
    coalesce(co.name, c.coach_name) as coach_name,
    co.slug as coach_slug,
    c.description,
    c.location,
    c.capacity,
    c.price_pennies,
    c.recurrence_day,
    c.recurrence_time,
    c.female_only,
    c.is_paused,
    c.pause_note,
    c.video_url,
    c.video_caption,
    c.image_url,
    c.image_focus,
    -- NULL when nobody has rated it. The UI must branch on the COUNT, never
    -- format the average: avg() over no rows is null, and a never-rated class
    -- that renders "0.0" is telling members it was rated badly.
    (select round(avg(r.stars)::numeric, 1) from class_ratings r where r.class_id = c.id),
    (select count(*)::int from class_ratings r where r.class_id = c.id)
  from classes c
  left join coaches co on co.id = c.coach_profile_id and co.is_active
  join orgs o on o.id = c.org_id
  where o.public_join_slug = p_org_slug
    and c.is_active
  -- Monday first, matching how the club reads its own week. recurrence_day
  -- follows Postgres dow (0 = Sunday), so Sunday is pushed to the end rather
  -- than opening the timetable.
  order by case when c.recurrence_day = 0 then 7 else c.recurrence_day end,
           c.recurrence_time
$$;

grant execute on function public_classes(text) to anon, authenticated;
