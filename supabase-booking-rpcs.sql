-- ════════════════════════════════════════════════════════════════════
-- Made Running — the booking WRITE path (flow-chart steps 4–14, W1–W3)
--
-- Run AFTER supabase-classes.sql, supabase-classes-seed.sql and
-- supabase-coaches-seed.sql. Safe to re-run: every function is
-- CREATE OR REPLACE and nothing here creates or alters a table.
--
-- ── Why all writes go through functions and not the tables ──────────
-- The booking rules are not presentation, they are money and capacity:
-- "40 places", "a group of 5 uses 5", "never overbook", "a cancellation
-- frees the places immediately". A rule enforced in React is enforced
-- only for people using React — it is bypassed by a second tab, a stale
-- page, a future coach app, or anyone with the anon key and curl.
-- Enforced in a SECURITY DEFINER function it is enforced for everyone,
-- so the RLS policies can stay simple: nobody writes these tables
-- directly at all.
-- ════════════════════════════════════════════════════════════════════


-- ── Who counts as "staff" for a REGISTER ────────────────────────────
-- A deliberate sibling of is_org_staff(), not a replacement for it.
--
-- is_org_staff() means `role in ('owner','admin')`. That is the right
-- meaning where it is already used — it is the gate in ~22 RLS policies
-- in supabase-classes.sql covering classes, bookings, ratings, coaches
-- and notifications. Widening THAT function to include coaches to make
-- registers work would, in one word, hand every coach write access to
-- every one of those tables across the whole org. The blast radius is
-- invisible from here and the bug would surface months later.
--
-- So: a second, narrower predicate. This one answers only "may you be
-- shown a register at all?", and each function that uses it then applies
-- the coach wall — a coach who passes this test still sees nothing but
-- their own classes. Admins pass both and see everything.
create or replace function is_class_staff(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('owner','admin','coach') from memberships
      where user_id = auth.uid() and org_id = p_org_id limit 1),
    false)
$$;


