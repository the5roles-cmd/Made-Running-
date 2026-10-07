-- ═══════════════════════════════════════════════════════════════════
-- REVIEWS — the write path
--
-- Run AFTER supabase-classes.sql, which creates class_ratings and the
-- public_class_reviews read. This file adds the only thing that was missing:
-- a way for a rating to actually be left.
--
-- Until now class_ratings could be read by the public page and written by
-- nobody — there was an insert POLICY but no RPC, and the policy requires
-- auth.uid() to own the booking. That locked out precisely the people this
-- club books: guests, who have no account at all (booker_user_id is null by
-- design, see Section 3 of supabase-classes.sql).
--
-- WHY THIS IS A SECURITY DEFINER RPC AND NOT A TABLE INSERT
--
-- A guest holds one thing that proves who they are: the manage_token on their
-- booking, a CSPRNG uuid they got in their confirmation. That is already how
-- they cancel. Reviewing works the same way, for the same reason — and it
-- means the anon role never needs insert rights on class_ratings, so the only
-- row that can ever be written is one this function decided to write.
--
-- WHAT IT REFUSES, AND WHY EACH ONE MATTERS
--
--   • A token that does not exist            → nobody by that name was booked
--   • A cancelled booking                    → they cancelled; they were not there
--   • A session that has not started yet     → you cannot review a class you
--                                               have not been to. Without this,
--                                               a booking made this morning can
--                                               review a class that runs in
--                                               November.
--   • A booking that has already rated       → enforced by the unique index,
--                                               caught here to return a sentence
--                                               instead of a constraint error
--   • Stars outside 1..5                     → clamped by the CHECK, rejected
--                                               here with a readable message
--
-- Fake reviews are unlawful in the UK under the Digital Markets, Competition
-- and Consumers Act 2024 (the fake-review provisions came into force in April
-- 2025), and the liability sits with the business displaying them. Every rule
-- above is what makes this club's stars defensible: each one is attached to a
-- row in the register.
-- ═══════════════════════════════════════════════════════════════════


-- ── Moderation state ────────────────────────────────────────
-- Added rather than assumed. class_ratings had no notion of a review that
-- exists but is not shown, which left the club with exactly two options for a
-- review they disagreed with: leave it up, or delete a member's words. Both
-- are bad, and the second is the one that gets a gym written about.
--
-- Three states, and only three:
--   'published' — visible on the class page
--   'pending'   — written, stored, not yet shown; waiting on a coach
--   'hidden'    — taken down by staff. The row SURVIVES, so a hidden review
--                 can be restored and cannot be quietly rewritten as though
--                 it never existed.
--
-- Defaulting to 'published' deliberately: that is the behaviour the club has
-- today (anything in the table shows), so running this file changes nothing
-- about what members see until somebody asks for it to.
alter table class_ratings
  add column if not exists status text not null default 'published';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'class_ratings_status_check'
  ) then
    alter table class_ratings
      add constraint class_ratings_status_check
      check (status in ('published','pending','hidden'));
  end if;
end $$;

-- Partial, covering only the rows the public page reads. The class page hits
-- this on every visit and the moderation queue hits it rarely.
create index if not exists class_ratings_public_idx
  on class_ratings (class_id, created_at desc) where status = 'published';


-- ── The club's moderation policy, in one place ──────────────
-- ⚠️  THIS IS THE ONE DECISION IN THIS FILE THAT IS NOT MINE TO MAKE.
--
-- It decides what happens the instant a member submits a review: does it
-- appear on the class page immediately, or does it wait for a coach?
--
-- The trade-off is real and it goes both ways:
--
--   Publish immediately — the page feels alive, a member sees their own words
--     straight away, and nobody has to do anything. But a bad night, a
--     misunderstanding or a grudge is public on the club's own page before any
--     coach has seen it, and the class it names is somebody's livelihood.
--
--   Hold everything for approval — nothing embarrassing ever surfaces
--     unseen. But someone now has a queue to clear, and a queue nobody clears
--     is a review page that silently never updates. It also shades towards the
--     thing the law is aimed at: a club that only approves the good ones is
--     curating, not reviewing.
--
--   Something in between — the common middle is to publish most and hold the
--     ones most likely to need a human: the lowest scores, or anything with a
--     comment long enough to be a complaint rather than a compliment.
--
-- The version below publishes everything, which is what the club does today.
-- Change the body to change the policy; nothing else in this file needs to
-- know, because every caller goes through this function.
create or replace function review_initial_status(p_stars int, p_comment text)
returns text language sql immutable as $$
  -- TODO(club): the policy decision above. Two examples of what a different
  -- answer looks like, either of which is a one-line body:
  --
  --   Everything waits for a coach:
  --     select 'pending'
  --
  --   Publish 4s and 5s, hold anything lower for a human to read first:
  --     select case when p_stars >= 4 then 'published' else 'pending' end
  --
  select 'published'
$$;


