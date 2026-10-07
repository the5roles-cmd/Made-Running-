-- ============================================================
-- MADE RUNNING CRM - DEMO SEED DATA
--
-- Run this in the Supabase SQL Editor AFTER you have created your staff
-- account at /login -> "Create account". It will refuse to run otherwise,
-- because orgs.created_by is NOT NULL and references auth.users - and in
-- the SQL Editor auth.uid() is NULL, so there is no user to attribute the
-- org to until one exists.
--
-- What it does, in order:
--   1. finds the most recently created auth user (you)
--   2. creates the "Made Running" org with a FIXED uuid and the
--      public_join_slug 'maderunning' (without that slug, /join is dead)
--   3. makes you an 'owner' member of it - this is what lets RLS show you
--      anything at all
--   4. seeds 4 chapters, 50 runners, ~14 weeks of sessions and attendance,
--      volunteers, partners, collabs, shop orders and outreach
--
-- SAFE TO RE-RUN. It deletes and rebuilds only the demo org's rows, keyed
-- on the fixed uuid below, so it can never touch a real workspace.
--
-- Runs as `postgres` in the SQL Editor, which owns these tables and so
-- bypasses RLS. That is why the inserts succeed even though your policies
-- would block them from the browser.
-- ============================================================

do $$
declare
  v_org   uuid := '11111111-1111-4111-8111-111111111111';
  v_user  uuid;
  v_mcr   uuid;
  v_lon   uuid;
  v_bhm   uuid;
  v_lds   uuid;