-- ── The coach wall, in ONE place ────────────────────────────────────
-- "Admin sees everything. A coach sees only their own classes." Written
-- once here because it is a rule, and a rule copied into four functions
-- is four chances to copy it slightly wrong — the copy that is wrong is
-- the one that leaks another coach's register.
--
-- Note the id spaces: classes.coach_id is a MEMBERSHIPS id, while
-- auth.uid() is a USER id. Comparing them directly is silently false
-- forever — it never errors, it just walls out every coach.
create or replace function may_manage_class(p_org_id uuid, p_coach_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_class_staff(p_org_id)
     and (
       my_role_in(p_org_id) in ('owner','admin')
       or p_coach_id = (select m.id from memberships m
                         where m.user_id = auth.uid()
                           and m.org_id = p_org_id limit 1)
     )
$$;


-- ── Step 4–9: make a booking ────────────────────────────────────────
-- Returns jsonb rather than a row so one call can answer all of
-- "booked", "that class is full", "it already started" and "you need to
-- give us an email" — each of which the booking page renders
-- differently. An exception would collapse them all into one 500.
create or replace function book_hub_class(
  p_slug           text,
  p_class_slug     text,
  p_full_name      text,
  p_email          text default null,
  p_phone          text default null,
  p_booked_for     text default 'me',
  p_attendee_name  text default null,
  p_places         int  default 1,
  p_payment_method text default 'on_arrival',
  p_source         text default 'website'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id     uuid;
  v_class      classes%rowtype;
  v_session_id uuid;
  v_starts_at  timestamptz;
  v_state      text;
  v_places     int := greatest(coalesce(p_places, 1), 1);
  v_booking    class_bookings%rowtype;
  v_coach_user uuid;
begin
  -- Clamp the inputs that came from a browser and therefore cannot be
  -- trusted. A check constraint would reject these with a 500; a clamp
  -- turns a malformed request into a sane booking.
  if p_booked_for not in ('me', 'someone_else', 'group') then
    p_booked_for := 'me';
  end if;
  if p_payment_method not in ('online', 'on_arrival') then
    p_payment_method := 'on_arrival';
  end if;
  if p_source not in ('group_chat', 'website', 'walk_in') then
    p_source := 'website';
  end if;
  -- Only a group may take more than one place. Otherwise "just me" with
  -- places=40 empties a class in one request.
  if p_booked_for <> 'group' then
    v_places := 1;
  end if;

  select id into v_org_id from orgs where public_join_slug = p_slug;
  if v_org_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_org');
  end if;

  select * into v_class
    from classes
   where org_id = v_org_id and slug = p_class_slug and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_class');
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'name_required');
  end if;

  -- A guest with no email cannot be reached, cannot be sent a manage
  -- link, and cannot be offered a waiting-list place. A signed-in member
  -- always has one on their account, so this only ever stops guests.
  if auth.uid() is null and coalesce(trim(p_email), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'email_required');
  end if;

  -- The next occurrence that has not already run. The 15-minute grace
  -- matches session_bookable() so a late arrival can still be booked in
  -- by a coach rather than being told the class does not exist.
  select s.id, s.starts_at into v_session_id, v_starts_at
    from class_sessions s
   where s.class_id = v_class.id
     and s.status = 'scheduled'
     and s.starts_at > now() - interval '15 minutes'
   order by s.starts_at
   limit 1;

  if v_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session',
                              'class_name', v_class.name);
  end if;

  -- ── The lock that makes "never overbook" true ───────────────────
  -- Without this, two people booking the last two places both read
  -- seats_left = 2, both pass the check, and both insert: 41 people for
  -- 40 spaces, discovered by a coach at the door.
  --
  -- session_bookable() is STABLE, so re-reading it in the same statement
  -- would re-use the same snapshot and could not see the other booking
  -- even in principle. Taking a row lock on the SESSION first means the
  -- second caller blocks here until the first commits, and its next
  -- statement then runs on a snapshot that includes that commit.
  --
  -- The lock is on class_sessions and not class_bookings deliberately:
  -- it is the session that has a capacity, and locking the thing being
  -- exhausted serialises exactly the callers who compete for it. Two
  -- people booking DIFFERENT classes never wait for each other.
  perform 1 from class_sessions where id = v_session_id for update;

  v_state := session_bookable(v_session_id, v_places);
  if v_state <> 'ok' then
    return jsonb_build_object(
      'ok',         false,
      'reason',     v_state,
      'class_name', v_class.name,
      'session_id', v_session_id,
      'starts_at',  v_starts_at,
      'seats_left', session_seats_left(v_session_id)
    );
  end if;

  insert into class_bookings (
    org_id, class_id, session_id, booker_user_id,
    booker_name, booker_phone, booker_email,
    booked_for, attendee_name, places, original_places,
    source, payment_method,
    -- A free class is never "unpaid" — leaving it unpaid would put every
    -- free booking on the coach's "still to pay" list forever.
    payment_status
  ) values (
    v_org_id, v_class.id, v_session_id, auth.uid(),
    trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    p_booked_for,
    case when p_booked_for = 'someone_else'
         then nullif(trim(coalesce(p_attendee_name, '')), '') end,
    v_places, v_places,
    p_source, p_payment_method,
    case when v_class.price_pennies = 0 then 'paid' else 'unpaid' end
  )
  returning * into v_booking;

  -- ── Step 10: tell the dashboards, never the phones ──────────────
  -- Your rule: coaches and admin are told on their dashboard only. This
  -- writes a row; it does not send anything.
  select m.user_id into v_coach_user
    from memberships m where m.id = v_class.coach_id;

  insert into dashboard_notifications
    (org_id, recipient_role, kind, class_id, session_id, booking_id, body)
  values
    (v_org_id, 'admin', 'new_booking', v_class.id, v_session_id, v_booking.id,
     trim(p_full_name)
       || case when v_places > 1 then ' + ' || (v_places - 1) else '' end
       || ' booked ' || v_class.name);

  if v_coach_user is not null then
    insert into dashboard_notifications
      (org_id, recipient_role, recipient_user_id, kind, class_id, session_id, booking_id, body)
    values
      -- recipient_role is stated as well as recipient_user_id. The RLS
      -- policy only needs the user id (its first branch is
      -- `recipient_user_id = auth.uid()`), so the row was already visible
      -- to the right coach with the role left null — but a null role makes
      -- the row un-filterable: an admin screen asking "show me what the
      -- coaches were told" gets nothing back, and the column's own
      -- ('admin'|'coach') vocabulary quietly stops describing the table.
      (v_org_id, 'coach', v_coach_user, 'new_booking', v_class.id, v_session_id, v_booking.id,
       trim(p_full_name)
         || case when v_places > 1 then ' + ' || (v_places - 1) else '' end
         || ' booked ' || v_class.name);
  end if;

  return jsonb_build_object(
    'ok',            true,
    'booking_id',    v_booking.id,
    -- The guest's only key to their own booking (Step 11). A signed-in
    -- member does not need it, but returning it always keeps the client
    -- from having to branch on whether it should expect one.
    'manage_token',  v_booking.manage_token,
    'class_name',    v_class.name,
    'starts_at',     v_starts_at,
    'places',        v_places,
    'seats_left',    session_seats_left(v_session_id),
    'payment_method', p_payment_method,
    'total_pennies', v_class.price_pennies * v_places
  );