-- ── Submit a review ─────────────────────────────────────────
-- Keyed on manage_token, exactly like the guest cancel path. The caller never
-- sends a class id, a session id or a user id: all three are read from the
-- booking the token identifies, so a submission cannot be pointed at a class
-- the sender did not attend by editing the request.
create or replace function submit_class_review(
  p_manage_token uuid,
  p_stars        int,
  p_comment      text default null,
  p_rater_name   text default null
)
returns table (ok boolean, status text, message text)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_booking   class_bookings%rowtype;
  v_starts_at timestamptz;
  v_status    text;
  v_name      text;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    return query select false, 'bad_stars'::text,
      'Pick a rating between 1 and 5 stars.'::text;
    return;
  end if;

  select * into v_booking from class_bookings where manage_token = p_manage_token;

  -- Deliberately the SAME message for "no such token" and for "cancelled".
  -- Distinguishing them turns this function into an oracle that confirms
  -- whether a guessed token is real, and the reviewer gains nothing from the
  -- difference — in both cases there is no booking of theirs to review.
  if not found or v_booking.status <> 'confirmed' then
    return query select false, 'no_booking'::text,
      'We can''t find that booking, so there''s nothing to review.'::text;
    return;
  end if;

  select starts_at into v_starts_at
  from class_sessions where id = v_booking.session_id;

  -- now(), not the session's end. A member leaving as the class finishes
  -- should be able to review it from the car park, and requiring the end time
  -- means storing a duration this schema does not have. Starting is enough to
  -- prove the thing being reviewed has happened.
  if v_starts_at is null or v_starts_at > now() then
    return query select false, 'not_yet'::text,
      'This class hasn''t run yet — you can leave a review once you''ve been.'::text;
    return;
  end if;

  if exists (select 1 from class_ratings where booking_id = v_booking.id) then
    return query select false, 'already'::text,
      'You''ve already reviewed this one. Thanks again.'::text;
    return;
  end if;

  v_status := review_initial_status(p_stars, p_comment);

  -- ── The fallback name is ABBREVIATED, and that is not cosmetic ──
  -- class_ratings.rater_name is printed verbatim on a public page by
  -- public_class_reviews. Defaulting it to booker_name would publish a guest's
  -- FULL NAME to the open internet because they left four stars — a person who
  -- gave that name to book a fitness class, not to be listed on one.
  --
  -- So an unspecified name becomes first name plus last initial, which is what
  -- the column comment in supabase-classes.sql intended by "Sarah K." all
  -- along. A name the reviewer typed themselves is used as given: they can see
  -- what they wrote and chose it.
  --
  -- Never the email, which is the other thing on the booking that identifies
  -- them and the one that would be harvested within the hour.
  v_name := nullif(trim(coalesce(p_rater_name, '')), '');
  if v_name is null then
    v_name := nullif(trim(coalesce(v_booking.booker_name, '')), '');
    if v_name is not null and position(' ' in v_name) > 0 then
      v_name := split_part(v_name, ' ', 1) || ' ' ||
                upper(left(split_part(v_name, ' ', 2), 1)) || '.';
    end if;
  end if;

  insert into class_ratings (
    org_id, class_id, session_id, booking_id, user_id,
    rater_name, stars, comment, status
  ) values (
    v_booking.org_id, v_booking.class_id, v_booking.session_id, v_booking.id,
    v_booking.booker_user_id,
    v_name,
    p_stars,
    nullif(trim(coalesce(p_comment, '')), ''),
    v_status
  );

  -- The status goes back to the caller so the page can say the right thing.
  -- "Thanks, that's live on the class page" and "Thanks, a coach will check it
  -- over" are different promises, and the UI must not guess which one it just
  -- made.
  return query select true, v_status,
    case when v_status = 'published'
      then 'Thanks — your review is on the class page.'
      else 'Thanks — a coach will check it over before it goes up.'
    end;
end $$;

-- anon as well as authenticated: guests have no account and are the larger
-- half of this club's bookings. The token is the credential.
grant execute on function submit_class_review(uuid, int, text, text) to anon, authenticated;


-- ── What a reviewer is allowed to see before they write ─────
-- The review page (/r/:token) has to name the class — asking "how was it?"
-- with no idea which session is being asked about is not a question anyone can
-- answer. This returns the minimum needed to render that: the class name, when
-- it ran, and whether they have already reviewed it.
--
-- NOT the booker's email, phone or the booking id. A manage_token in the wrong
-- hands should reveal a class name and a date, not a person.
create or replace function review_context(p_manage_token uuid)
returns table (
  class_name   text,
  coach_name   text,
  class_slug   text,
  starts_at    timestamptz,
  booker_name  text,
  can_review   boolean,
  reason       text
)
language sql stable security definer set search_path = public as $$
  select
    c.name,
    c.coach_name,
    c.slug,
    s.starts_at,
    b.booker_name,
    (b.status = 'confirmed'
      and s.starts_at <= now()
      and not exists (select 1 from class_ratings r where r.booking_id = b.id)),
    case
      when b.status <> 'confirmed' then 'cancelled'
      when s.starts_at > now()     then 'not_yet'
      when exists (select 1 from class_ratings r where r.booking_id = b.id) then 'already'
      else 'ok'
    end
  from class_bookings b
  join class_sessions s on s.id = b.session_id
  join classes c        on c.id = b.class_id
  where b.manage_token = p_manage_token
$$;

grant execute on function review_context(uuid) to anon, authenticated;


-- ── The public read, now moderation-aware ───────────────────
-- Same signature, so this is a replace and not a drop — and every existing
-- caller keeps working untouched.
--
-- The added line is `and r.status = 'published'`. Without it, switching the
-- policy above to 'pending' would change nothing visible: reviews would be
-- held for approval and then appear on the class page anyway, which is the
-- worst of both designs and the kind of gap that is only found in public.
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
    and r.status = 'published'
    -- Star-only ratings still count towards the average but have nothing to
    -- show in a list of reviews.
    and r.comment is not null
    and trim(r.comment) <> ''
  order by r.created_at desc
  limit greatest(least(coalesce(p_limit, 6), 50), 1)
$$;

grant execute on function public_class_reviews(text, text, int) to anon, authenticated;
