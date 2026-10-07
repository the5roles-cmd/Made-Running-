-- ============================================================
-- MADE RUNNING CRM — Supabase / Postgres schema
-- Re-skinned from the multi-tenant CRM template. Run this whole file in
-- the Supabase SQL editor (fresh project).
--
-- Tenancy model: PER-ORGANISATION TEAMS.
--   • orgs           — a client workspace (a hospital, a club, a firm)
--   • memberships    — which auth users belong to which org (+ role)
--   • every domain table carries org_id
--   • RLS: a row is visible iff the caller is a member of its org
--
-- Two modules, one app (see src/lib/constants.js):
--   Module A · Community — records = Runners (lifecycle, attendance-driven)
--   Module B · Business  — accounts = Partners, deals = Collabs (one pipeline)
-- The section below the baseline core tables ("MADE RUNNING — ADDITIVE
-- EXTENSIONS") adds chapters/sessions/attendance/volunteers/shopify/outreach.
-- Rule: extend additively, never fork a parallel schema.
-- ============================================================

create extension if not exists vector;

-- ── Organisations (tenants) ─────────────────────────────────
create table if not exists orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  industry    text,
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── Membership: user ↔ org ↔ role ───────────────────────────
create table if not exists memberships (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null references orgs (id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role     text not null default 'member'
           check (role in ('owner','admin','member','viewer')),
  full_name text,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Helper: the set of org_ids the current user belongs to.
-- SECURITY DEFINER so RLS policies can call it without recursion.
create or replace function my_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid()
$$;

-- ── Accounts (the companies / departments / sponsors) ───────
create table if not exists accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  name        text not null,
  industry    text,
  website     text,
  status      text default 'active',
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Contacts (people at those accounts) ─────────────────────
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  account_id  uuid references accounts (id) on delete set null,
  name        text not null,
  role_title  text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ── Records → Runners (the primary entity; Module A · Community) ──
-- text_blob + embedding power the semantic match + AI summary.
-- status is a lifecycle signal (attendance-driven), not a sales stage —
-- `at_risk` = no attendance in 30d, the re-engagement trigger.
-- Waiver + emergency-contact + Shopify-stub columns are additive, added
-- in the "MADE RUNNING — ADDITIVE EXTENSIONS" section below.
create table if not exists records (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs (id) on delete cascade,
  account_id   uuid references accounts (id) on delete set null,
  title        text not null,
  summary      text,
  status       text not null default 'new'
               check (status in ('new','active','at_risk','lapsed','archived')),
  tags         text[] default '{}',
  text_blob    text,
  ai_summary   text,
  embedding    vector(1024),
  created_at   timestamptz not null default now()
);

-- ── Deals → Collabs (Module B · Business — one pipeline for every
--    external agreement type: press, brand, charity, sponsorship,
--    wholesale, venue/vendor, ambassador). deal_type + runner_id are
--    additive, added in the extensions section below. ──────────────
create table if not exists deals (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs (id) on delete cascade,
  account_id       uuid references accounts (id) on delete set null,
  record_id        uuid references records (id) on delete set null,
  title            text not null,
  value            numeric default 0,
  stage            text not null default 'outreach'
                   check (stage in ('outreach','in_discussion','agreed','live','archived')),
  stage_changed_at timestamptz not null default now(),  -- dashboard reads this
  created_at       timestamptz not null default now()
);

-- ── Activities (timeline) ───────────────────────────────────
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  kind        text not null default 'note'
              check (kind in ('note','call','email','meeting','stage_change')),
  body        text not null,
  account_id  uuid references accounts (id) on delete cascade,
  contact_id  uuid references contacts (id) on delete cascade,
  record_id   uuid references records (id) on delete cascade,
  deal_id     uuid references deals (id) on delete cascade,
  occurred_at timestamptz not null default now()
);

-- ============================================================
-- RLS — every table private to the caller's org(s).
-- orgs/memberships get bespoke policies; domain tables loop.
-- ============================================================
alter table orgs enable row level security;
alter table memberships enable row level security;

drop policy if exists orgs_member_select on orgs;
create policy orgs_member_select on orgs for select using (id in (select my_org_ids()));
drop policy if exists orgs_insert on orgs;
create policy orgs_insert on orgs for insert with check (created_by = auth.uid());
drop policy if exists orgs_admin_update on orgs;
create policy orgs_admin_update on orgs for update using (id in (select my_org_ids()));

drop policy if exists mem_self_select on memberships;
create policy mem_self_select on memberships for select using (org_id in (select my_org_ids()));
drop policy if exists mem_self_insert on memberships;
create policy mem_self_insert on memberships for insert with check (user_id = auth.uid());
drop policy if exists mem_self_delete on memberships;
create policy mem_self_delete on memberships for delete using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['accounts','contacts','records','deals','activities']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s_org_select" on %I', t, t);
    execute format('drop policy if exists "%s_org_insert" on %I', t, t);
    execute format('drop policy if exists "%s_org_update" on %I', t, t);
    execute format('drop policy if exists "%s_org_delete" on %I', t, t);
    execute format('create policy "%s_org_select" on %I for select using (org_id in (select my_org_ids()))', t, t);
    execute format('create policy "%s_org_insert" on %I for insert with check (org_id in (select my_org_ids()))', t, t);
    execute format('create policy "%s_org_update" on %I for update using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()))', t, t);
    execute format('create policy "%s_org_delete" on %I for delete using (org_id in (select my_org_ids()))', t, t);
  end loop;
end $$;

-- ── Semantic match: cosine rank IN Postgres, re-checks org ──
create or replace function match_records(p_query vector(1024), p_org uuid, p_limit int default 10)
returns table (id uuid, title text, similarity float)
language sql stable security invoker as $$
  select r.id, r.title, 1 - (r.embedding <=> p_query) as similarity
  from records r
  where r.org_id = p_org
    and r.org_id in (select my_org_ids())   -- never trust the caller
    and r.embedding is not null
  order by r.embedding <=> p_query
  limit p_limit;
$$;

-- ── Convenience: create an org AND membership in one call ───
-- NOTE: the org id is generated here (gen_random_uuid()) and the orgs
-- insert deliberately has NO `returning` clause. `returning` would force
-- Postgres to re-check the row against orgs' SELECT policy
-- (orgs_member_select: `id in (select my_org_ids())`), which reads
-- `memberships` — but the membership row that would grant access doesn't
-- exist until the *second* insert below runs. That chicken-and-egg gap is
-- what caused every signup's org-bootstrap to fail with a misleading
-- "new row violates row-level security policy for table orgs" error even
-- though auth.uid() resolved correctly. Avoiding `returning` on the first
-- insert sidesteps the self-referential check entirely.
create or replace function create_org(p_name text, p_industry text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare new_id uuid := gen_random_uuid();
begin
  insert into orgs (id, name, industry, created_by) values (new_id, p_name, p_industry, auth.uid());
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

-- ============================================================
-- MADE RUNNING — ADDITIVE EXTENSIONS (two-module CRM)
-- Extends the core above; every table below carries org_id and gets the
-- same RLS-via-my_org_ids() treatment (see the loop at the bottom of this
-- section). Never a parallel schema — always additive.
-- ============================================================

-- ── Chapters (multi-city expansion — Made Running already runs events
--    across multiple cities, not just Manchester) ───────────────────
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  name        text not null,   -- e.g. "Manchester", "Leeds"
  address     text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Sessions — powers BOTH weekly runs and Hub bookings from one table,
--    filtered per screen (Sessions.jsx vs Hub.jsx by `type`). ────────
create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs (id) on delete cascade,
  chapter_id   uuid references chapters (id) on delete set null,
  type         text not null default 'run'
               check (type in ('run','hub_workshop','hub_training','hub_networking')),
  title        text not null,
  location     text,
  starts_at    timestamptz,
  recurring    boolean not null default false,
  capacity     int,          -- nullable: weekly runs are usually uncapped
  created_at   timestamptz not null default now()
);

-- ── Attendance — drives "last attended" + the at_risk/lapsed lifecycle
--    signal on records.status. ──────────────────────────────────────
create table if not exists attendance (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs (id) on delete cascade,
  session_id     uuid not null references sessions (id) on delete cascade,
  runner_id      uuid not null references records (id) on delete cascade,
  attended_at    timestamptz not null default now(),
  checked_in_by  uuid references auth.users (id) on delete set null,
  -- The runner's own finish time for that run, in whole seconds. Nullable on
  -- purpose: turning up is the fact attendance records, and a time is optional
  -- extra. Made Running is "no one gets left behind" — a screen that refuses
  -- your check-in until you enter a time turns a community run into a race.
  --
  -- An integer, not an interval or a 'mm:ss' string, because it has to be
  -- summed, averaged and compared. Formatting is a display concern; see
  -- formatDuration() in src/lib/schedule.js.
  duration_seconds  integer check (duration_seconds is null or duration_seconds > 0)
);

-- Additive migration for projects created before duration_seconds existed.
-- Safe to re-run; the app degrades gracefully if it hasn't been run yet
-- (check-ins still record, the time field just hides itself).
alter table attendance add column if not exists duration_seconds integer;

-- ── Volunteers — the COMMUNITY role (unpaid/informal: run leader, pacer,
--    hub coach, media). Distinct from a deals.deal_type='ambassador_agreement'
--    Collab, which is the paid/contracted relationship — a run-leader isn't
--    necessarily under contract and vice versa. ─────────────────────
create table if not exists volunteers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs (id) on delete cascade,
  runner_id       uuid not null references records (id) on delete cascade,
  volunteer_type  text not null
                  check (volunteer_type in ('run_leader','pacer','ambassador','hub_coach','media')),
  status          text not null default 'active',
  started_at      timestamptz not null default now()
);

-- ── Waiver + emergency-contact fields (mandatory on the "add Runner"
--    form — not a separate public flow in v1). Additive columns. ────
alter table records add column if not exists emergency_contact_name  text;
alter table records add column if not exists emergency_contact_phone text;
alter table records add column if not exists waiver_signed_at        timestamptz;

-- ── Shopify stub — additive columns + a seeded demo orders table.
--    src/lib/shopify.js wraps this read in one clearly-commented function;
--    that is the exact spot to swap in a real Admin API call once
--    credentials exist. No live API call happens here or in that file. ──
alter table records add column if not exists shopify_customer_id text;
alter table records add column if not exists lifetime_spend      numeric default 0;
alter table records add column if not exists last_order_at       timestamptz;

create table if not exists shopify_orders (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs (id) on delete cascade,
  runner_id    uuid references records (id) on delete cascade,
  order_number text not null,
  total        numeric not null default 0,
  items        text,          -- short freeform description — demo data only
  ordered_at   timestamptz not null default now()
);

-- ── Deal type + optional runner link (additive columns on deals) ────
-- One typed pipeline instead of seven bespoke tables: press, brand_collab,
-- charity, sponsorship, wholesale, venue_vendor, ambassador_agreement.
alter table deals add column if not exists deal_type text
  check (deal_type in ('press','brand_collab','charity','sponsorship','wholesale','venue_vendor','ambassador_agreement'));
alter table deals add column if not exists runner_id uuid references records (id) on delete set null;

-- ── Outreach — bounded, privacy-separated social-impact module. runner_id
--    is nullable on purpose (participants may stay anonymous); nothing
--    else joins into these two tables, keeping the data boundary real. ──
create table if not exists outreach_programs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists outreach_participants (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs (id) on delete cascade,
  program_id  uuid not null references outreach_programs (id) on delete cascade,
  runner_id   uuid references records (id) on delete set null,  -- nullable: anonymity
  notes       text,
  joined_at   timestamptz not null default now()
);

-- ── RLS for every new table — identical org-scoped loop as the baseline ──
do $$
declare t text;
begin
  foreach t in array array['chapters','sessions','attendance','volunteers','shopify_orders','outreach_programs','outreach_participants']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s_org_select" on %I', t, t);
    execute format('drop policy if exists "%s_org_insert" on %I', t, t);
    execute format('drop policy if exists "%s_org_update" on %I', t, t);
    execute format('drop policy if exists "%s_org_delete" on %I', t, t);
    execute format('create policy "%s_org_select" on %I for select using (org_id in (select my_org_ids()))', t, t);
    execute format('create policy "%s_org_insert" on %I for insert with check (org_id in (select my_org_ids()))', t, t);
    execute format('create policy "%s_org_update" on %I for update using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()))', t, t);
    execute format('create policy "%s_org_delete" on %I for delete using (org_id in (select my_org_ids()))', t, t);
  end loop;
end $$;

-- ============================================================
-- TWO SIGNUP PATHS — Made Running Staff vs. self-registering Runner.
-- `/login` (Login.jsx) stays the STAFF path: Supabase Auth account +
-- create_org() above — full CRM access. `/join` (JoinRunner.jsx) is the
-- new public, no-login RUNNER path: a prospective/new community member
-- fills in their own name + waiver info and it lands directly in
-- `records` for staff to see on the Runners list — no auth.users row,
-- no membership, no CRM access, ever. Deliberately mirrors the ONE-line
-- `ACTIVE_TENANT_KEY` re-skin mechanism: each org gets a stable
-- `public_join_slug` (defaults to the tenant key, e.g. "maderunning"),
-- so /join always resolves to the ONE org this deployment serves,
-- without the public ever supplying — or being able to guess — an
-- arbitrary org_id (which would otherwise be a cross-tenant spam vector).
-- ============================================================

alter table orgs add column if not exists public_join_slug text unique;
alter table records add column if not exists email text;
alter table records add column if not exists phone text;

-- Public, read-only lookup: slug → { id, name } only. Safe to expose to
-- anon — reveals nothing beyond the org's own public display name.
create or replace function get_public_org(p_slug text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from orgs where public_join_slug = p_slug
$$;
grant execute on function get_public_org(text) to anon, authenticated;

-- Public runner self-registration. SECURITY DEFINER so it can insert
-- into `records` despite the caller having no membership row at all —
-- but it NEVER trusts a caller-supplied org_id: the slug is the only
-- input, resolved server-side, so a registration can only ever land in
-- the one org that slug belongs to.
create or replace function register_runner(
  p_slug                     text,
  p_full_name                text,
  p_email                    text default null,
  p_phone                    text default null,
  p_location                 text default null,
  p_emergency_contact_name   text default null,
  p_emergency_contact_phone  text default null,
  p_waiver_accepted          boolean default false
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id    uuid;
  v_record_id uuid;
begin
  select id into v_org_id from orgs where public_join_slug = p_slug;
  if v_org_id is null then
    raise exception 'Unknown registration link';
  end if;
  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Name is required';
  end if;
  if not p_waiver_accepted then
    raise exception 'Waiver must be accepted to register';
  end if;

  insert into records (
    org_id, title, email, phone, summary, status,
    emergency_contact_name, emergency_contact_phone, waiver_signed_at
  ) values (
    v_org_id, trim(p_full_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    case when p_location is not null and trim(p_location) <> ''
         then 'Self-registered — interested chapter/location: ' || trim(p_location)
         else 'Self-registered via the public sign-up form.' end,
    'new', nullif(trim(p_emergency_contact_name), ''), nullif(trim(p_emergency_contact_phone), ''), now()
  )
  returning id into v_record_id;

  return v_record_id;
end;
$$;
grant execute on function register_runner(text, text, text, text, text, text, text, boolean) to anon, authenticated;
