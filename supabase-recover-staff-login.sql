-- ── Recover a deleted staff login ───────────────────────────────────────────
-- (Oct 2026: the staff auth user was deleted by accident in the Supabase
-- dashboard. The Made Running workspace itself SURVIVED — verified via the
-- register_runner slug probe — because orgs.created_by points at a different
-- account. Deleting the user only cascade-deleted their membership row, so
-- recovery is: recreate the user, then re-attach them as owner.)
--
-- STEP 1 — in the Supabase dashboard, NOT here:
--   Authentication → Users → Add user → Create new user
--   Enter the staff email, choose a password, tick "Auto Confirm User".
--
--   Do NOT use the website's own Create-account form for this: a genuine
--   signup with no workspace calls create_org() and mints a brand-new empty
--   workspace, and the dashboard would then open on the wrong one.
--
-- STEP 2 — edit the email on the line below, then run this whole file in
--   the SQL editor. Safe to run twice: the insert upserts the owner role.

do $$
declare
  v_email text := 'PUT-THE-STAFF-EMAIL-HERE';   -- ← edit this line only
  v_user  uuid;
  v_org   uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No auth user with email "%" — do Step 1 first (Authentication → Users → Add user).', v_email;
  end if;

  -- The same lookup register_runner uses: the slug names exactly one org,
  -- so this cannot attach the login to the wrong workspace.
  select id into v_org from orgs where public_join_slug = 'maderunning';
  if v_org is null then
    raise exception 'No org with public_join_slug = maderunning — the workspace is missing, stop and investigate.';
  end if;

  insert into memberships (org_id, user_id, role)
  values (v_org, v_user, 'owner')
  on conflict (org_id, user_id) do update set role = 'owner';

  raise notice 'Done: % is an owner of the Made Running workspace again.', v_email;
end $$;

-- Afterwards: sign in at https://maderunning.co.uk/app with the new
-- password. Change it any time via "Forgot your password?" on the login
-- page if you'd rather pick one by email link.
