-- ============================================================
-- CLASS BOOKING · Section 3b — seed the COACH PROFILES.
--
-- Run AFTER supabase-classes.sql and supabase-classes-seed.sql.
--
-- Idempotent: keyed on (org_id, slug). Re-running relinks classes and
-- refreshes names, but DOES NOT overwrite a bio the club has since edited —
-- see the `do update` clause, which is the whole point of this file.
--
--
-- ⚠️  READ THIS BEFORE YOU DEMO.  These are REAL, NAMED PEOPLE.
--
-- Every other seed in this project invents plausible filler. This one must
-- not. "Micah is a former county-level athlete who found strength training
-- after an injury" is a sentence about a real man who never said it, sitting
-- on a public page under his own name, where his own members will read it.
-- Inventing that is not placeholder copy, it is putting words in someone's
-- mouth — and the club would be the one answering for it.
--
-- So the bio below each coach restates ONLY what the club's own timetable
-- already says: which classes they lead and when. Nothing about their
-- history, qualifications, training philosophy or personality is guessed.
-- credentials and photo_url are left NULL for the same reason: a made-up
-- qualification is the one kind of filler that can get a gym sued, and a
-- stock photo of a stranger captioned with someone's real name is worse
-- than an empty circle.
--
-- HOW THE CLUB FILLS THESE IN
--   Eight short paragraphs, written by the coaches themselves, pasted over
--   the `bio` values below — or, once Section 7's admin screen lands, typed
--   into the Coaches editor with no SQL at all. Until then this file is the
--   only way in, which is why every bio is a single quoted string on one
--   line: easy to select and replace without reading SQL.
-- ============================================================

do $$
declare
  v_org uuid;
  v_coaches int;
  v_linked  int;
  v_orphans int;
begin
  select id into v_org from orgs where public_join_slug = 'maderunning' limit 1;
  if v_org is null then
    raise exception 'No org with public_join_slug = ''maderunning''. Run supabase-seed.sql first.';
  end if;

  -- ── The eight coaches behind the twelve classes ─────────────
  -- Eight, not twelve, because three of them teach more than one slot: Micah
  -- has both Hot Kettlebells evenings, Jade has CaTcH a Circuit and the
  -- Monday morning class, K3 & Marvin have both Valley sessions. That
  -- one-to-many is the entire reason a bio cannot live on `classes`.
  --
  -- Eight and not nine: Dog Business HIIT has no coach on the club's
  -- timetable, so it has no profile to create. The DO block counts that gap
  -- and prints it rather than letting 11-of-12 read as complete.
  --
  -- 'k3-marvin' is one row, not two. They are billed together on the
  -- timetable and coach together; splitting them would mean deciding which
  -- of them "owns" The Valley, and classes.coach_profile_id only holds one.
  -- If they ever want separate write-ups, that is a second row and a
  -- relink — not a schema change.
  insert into coaches (org_id, slug, name, bio)
  values
    (v_org, 'jade',      'Jade',
      'Jade leads CaTcH a Circuit on Tuesday evenings and the Monday morning Hot Kettlebells class, which is women only.'),
    (v_org, 'micah',     'Micah',
      'Micah leads Hot Kettlebells twice a week — Monday and Saturday evenings at 7.30pm.'),
    (v_org, 'hermen',    'Hermen',
      'Hermen leads the 5am Tuesday HIIT class.'),
    (v_org, 'k3-marvin', 'K3 & Marvin',
      'K3 and Marvin lead The Valley together, on Wednesday evenings and Friday mornings.'),
    (v_org, 'brittany',  'Brittany',
      'Brittany leads Yoga on Thursday evenings.'),
    (v_org, 'daria',     'Daria',
      'Daria leads Friday morning Kettlebells.'),
    (v_org, 'malachi',   'Malachi',
      'Malachi leads Hustle Hard on Saturday mornings.'),
    (v_org, 'nathaniel', 'Nathaniel',
      'Nathaniel leads The Propain HIIT Class on Sunday lunchtimes.')
  on conflict (org_id, slug) do update
    -- Name yes, bio NO. Re-running this file after a coach has written their
    -- own paragraph must not silently reinstate my placeholder. `name` is
    -- safe to refresh because it is transcribed from the timetable; `bio` is
    -- the field the club owns, so it is left alone once set.
    set name = excluded.name;

  -- ── Link each class to its coach ────────────────────────────
  -- Matched on coach_name, the text column the timetable seed already
  -- filled. That text stays in place rather than being cleared: it is the
  -- fallback in public_class_by_slug's coalesce, so a class whose profile is
  -- later deactivated still shows a coach instead of a blank.
  update classes c
     set coach_profile_id = co.id
    from coaches co
   where co.org_id = c.org_id
     and c.org_id  = v_org
     and co.name   = c.coach_name;

  select count(*) into v_coaches from coaches where org_id = v_org;
  select count(*) into v_linked  from classes where org_id = v_org and coach_profile_id is not null;

  -- Dog Business HIIT has no coach_name on the club's timetable, so it gets
  -- no profile and no link. Counted and reported rather than quietly ignored
  -- — an unlinked class is a real gap someone has to close, and a seed that
  -- prints "8 linked" without saying "of 12" hides it.
  select count(*) into v_orphans
    from classes where org_id = v_org and is_active and coach_profile_id is null;

  raise notice 'Coaches: % profiles, % classes linked, % active classes still with no profile.',
    v_coaches, v_linked, v_orphans;
  raise notice 'Bios are PLACEHOLDERS restating the timetable. Replace with words the coaches wrote.';
end $$;
