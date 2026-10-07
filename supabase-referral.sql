-- ============================================================
-- REFERRAL ATTRIBUTION  ("Add a friend")
-- ============================================================
-- Run this ONCE in the Supabase SQL editor for the Made Running
-- project. It is additive and idempotent: it creates one function
-- and touches no table, no column and no existing policy.
--
-- WITHOUT this file the app still works end to end — a member can
-- invite a friend, the friend opens /join?ref=CODE, sees the
-- "invited by a club member" note and signs up normally. The only
-- thing missing is that the ref code is not recorded against the
-- new Runner, so the club cannot report on who referred whom.
--
-- ── WHY A FUNCTION AND NOT A DIRECT UPDATE ──────────────────
-- /join is a PUBLIC, no-login page, so it runs as the `anon` role.
-- `anon` has no membership row and therefore matches no RLS policy
-- on `records`. The reason the existing signup works at all is that
-- register_runner is SECURITY DEFINER: it runs with the privileges
-- of its owner and bypasses RLS entirely.
--
-- A client-side `update(records).set(tags)` from `anon` would match
-- no policy. Critically, RLS FILTERS rather than ERRORS — Postgres
-- reports "0 rows updated" and PostgREST returns success with a
-- null error. The client would look like it worked while writing
-- nothing at all. That is the failure mode this file exists to
-- prevent, and it is why attribution goes through a definer
-- function instead.
--
-- ── WHY NOT JUST ADD A PARAMETER TO register_runner ─────────
-- Because an optional 9th argument creates a SECOND overload that
-- still matches the original 8-argument call. Postgres cannot pick
-- between them and raises "function register_runner(...) is not
-- unique", which would break signup for everyone. A separate
-- function has no such ambiguity.
--
-- ── WHY THE CODE IS A TAG AND NOT A COLUMN ──────────────────
-- `records` already has `tags text[]`. Storing `ref:ABC123` there
-- needs no ALTER TABLE against a live client project, and the tag
-- is immediately visible in the existing Runners UI.

create or replace function attach_referral(
  p_record_id uuid,
  p_ref_code  text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- Normalise and validate defensively. p_ref_code arrives from a URL
  -- query string on a public page, so it is untrusted input even though
  -- the client already sanitises it. Anything outside A-Z0-9 is dropped
  -- and the result is capped, so a hostile value cannot smuggle content
  -- into the tags array.
  v_code := substring(upper(regexp_replace(coalesce(p_ref_code, ''), '[^A-Za-z0-9]', '', 'g')) for 12);

  if v_code = '' or p_record_id is null then
    return false;
  end if;

  -- Abuse bounds. This function is callable by `anon`, so without limits
  -- anyone could retag arbitrary Runners. Two constraints make that
  -- uninteresting:
  --   1. the record must have been created in the last 10 minutes, so
  --      only a just-completed signup can be tagged;
  --   2. the record must not already carry a ref: tag, so a referral
  --      cannot be overwritten once set.
  update records
     set tags = array_append(coalesce(tags, '{}'), 'ref:' || v_code)
   where id = p_record_id
     and created_at > now() - interval '10 minutes'
     and not exists (
       select 1 from unnest(coalesce(tags, '{}')) t where t like 'ref:%'
     );

  return found;
end;
$$;

-- Same grant surface as register_runner: the public join page calls this
-- while logged out, and staff may call it from the app.
grant execute on function attach_referral(uuid, text) to anon, authenticated;

-- ── VERIFY ──────────────────────────────────────────────────
-- After running the above, this should return one row:
--   select proname, pronargs from pg_proc where proname = 'attach_referral';
--
-- To see referrals captured so far:
--   select title, tags, created_at
--     from records
--    where exists (select 1 from unnest(tags) t where t like 'ref:%')
--    order by created_at desc;