end $$;


-- ── Step 12: join the waiting list when a class is full ─────────────
create or replace function join_class_waitlist(
  p_slug           text,
  p_class_slug     text,
  p_full_name      text,
  p_email          text,
  p_phone          text default null,
  p_places         int  default 1,
  p_payment_method text default 'on_arrival'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id     uuid;
  v_class      classes%rowtype;
  v_session_id uuid;
  v_id         uuid;
  v_token      uuid;
  v_places     int := greatest(coalesce(p_places, 1), 1);
begin
  select id into v_org_id from orgs where public_join_slug = p_slug;
  if v_org_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_org');
  end if;

  select * into v_class from classes
   where org_id = v_org_id and slug = p_class_slug and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_class');
  end if;

  -- Email is NOT NULL on class_waitlist because it is the only way to
  -- tell someone a place came free. A waiting-list entry we cannot
  -- contact is a row that wastes the member's time.
  if coalesce(trim(p_email), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'email_required');
  end if;

  select s.id into v_session_id
    from class_sessions s
   where s.class_id = v_class.id
     and s.status = 'scheduled'
     and s.starts_at > now()
   order by s.starts_at
   limit 1;

  if v_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  -- Already waiting? Return the existing place rather than adding a
  -- second one. Someone who refreshes and re-submits should not end up
  -- behind themselves in the queue.
  select id, claim_token into v_id, v_token
    from class_waitlist
   where session_id = v_session_id
     and status = 'waiting'
     and lower(email) = lower(trim(p_email))
   limit 1;

  if v_id is null then
    insert into class_waitlist
      (org_id, class_id, session_id, user_id, name, email, phone,
       places, payment_method)
    values
      (v_org_id, v_class.id, v_session_id, auth.uid(),
       trim(p_full_name), trim(p_email),
       nullif(trim(coalesce(p_phone, '')), ''), v_places, p_payment_method)
    returning id, claim_token into v_id, v_token;

    insert into dashboard_notifications
      (org_id, recipient_role, kind, class_id, session_id, body)
    values
      (v_org_id, 'admin', 'waitlist_joined', v_class.id, v_session_id,
       trim(p_full_name) || ' joined the waiting list for ' || v_class.name);
  end if;

  return jsonb_build_object(
    'ok', true, 'waitlist_id', v_id, 'claim_token', v_token,
    'class_name', v_class.name,
    'position', (select count(*) from class_waitlist w
                  where w.session_id = v_session_id
                    and w.status = 'waiting'
                    and w.created_at <= (select created_at from class_waitlist where id = v_id))
  );
end $$;


-- ── Step 11: the guest's own booking, read back from their token ────
-- Needed because there is no anon SELECT policy on class_bookings at all
-- (by design), so /booking/:token would otherwise render an empty page for
-- the one person entitled to see it. RLS does not error for an
-- unauthorised read, it returns zero rows — which looks exactly like a
-- cancelled booking.
--
-- The token IS the credential: a v4 uuid, unguessable, handed out once. So
-- the safety property here is not "who is asking" but "what is returned":
-- only the single row matching the token, and only the fields that person
-- already typed in or needs in order to decide whether to cancel. No
-- org-wide totals, no other attendees, no ids that could be used to walk
-- to another booking.
create or replace function public_booking_by_token(p_token uuid)
returns table (
  booking_id     uuid,
  class_name     text,
  starts_at      timestamptz,
  booker_name    text,
  attendee_name  text,
  places         int,
  payment_method text,
  payment_status text,
  total_pennies  int,
  status         text,
  session_status text,
  location       text
)
language sql stable security definer set search_path = public as $$
  select b.id, c.name, s.starts_at, b.booker_name, b.attendee_name,
         b.places, b.payment_method, b.payment_status,
         (c.price_pennies * b.places)::int,
         b.status, s.status, c.location
    from class_bookings b
    join classes c        on c.id = b.class_id
    join class_sessions s on s.id = b.session_id
   where b.manage_token = p_token
   limit 1
$$;


-- ── Step 11 + 14: cancel a booking, and free the places at once ─────
-- Accepts EITHER the guest's manage_token OR a booking id belonging to
-- the signed-in member. Two ways in, one set of rules.
create or replace function cancel_class_booking(
  p_manage_token uuid default null,
  p_booking_id   uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b      class_bookings%rowtype;
  v_class  classes%rowtype;
  v_next   class_waitlist%rowtype;
  v_seats  int;
begin
  if p_manage_token is not null then
    select * into v_b from class_bookings where manage_token = p_manage_token;
  elsif p_booking_id is not null and auth.uid() is not null then
    select * into v_b from class_bookings
     where id = p_booking_id and booker_user_id = auth.uid();
  end if;

  if v_b.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_b.status = 'cancelled' then
    -- Not an error. Someone clicking their cancel link twice should be
    -- told they are cancelled, not that something went wrong.
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select * into v_class from classes where id = v_b.class_id;

  update class_bookings
     set status       = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid()
   where id = v_b.id;

  -- The places are free the instant that UPDATE commits: every capacity
  -- read sums `places` WHERE status = 'confirmed', so there is no
  -- separate "release" step that could be missed or run late.
  v_seats := session_seats_left(v_b.session_id);

  insert into dashboard_notifications
    (org_id, recipient_role, kind, class_id, session_id, booking_id, body)
  values
    (v_b.org_id, 'admin', 'user_cancelled', v_b.class_id, v_b.session_id, v_b.id,
     v_b.booker_name || ' cancelled ' || coalesce(v_class.name, 'a class'));

  -- The COACH is told too, and this one matters more than the admin copy:
  -- the coach is the person who walks into the room with a register and
  -- counts heads. A cancellation they were not told about is the same
  -- problem as an overbooking, just in the other direction — they hold a
  -- place for someone who is not coming.
  --
  -- Written here rather than left to the admin row because the admin row is
  -- invisible to a coach: the RLS policy's admin branch is gated on
  -- is_org_staff(), which excludes coaches by design.
  insert into dashboard_notifications
    (org_id, recipient_role, recipient_user_id, kind, class_id, session_id, booking_id, body)
  select v_b.org_id, 'coach', m.user_id, 'user_cancelled',
         v_b.class_id, v_b.session_id, v_b.id,
         v_b.booker_name || ' cancelled ' || coalesce(v_class.name, 'a class')
           || ' — ' || v_seats || ' place(s) now free'
    from memberships m
   where m.id = v_class.coach_id;

  -- ── Step 14: offer the free place to the front of the queue ─────
  -- Marked 'offered' rather than converted straight to a booking: the
  -- person has not said yes, and silently booking someone who may no
  -- longer want it would re-fill the class with a ghost.
  select * into v_next
    from class_waitlist
   where session_id = v_b.session_id
     and status = 'waiting'
     and places <= v_seats
   order by created_at
   limit 1;

  if v_next.id is not null then
    update class_waitlist
       set status     = 'offered',
           offered_at = now(),
           expires_at = now() + interval '12 hours'
     where id = v_next.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'class_name', v_class.name,
    'seats_left', v_seats,
    'offered_to', v_next.name
  );
end $$;


-- ── The User dashboard's own list (Step 10c) ────────────────────────
-- Filtered to auth.uid() inside the function, so "a user sees only their
-- own bookings" is a property of the query and not of a client filter
-- somebody can remove.
create or replace function my_class_bookings()
returns table (
  booking_id   uuid,
  class_name   text,
  starts_at    timestamptz,
  places       int,
  status       text,
  session_status text,
  payment_method text,
  payment_status text,
  price_pennies  int,
  manage_token uuid
)
language sql stable security definer set search_path = public as $$
  select b.id, c.name, s.starts_at, b.places, b.status, s.status,
         b.payment_method, b.payment_status, c.price_pennies, b.manage_token
    from class_bookings b
    join classes c        on c.id = b.class_id
    join class_sessions s on s.id = b.session_id
   where b.booker_user_id = auth.uid()
   order by s.starts_at desc
$$;


-- ── W1–W3: a coach or admin adds a walk-in ──────────────────────────
create or replace function staff_add_walk_in(
  p_session_id uuid,
  p_full_name  text,
  p_places     int  default 1,
  p_paid       boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s      class_sessions%rowtype;
  v_class  classes%rowtype;
  v_places int := greatest(coalesce(p_places, 1), 1);
  v_b      class_bookings%rowtype;
  v_state  text;
begin
  select * into v_s from class_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_session');
  end if;

  select * into v_class from classes where id = v_s.class_id;

  -- Staff only, and for a coach only their OWN class. Checked here rather
  -- than trusted from the client: this function can mark money as received.
  -- Note this now runs AFTER the class is loaded, because the wall needs
  -- to know whose class it is.
  if not may_manage_class(v_s.org_id, v_class.coach_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  perform 1 from class_sessions where id = p_session_id for update;

  -- A walk-in still cannot overbook the room. The coach is standing in
  -- it and can see it is full, but the register must agree with them.
  v_state := session_bookable(p_session_id, v_places);
  if v_state not in ('ok') then
    return jsonb_build_object('ok', false, 'reason', v_state,
                              'seats_left', session_seats_left(p_session_id));
  end if;

  insert into class_bookings
    (org_id, class_id, session_id, booker_name, booked_for, places,
     original_places, source, payment_method, payment_status, paid_at)
  values
    (v_s.org_id, v_s.class_id, p_session_id, trim(p_full_name),
     case when v_places > 1 then 'group' else 'me' end,
     v_places, v_places, 'walk_in', 'on_arrival',
     case when p_paid or v_class.price_pennies = 0 then 'paid' else 'unpaid' end,
     case when p_paid or v_class.price_pennies = 0 then now() end)
  returning * into v_b;

  insert into dashboard_notifications
    (org_id, recipient_role, kind, class_id, session_id, booking_id, body)
  values
    (v_s.org_id, 'admin', 'walk_in', v_s.class_id, p_session_id, v_b.id,
     trim(p_full_name) || ' walked in to ' || v_class.name);

  return jsonb_build_object('ok', true, 'booking_id', v_b.id,
                            'seats_left', session_seats_left(p_session_id));
end $$;


-- ── The Coach dashboard's register (Step 10b) ───────────────────────
-- A coach sees THEIR sessions only; an admin sees any. Both walls are
-- one may_manage_class() test here, not a client-side filter.
create or replace function staff_session_register(p_session_id uuid)
returns table (
  booking_id     uuid,
  display_name   text,
  places         int,
  source         text,
  payment_status text,
  status         text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_s class_sessions%rowtype;
  v_c classes%rowtype;
begin
  select * into v_s from class_sessions where id = p_session_id;
  if not found then
    return;                       -- no rows, not an error
  end if;
  select * into v_c from classes where id = v_s.class_id;

  -- Staff gate and coach wall in one call. Returning no rows rather than
  -- raising means an unauthorised caller cannot tell an empty class from a
  -- forbidden one, and the dashboards render "nobody booked yet" instead
  -- of an error box.
  if not may_manage_class(v_s.org_id, v_c.coach_id) then
    return;
  end if;

  return query
  select b.id,
         -- Your "Sarah + 4" rule, formatted once here so every register,
         -- report and dashboard says it the same way.
         b.booker_name
           || case when b.places > 1 then ' + ' || (b.places - 1) else '' end,
         b.places, b.source, b.payment_status, b.status
    from class_bookings b
   where b.session_id = p_session_id
   order by b.status, b.created_at;
end $$;


-- ── Step 13: a coach cancels a whole session ────────────────────────
create or replace function cancel_class_session(
  p_session_id uuid,
  p_reason     text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s class_sessions%rowtype;
  v_c classes%rowtype;
  v_n int;
begin
  select * into v_s from class_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_session');
  end if;
  select * into v_c from classes where id = v_s.class_id;
  -- Step 13 is titled "a COACH cancels a session", so a coach must be able
  -- to — but only their own. An admin can cancel any.
  if not may_manage_class(v_s.org_id, v_c.coach_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  update class_sessions
     set status = 'cancelled', cancelled_at = now(),
         cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_session_id;

  -- Decision 2: when the CLUB cancels, refunds are automatic. Marking
  -- the intent here rather than waiting for Stripe means the money owed
  -- is recorded even though the card integration is not built yet —
  -- refunded_at stays null until a real refund is issued.
  update class_bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         refund_reason = coalesce(p_reason, 'Class cancelled by the club')
   where session_id = p_session_id and status = 'confirmed';
  get diagnostics v_n = row_count;

  insert into dashboard_notifications
    (org_id, recipient_role, kind, class_id, session_id, body)
  values
    (v_s.org_id, 'admin', 'session_cancelled', v_s.class_id, p_session_id,
     v_c.name || ' was cancelled — ' || v_n || ' booking(s) released');

  -- And the coach, for the case that matters: an ADMIN cancelled a coach's
  -- session. The coach would otherwise turn up to a class nobody is coming
  -- to. Harmless when the coach cancelled it themselves — they get a
  -- confirmation of their own action, which is the normal thing to expect.
  insert into dashboard_notifications
    (org_id, recipient_role, recipient_user_id, kind, class_id, session_id, body)
  select v_s.org_id, 'coach', m.user_id, 'session_cancelled',
         v_s.class_id, p_session_id,
         v_c.name || ' on ' || to_char(v_s.starts_at, 'Dy DD Mon HH24:MI')
           || ' was cancelled — ' || v_n || ' booking(s) released'
    from memberships m
   where m.id = v_c.coach_id;

  return jsonb_build_object('ok', true, 'cancelled_bookings', v_n,
                            'class_name', v_c.name);
end $$;


-- ── Grants ──────────────────────────────────────────────────────────
-- anon can book: the whole point of the guest branch is that it works
-- with no account. The staff functions are granted to authenticated
-- only, and re-check staffhood internally anyway — the grant is the
-- outer door, may_manage_class() is the lock.
grant execute on function is_class_staff(uuid)                                              to authenticated;
grant execute on function may_manage_class(uuid,uuid)                                       to authenticated;
grant execute on function book_hub_class(text,text,text,text,text,text,text,int,text,text) to anon, authenticated;
grant execute on function join_class_waitlist(text,text,text,text,text,int,text)           to anon, authenticated;
grant execute on function public_booking_by_token(uuid)                                     to anon, authenticated;
grant execute on function cancel_class_booking(uuid,uuid)                                   to anon, authenticated;
grant execute on function my_class_bookings()                                               to authenticated;
grant execute on function staff_add_walk_in(uuid,text,int,boolean)                          to authenticated;
grant execute on function staff_session_register(uuid)                                      to authenticated;
grant execute on function cancel_class_session(uuid,text)                                   to authenticated;