begin

  -- -- 1. Who are we attaching this to? ----------------------
  select id into v_user from auth.users order by created_at desc limit 1;
  if v_user is null then
    raise exception
      'No user found. Create your account first at /login -> "Create account", then re-run this script.';
  end if;

  -- -- 2. Clean slate for THIS demo org only -----------------
  -- Ordered child-first. Most have ON DELETE CASCADE from orgs, but being
  -- explicit means re-running never depends on cascade ordering quirks.
  delete from outreach_participants where org_id = v_org;
  delete from outreach_programs    where org_id = v_org;
  delete from shopify_orders       where org_id = v_org;
  delete from attendance           where org_id = v_org;
  delete from volunteers           where org_id = v_org;
  delete from activities           where org_id = v_org;
  delete from deals                where org_id = v_org;
  delete from sessions             where org_id = v_org;
  delete from contacts             where org_id = v_org;
  delete from records              where org_id = v_org;
  delete from accounts             where org_id = v_org;
  delete from chapters             where org_id = v_org;

  -- -- 3. The org itself -------------------------------------
  -- public_join_slug MUST match VITE_TENANT ('maderunning') or the public
  -- /join form raises 'Unknown registration link'.
  --
  -- Release the slug from any OTHER org first. It is UNIQUE, and this
  -- database already contains an earlier test org holding 'maderunning'
  -- ("Made Running Test Org A") - without this the insert below aborts the
  -- whole DO block with a unique violation. The slug has to point at the
  -- one org this deployment serves, and VITE_TENANT says that is this one.
  update orgs set public_join_slug = null
  where public_join_slug = 'maderunning' and id <> v_org;

  insert into orgs (id, name, industry, created_by, public_join_slug)
  values (v_org, 'Made Running', 'Running community', v_user, 'maderunning')
  on conflict (id) do update
    set name = excluded.name,
        industry = excluded.industry,
        public_join_slug = excluded.public_join_slug;

  -- -- 4. Make the signed-up user an owner -------------------
  -- This single row is what makes every dashboard non-empty: every RLS
  -- policy resolves through my_org_ids(), which reads memberships.
  insert into memberships (org_id, user_id, role, full_name)
  values (v_org, v_user, 'owner', 'Made Running Staff')
  on conflict (org_id, user_id) do update set role = 'owner';

  -- -- 4b. Remove the empty workspace signup auto-created ----
  -- Login.jsx calls create_org() when a new user has no orgs, so signing up
  -- leaves a second, empty workspace behind. AuthProvider.jsx then picks
  -- `list[0]` out of an *unordered* Supabase query, so which workspace opens
  -- after login is effectively arbitrary - the demo could land on the empty
  -- one. Removing it makes that deterministic instead of a coin flip.
  --
  -- Strictly bounded: only orgs created by THIS user, that are NOT the demo
  -- org, and that hold no data at all. Deleting the org cascades to its
  -- memberships row.
  delete from orgs o
  where o.created_by = v_user
    and o.id <> v_org
    and not exists (select 1 from records  r where r.org_id = o.id)
    and not exists (select 1 from accounts a where a.org_id = o.id)
    and not exists (select 1 from sessions s where s.org_id = o.id);

  -- -- 5. Chapters -------------------------------------------
  insert into chapters (org_id, name, address, is_primary) values
    (v_org, 'Manchester', 'Whitworth Park, Manchester M14',      true)
    returning id into v_mcr;
  insert into chapters (org_id, name, address, is_primary) values
    (v_org, 'London',     'Victoria Park, London E9',            false)
    returning id into v_lon;
  insert into chapters (org_id, name, address, is_primary) values
    (v_org, 'Birmingham', 'Cannon Hill Park, Birmingham B12',    false)
    returning id into v_bhm;
  insert into chapters (org_id, name, address, is_primary) values
    (v_org, 'Leeds',      'Roundhay Park, Leeds LS8',            false)
    returning id into v_lds;

  -- -- 6. Runners (50) ---------------------------------------
  -- Status mix is deliberate and drives the dashboard's headline numbers:
  --   1-30 active - 31-38 at_risk - 39-43 lapsed - 44-50 new
  -- 'at_risk' is the re-engagement trigger the product pitch hangs on, so
  -- there has to be a visible, non-zero cohort of it.
  with names(idx, full_name) as (
    values
      (1,'Amara Okafor'),      (2,'Jordan Blake'),       (3,'Priya Raman'),
      (4,'Marcus Bennett'),    (5,'Chloe Whitfield'),    (6,'Devon Campbell'),
      (7,'Aisha Rahman'),      (8,'Ryan Docherty'),      (9,'Nia Thompson'),
      (10,'Samuel Adeyemi'),   (11,'Grace Mensah'),      (12,'Tom Fielding'),
      (13,'Zainab Hussain'),   (14,'Leon Baptiste'),     (15,'Hannah Reid'),
      (16,'Kwame Asante'),     (17,'Ella Morrison'),     (18,'Isaac Boateng'),
      (19,'Sophie Lang'),      (20,'Malik Johnson'),     (21,'Rosa Delgado'),
      (22,'Callum Hughes'),    (23,'Fatima Ahmed'),      (24,'Nathan Osei'),
      (25,'Bethany Clarke'),   (26,'Andre Lewis'),       (27,'Simran Kaur'),
      (28,'Joe Hartley'),      (29,'Yasmin Abdi'),       (30,'Dominic Reeves'),
      (31,'Keisha Palmer'),    (32,'Oliver Grant'),      (33,'Mariam Diallo'),
      (34,'Josh Whittaker'),   (35,'Tanya Sinclair'),    (36,'Femi Adebayo'),
      (37,'Lucy Bramwell'),    (38,'Reece Anderson'),    (39,'Naomi Wright'),
      (40,'Hassan Malik'),     (41,'Freya Donnelly'),    (42,'Kofi Mensah'),
      (43,'Alice Pemberton'),  (44,'Jamal Carter'),      (45,'Erin Moloney'),
      (46,'Tobi Ogundimu'),    (47,'Katie Ashworth'),    (48,'Ravi Patel'),
      (49,'Michelle Boakye'),  (50,'Danny Coleman')
  )
  insert into records (
    org_id, title, email, phone, summary, status, tags,
    emergency_contact_name, emergency_contact_phone, waiver_signed_at,
    shopify_customer_id, lifetime_spend, last_order_at, created_at
  )
  select
    v_org,
    n.full_name,
    lower(replace(n.full_name, ' ', '.')) || '@example.com',
    '07' || lpad(((n.idx * 7919) % 100000000)::text, 9, '0'),
    case
      when n.idx <= 30 then 'Regular attender. Joined through the weekly Manchester run.'
      when n.idx <= 38 then 'Was a consistent attender, nothing logged in over a month. Worth a check-in.'
      when n.idx <= 43 then 'Long-standing member, no attendance this quarter.'
      else 'New sign-up via the public form. Not yet attended a session.'
    end,
    case
      when n.idx <= 30 then 'active'
      when n.idx <= 38 then 'at_risk'
      when n.idx <= 43 then 'lapsed'
      else 'new'
    end,
    case
      when n.idx % 7 = 0 then array['pacer']
      when n.idx % 5 = 0 then array['5k']
      when n.idx % 3 = 0 then array['10k']
      else array['social']
    end,
    'Emergency Contact ' || n.idx,
    '07' || lpad(((n.idx * 3571) % 100000000)::text, 9, '0'),
    now() - ((60 + n.idx * 3) || ' days')::interval,
    'shpfy_' || lpad(n.idx::text, 5, '0'),
    case when n.idx % 4 = 0 then 0 else ((n.idx * 17) % 240) + 25 end,
    case when n.idx % 4 = 0 then null else now() - ((n.idx * 4) || ' days')::interval end,
    now() - ((60 + n.idx * 3) || ' days')::interval
  from names n;

  -- -- 7. Sessions - 14 weeks back, plus 3 weeks ahead -------
  -- One table serves both the Sessions screen (type='run') and the Hub
  -- screen (type='hub_*'), filtered per screen. See constants.js.
  insert into sessions (org_id, chapter_id, type, title, location, starts_at, recurring, capacity)
  select
    v_org, v_mcr, 'run',
    'Wednesday Track Night',
    'Whitworth Park, Manchester',
    (date_trunc('week', now()) - (w || ' weeks')::interval) + interval '2 days 18 hours 30 minutes',
    true, null
  from generate_series(-3, 13) w;

  insert into sessions (org_id, chapter_id, type, title, location, starts_at, recurring, capacity)
  select
    v_org, v_mcr, 'run',
    'Saturday Long Run',
    'Fallowfield Loop, Manchester',
    (date_trunc('week', now()) - (w || ' weeks')::interval) + interval '5 days 9 hours',
    true, null
  from generate_series(-3, 13) w;

  insert into sessions (org_id, chapter_id, type, title, location, starts_at, recurring, capacity)
  select
    v_org, v_lon, 'run',
    'Sunday Social 5K',
    'Victoria Park, London',
    (date_trunc('week', now()) - (w || ' weeks')::interval) + interval '6 days 10 hours',
    true, null
  from generate_series(-2, 9) w;

  -- Hub events are capacity-bound, which is what makes the Hub screen's
  -- "12 / 20 booked" style display meaningful.
  insert into sessions (org_id, chapter_id, type, title, location, starts_at, recurring, capacity) values
    (v_org, v_mcr, 'hub_workshop',   'Running Form Workshop',        'Made Hub, Manchester', now() + interval '6 days',  false, 20),
    (v_org, v_mcr, 'hub_training',   'Run Leader Training (L2)',     'Made Hub, Manchester', now() + interval '13 days', false, 12),
    (v_org, v_mcr, 'hub_networking', 'Community Social + Q&A',       'Made Hub, Manchester', now() + interval '20 days', false, 60),
    (v_org, v_bhm, 'hub_workshop',   'Injury Prevention Clinic',     'Cannon Hill, Birmingham', now() - interval '9 days', false, 25),
    (v_org, v_lds, 'hub_networking', 'Leeds Chapter Launch',         'Roundhay Park, Leeds', now() - interval '23 days', false, 80);

  -- ── Bookable, paid GYM CLASSES (see BookGym.jsx + supabase-bookings.sql).
  -- NOTE: requires supabase-bookings.sql to have run first — it adds the
  -- 'gym_class' type and the price_pennies column referenced below.
  -- Prices are in integer pennies: £10 = 1000.
  insert into sessions (org_id, chapter_id, type, title, location, starts_at, recurring, capacity, price_pennies) values
    (v_org, v_mcr, 'gym_class', 'HIIT — Monday Burn',    'Made Hub, Manchester', now() + interval '2 days'  + interval '6 hours',  true, 16, 1000),
    (v_org, v_mcr, 'gym_class', 'Strength & Conditioning', 'Made Hub, Manchester', now() + interval '4 days' + interval '19 hours', true, 20, 1200),
    (v_org, v_mcr, 'gym_class', 'Saturday Spin',         'Made Hub, Manchester', now() + interval '6 days'  + interval '9 hours',  true, 24, 800),
    (v_org, v_lon, 'gym_class', 'Mobility & Recovery',   'Victoria Park, London', now() + interval '3 days' + interval '18 hours', true, 15, 0);

  -- -- 8. Attendance -----------------------------------------
  -- Generated, not hand-written, so the lifecycle statuses above are
  -- actually SUPPORTED by data rather than just asserted. The md5 hash
  -- thins attendance to ~70% deterministically - a club where every
  -- member attends every session looks obviously fake.
  insert into attendance (org_id, session_id, runner_id, attended_at)
  select v_org, s.id, r.id, s.starts_at + interval '4 minutes'
  from records r
  join sessions s
    on s.org_id = v_org
   and s.type = 'run'
   and s.starts_at < now()
  where r.org_id = v_org
    and (
         (r.status = 'active'  and s.starts_at > now() - interval '98 days')
      or (r.status = 'at_risk' and s.starts_at between now() - interval '98 days' and now() - interval '38 days')
      or (r.status = 'lapsed'  and s.starts_at between now() - interval '98 days' and now() - interval '80 days')
    )
    and (('x' || substr(md5(r.id::text || s.id::text), 1, 4))::bit(16)::int % 10) < 7;

  -- -- 9. Volunteers -----------------------------------------
  insert into volunteers (org_id, runner_id, volunteer_type, status, started_at)
  select
    v_org, r.id,
    -- ::int is required - row_number() returns bigint and array subscripts
    -- must be integer, which fails at runtime rather than at parse time.
    (array['run_leader','pacer','ambassador','hub_coach','media'])[1 + (row_number() over (order by r.created_at))::int % 5],
    'active',
    now() - interval '200 days'
  from records r
  where r.org_id = v_org and r.status = 'active'
  limit 9;

  -- -- 10. Partners (accounts) + their contacts --------------
  insert into accounts (org_id, name, industry, website, status, notes) values
    (v_org, 'Nike UK',                'Sportswear',   'nike.com',            'active', 'Kit supply + seasonal campaign talks.'),
    (v_org, 'Represent Clo',          'Apparel',      'representclo.com',    'active', 'Manchester-based. Warm intro via community.'),
    (v_org, 'Lucozade Sport',         'Nutrition',    'lucozadesport.com',   'active', 'On-site hydration at long runs.'),
    (v_org, 'Manchester City Council','Public sector','manchester.gov.uk',   'active', 'Park permits + outreach funding.'),
    (v_org, 'Runner''s World UK',     'Media',        'runnersworld.com/uk', 'active', 'Feature on community-led clubs.'),
    (v_org, 'MIND Charity',           'Charity',      'mind.org.uk',         'active', 'Mental-health partnership, running as therapy.');

  insert into contacts (org_id, account_id, name, role_title, email, phone)
  select v_org, a.id,
         c.name, c.role_title,
         lower(replace(c.name,' ','.')) || '@' || a.website,
         '0161 ' || lpad(((row_number() over ()) * 4271 % 1000000)::text, 6, '0')
  from accounts a
  join (values
    ('Nike UK',                 'Steph Callaghan', 'Community Marketing Lead'),
    ('Represent Clo',           'Danny Ricci',     'Brand Partnerships'),
    ('Lucozade Sport',          'Priti Shah',      'Sponsorship Manager'),
    ('Manchester City Council', 'Alan Whitmore',   'Parks & Events Officer'),
    ('Runner''s World UK',      'Jess Nolan',      'Features Editor'),
    ('MIND Charity',            'Ben Okoro',       'Community Programmes')
  ) as c(acct, name, role_title) on c.acct = a.name
  where a.org_id = v_org;

  -- -- 11. Collabs (deals) - one typed pipeline --------------
  -- Spread across all five stages so the pipeline board isn't lopsided,
  -- and stage_changed_at is staggered because the dashboard reads THAT,
  -- not created_at, to show pipeline movement.
  insert into deals (org_id, account_id, title, value, stage, deal_type, stage_changed_at, created_at)
  select v_org, a.id, d.title, d.value, d.stage, d.deal_type,
         now() - (d.days_ago || ' days')::interval,
         now() - ((d.days_ago + 30) || ' days')::interval
  from accounts a
  join (values
    ('Nike UK',                 'SS26 kit supply + 3 event takeovers', 18000, 'in_discussion', 'brand_collab',        4),
    ('Nike UK',                 'Track night title sponsorship',       12000, 'outreach',      'sponsorship',         9),
    ('Represent Clo',           'Limited capsule - Made x Represent',   9500, 'agreed',        'brand_collab',        2),
    ('Lucozade Sport',          'Hydration at all long runs (12mo)',    6500, 'live',          'sponsorship',        21),
    ('Manchester City Council', 'Whitworth Park permit + youth fund',   4200, 'live',          'venue_vendor',       35),
    ('Runner''s World UK',      'Feature: community-led running',           0, 'agreed',        'press',               7),
    ('MIND Charity',            'Run & Talk partnership programme',      3000, 'live',          'charity',            48),
    ('Represent Clo',           'Wholesale - 200 units to stockists',    7800, 'outreach',      'wholesale',          12),
    ('Nike UK',                 'Ambassador deal - 3 run leaders',       5400, 'in_discussion', 'ambassador_agreement', 6),
    ('Lucozade Sport',          'Leeds chapter launch activation',       2200, 'archived',      'sponsorship',        88)
  ) as d(acct, title, value, stage, deal_type, days_ago) on d.acct = a.name
  where a.org_id = v_org;

  -- -- 12. Activity timeline ---------------------------------
  insert into activities (org_id, kind, body, deal_id, occurred_at)
  select v_org, 'stage_change',
         'Moved to "' || d.stage || '".',
         d.id, d.stage_changed_at
  from deals d where d.org_id = v_org;

  insert into activities (org_id, kind, body, account_id, occurred_at)
  select v_org,
         (array['call','email','meeting','note'])[1 + (row_number() over ())::int % 4],
         (array[
           'Call to confirm activation dates.',
           'Sent updated community numbers and reach deck.',
           'Met at the Hub to walk through Q3 plans.',
           'They asked for attendance breakdown by chapter.'
         ])[1 + (row_number() over ())::int % 4],
         a.id,
         now() - ((row_number() over ())::int * 3 || ' days')::interval
  from accounts a where a.org_id = v_org;

  -- -- 13. Shop orders (Shopify stub) ------------------------
  insert into shopify_orders (org_id, runner_id, order_number, total, items, ordered_at)
  select v_org, r.id,
         '#MR' || lpad((1000 + (row_number() over (order by r.created_at)))::text, 5, '0'),
         r.lifetime_spend,
         (array['Made Tee (Black)','Made Cap','Long-sleeve Tech Top','Made Hoodie','Socks 3-pack'])
           [1 + (row_number() over (order by r.created_at))::int % 5],
         r.last_order_at
  from records r
  where r.org_id = v_org and r.last_order_at is not null
  limit 32;

  -- -- 14. Outreach - deliberately data-separated module -----
  -- runner_id stays NULL for most participants: the schema allows
  -- anonymity and the demo should show that boundary being respected,
  -- not quietly joined back to the main runner list.
  insert into outreach_programs (org_id, name, description) values
    (v_org, 'Youth Run Club (14-18)',
            'Free weekly sessions with two Manchester secondary schools. Kit provided, no sign-up fee.'),
    (v_org, 'Run & Talk (with MIND)',
            'Low-pace social runs framed around mental health. Participants may take part anonymously.');

  insert into outreach_participants (org_id, program_id, runner_id, notes, joined_at)
  select v_org, p.id, null,
         'Anonymous participant - referred by partner organisation.',
         now() - ((g * 6) || ' days')::interval
  from outreach_programs p
  cross join generate_series(1, 11) g
  where p.org_id = v_org;

  raise notice 'Seed complete for org %, attached to user %.', v_org, v_user;

end $$;

-- -- Verify (bypasses RLS here; the app will see the same via membership) --
select 'chapters' as table_name, count(*) from chapters where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'runners',     count(*) from records     where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'sessions',    count(*) from sessions    where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'attendance',  count(*) from attendance  where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'volunteers',  count(*) from volunteers  where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'partners',    count(*) from accounts    where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'contacts',    count(*) from contacts    where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'collabs',     count(*) from deals       where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'activities',  count(*) from activities  where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'shop_orders', count(*) from shopify_orders where org_id = '11111111-1111-4111-8111-111111111111'
union all select 'outreach',    count(*) from outreach_participants where org_id = '11111111-1111-4111-8111-111111111111'
order by 1;
