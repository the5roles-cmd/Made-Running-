// ============================================================
// CLASS BOOKING — data layer for the coach/admin side.
// Flow-chart Steps 1, 1a, 2.
//
// Everything that touches the `classes` table goes through here so the
// rules live in one file rather than being re-derived on each screen.
//
// THE RULE THIS FILE EXISTS TO ENFORCE (your explicit instruction):
// class names are DYNAMIC. Nothing here caches, copies or hard-codes a
// class name. Every function returns rows read live from the class record,
// so a rename shows up everywhere on the next read with no migration.
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured, TABLE_MISSING } from './supabase'
import { useAuth } from '../auth/AuthProvider'
import { isStaffRole } from './constants'
// The public class page resolves its CLUB from the deployment's tenant key —
// the same way BookGym does. classes.slug is unique per org, not globally, so
// a class slug alone cannot identify a row.
import { tenant } from './theme'

// ── Days ────────────────────────────────────────────────────
// Index IS the stored value: 0=Sunday .. 6=Saturday. That matches Postgres
// extract(dow) AND JavaScript getDay(), which is why this array can be
// indexed directly and there is no lookup table to keep in sync. Had the
// schema used 1=Monday (the ISO convention) every read and write across
// this boundary would need ±1, and one of them would eventually be missed.
export const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

// The null check is NOT defensive noise — it is load-bearing, and it caught a
// real bug. `Number(null)` is 0, and 0 is a VALID day here (Sunday), so
// `DAYS.find(x => x.value === Number(n))` matched Sunday for a class with no
// weekly slot at all. The class list would have filed it under "Sundays" and,
// worse, classShareMessage() would have told the WhatsApp group the class runs
// "Sundays 9.30am". A falsy-check (`if (!n)`) would have the same flaw in
// reverse: it would reject Sunday itself.
export const dayLabel = (n, short = false) => {
  if (n === null || n === undefined || n === '') return '—'
  const d = DAYS.find((x) => x.value === Number(n))
  if (!d) return '—'
  return short ? d.short : d.label
}

// '09:30:00' → '9.30am'. The club writes its timetable that way (see the
// real PDF: "9.30", "7.30pm"), so the app should read the way the club
// speaks rather than imposing 24-hour clock on members.
export function fmtTime(t) {
  if (!t) return '—'
  const [hRaw, m] = String(t).split(':')
  const h = Number(hRaw)
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}.${m}${suffix}`
}

// Integer pennies → '£10.00', or 'Free'. Pennies never become a float on
// the way in: dividing by 100 for DISPLAY is safe because the result is
// immediately a string. The moment a price is arithmetic again it must go
// back to pennies — see price_pennies in supabase-classes.sql.
export function fmtPrice(pennies) {
  const p = Number(pennies || 0)
  if (p <= 0) return 'Free'
  return `£${(p / 100).toFixed(2)}`
}

// '£10' / '10.00' / '10' → 1000 pennies. Math.round, not truncation:
// 10.99 * 100 is 1098.9999999999998 in binary floating point, and a
// truncating conversion would quietly charge £10.98.
export function poundsToPennies(v) {
  const n = Number(String(v ?? '').replace(/[£,\s]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

// Mirror of slugify() in supabase-classes.sql, used only to PREVIEW the
// link while the coach is still typing the name. The database generates the
// real one, so the two can never disagree about what got saved.
export const slugify = (s = '') =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')

// ── Step 2: the shareable link ──────────────────────────────
// One link per CLASS (decision 11), not per session — a coach pastes this
// into the WhatsApp group once and it keeps working every week.
//
// Built from the SLUG, never from the name or the id:
//   • the name can change (and must not break links already in circulation)
//   • the id is a uuid, which is unreadable in a group chat
// `/c/` rather than `/class/` purely for length: this gets pasted into
// WhatsApp, where a shorter URL is less likely to be line-wrapped.
export const CLASS_LINK_BASE = '/c'
export const classPath = (slug) => `${CLASS_LINK_BASE}/${slug}`
export function classShareUrl(slug) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}${classPath(slug)}`
}

// The message a coach sends. Reads the class row, so a renamed class
// produces a renamed message with no code change — the whole point of
// keeping names out of this file.
export function classShareMessage(cls) {
  const bits = [
    `${cls.name} — ${dayLabel(cls.recurrence_day)}s ${fmtTime(cls.recurrence_time)}`,
    cls.coach_name ? `with ${cls.coach_name}` : null,
    cls.location || null,
    fmtPrice(cls.price_pennies),
    '',
    'Book your place:',
    classShareUrl(cls.slug),
  ]
  return bits.filter(Boolean).join('\n')
}

// ── Which membership am I? ──────────────────────────────────
// classes.coach_id points at memberships(id), not auth.users(id), because a
// coach at one club must not be a coach at another — the org scoping comes
// free with the membership row. So the coach's own class list needs their
// membership id, which AuthProvider does not carry.
export function useMyMembershipId() {
  const { user, orgId } = useAuth()
  const [membershipId, setMembershipId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function run() {
      if (!supabaseConfigured || !user?.id || !orgId) {
        if (alive) setLoading(false)
        return
      }
      const { data } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle()
      if (!alive) return
      setMembershipId(data?.id || null)
      setLoading(false)
    }
    run()
    // Cleanup flag: switching org mid-fetch would otherwise let a stale
    // response overwrite the new org's membership id.
    return () => { alive = false }
  }, [user?.id, orgId])

  return { membershipId, loading }
}

// ── Step 1a: the classes this person may manage ─────────────
// Admin/owner → every class in the club.
// Coach       → ONLY their own.
//
// The coach filter is applied in the QUERY (.eq('coach_id', …)), not with
// .filter() on the result. Filtering client-side would mean the browser had
// already received every other coach's classes — which is exactly the
// "hiding is not protecting" mistake RequireStaff.jsx warns about. RLS
// permits the read (members need the class list to book), so the narrowing
// has to be deliberate here.
export function useManagedClasses() {
  const { orgId, effectiveRole } = useAuth()
  const { membershipId, loading: loadingMembership } = useMyMembershipId()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Distinguished from a generic error on purpose: "the migration has not
  // been run" has a specific fix (paste two files into the SQL Editor) and
  // deserves to say so, rather than surfacing as
  // `relation "classes" does not exist`.
  const [missing, setMissing] = useState(false)

  const isStaff = isStaffRole(effectiveRole)

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !orgId) {
      setLoading(false)
      return
    }
    // A coach with no membership id yet cannot be narrowed to safely, so
    // return nothing rather than falling back to the whole club. Failing
    // closed matters here: the fallback would be a silent data leak.
    if (!isStaff && !membershipId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    let q = supabase
      .from('classes')
      // class_sessions(...) is an embedded read, so "when is this class next
      // on, and is it cancelled" arrives with the class instead of costing
      // one request per row.
      .select('*, chapters(name), class_sessions(id, starts_at, status)')
      .eq('org_id', orgId)
      .order('recurrence_day', { ascending: true })
      .order('recurrence_time', { ascending: true })

    if (!isStaff) q = q.eq('coach_id', membershipId)

    const { data, error: err } = await q
    if (err) {
      if (err.code === TABLE_MISSING) setMissing(true)
      else setError(err.message)
    } else {
      setRows(data || [])
      setError(null)
      setMissing(false)
    }
    setLoading(false)
  }, [orgId, isStaff, membershipId])

  useEffect(() => {
    if (!loadingMembership) refresh()
  }, [refresh, loadingMembership])

  return { rows, loading: loading || loadingMembership, error, missing, refresh, isStaff }
}

// Coaches to pick from when assigning a class. Only staff can reassign, so
// this is only ever called from the admin path.
export function useCoachOptions() {
  const { orgId } = useAuth()
  const [coaches, setCoaches] = useState([])

  useEffect(() => {
    let alive = true
    async function run() {
      if (!supabaseConfigured || !orgId) return
      const { data } = await supabase
        .from('memberships')
        .select('id, role, user_id')
        .eq('org_id', orgId)
        .in('role', ['coach', 'admin', 'owner'])
      if (alive) setCoaches(data || [])
    }
    run()
    return () => { alive = false }
  }, [orgId])

  return coaches
}

// ── Writes ──────────────────────────────────────────────────

// ── The video URL, on its way INTO the database ──────────────────────
// A third check, and it is not redundant with the other two. The CHECK
// constraint and videoEmbed() both exist to protect the PUBLIC PAGE from a
// dangerous URL. This one exists to protect the COACH from an unreadable
// error: paste an http:// link and Postgres rejects the row with
// `violates check constraint "classes_video_https"`, which handleSubmit puts
// on screen verbatim. A coach reads that and concludes the app is broken.
//
// Note what this deliberately does NOT do: it does not reject a valid https
// URL that videoEmbed() will refuse to frame (an Instagram or Facebook link,
// say). Those save fine and ClassPage renders them as a plain "Watch the
// clip" link — a working outcome, and blocking it here would take away a
// feature the public page already supports. The form warns instead; see the
// preview panel in Classes.jsx.
function cleanVideoUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return null
  if (!/^https:\/\//i.test(v)) {
    throw new Error(
      'The video link must start with https:// — copy it from the address ' +
      'bar of the YouTube or Vimeo page.',
    )
  }
  return v
}

// ── The class photo, on its way INTO the database ───────────────────
// Same job as cleanVideoUrl: turn a constraint violation into a sentence. The
// classes_image_https CHECK would otherwise surface to the coach as
// `violates check constraint "classes_image_https"`, which reads as a crash.
//
// No host check, matching imageSrc() — see the note there for why an <img> and
// an <iframe> are not the same risk and should not get the same rule.
function cleanImageUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return null
  if (!/^https:\/\//i.test(v)) {
    throw new Error(
      'The image link must start with https:// — right-click the image, ' +
      'choose "Copy image address", and paste that.',
    )
  }
  return v
}

// Focus is normalised rather than rejected, which is the opposite of the two
// above and deliberately so. A bad video or image URL means the club intended
// something we cannot do, and they need to know. A focus of 'middle' or
// 'centre' means they intended the DEFAULT and spelled it their own way —
// refusing to save the whole class over an alignment hint would be absurd.
// imageFocus() maps anything unrecognised to 'center', which is what they
// wanted, so nothing is lost and nothing is blocked.
function cleanImageFocus(raw) {
  const v = String(raw || '').trim()
  if (!v) return null
  const safe = imageFocus(v)
  // Storing null rather than the literal 'center' keeps "they never set this"
  // distinguishable from "they set it to centre on purpose" — which matters the
  // day someone wants to bulk-set a focus for every class that has not got one.
  return safe === 'center' ? null : safe
}

// Create a class. The slug is generated ONCE, here, from the opening name.
export async function createClass(orgId, form) {
  const name = String(form.name || '').trim()
  if (!name) throw new Error('A class needs a name')

  const base = slugify(name)
  // Slug must be unique per org, and "Hot Kettlebells" legitimately exists
  // three times (Mon am, Mon pm, Sat pm — you confirmed keeping the split).
  // So the day and time are folded in, which also makes the link
  // self-describing when it is pasted into a group chat:
  //   /c/hot-kettlebells-mon-0930
  const suffix =
    form.recurrence_day !== '' && form.recurrence_time
      ? `-${dayLabel(form.recurrence_day, true).toLowerCase()}-${String(form.recurrence_time).replace(':', '').slice(0, 4)}`
      : ''

  const { data, error } = await supabase
    .from('classes')
    .insert({
      org_id: orgId,
      name,
      slug: `${base}${suffix}`,
      coach_id: form.coach_id || null,
      coach_name: String(form.coach_name || '').trim() || null,
      description: String(form.description || '').trim() || null,
      location: String(form.location || '').trim() || null,
      capacity: Number(form.capacity) > 0 ? Number(form.capacity) : 40,
      price_pennies: poundsToPennies(form.price),
      recurrence_day: form.recurrence_day === '' ? null : Number(form.recurrence_day),
      recurrence_time: form.recurrence_time || null,
      female_only: !!form.female_only,
      is_paused: !!form.is_paused,
      pause_note: String(form.pause_note || '').trim() || null,
      video_url: cleanVideoUrl(form.video_url),
      video_caption: String(form.video_caption || '').trim() || null,
      image_url: cleanImageUrl(form.image_url),
      image_focus: cleanImageFocus(form.image_focus),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Update a class. The SLUG IS NEVER IN THIS PAYLOAD, and that omission is
// deliberate rather than forgotten: renaming a class must not break the link
// a coach already pasted into WhatsApp. The name changes everywhere it is
// displayed (it is always read from this row); the URL stays put.
export async function updateClass(id, orgId, form) {
  const patch = {
    name: String(form.name || '').trim(),
    coach_id: form.coach_id || null,
    coach_name: String(form.coach_name || '').trim() || null,
    description: String(form.description || '').trim() || null,
    location: String(form.location || '').trim() || null,
    capacity: Number(form.capacity) > 0 ? Number(form.capacity) : 40,
    price_pennies: poundsToPennies(form.price),
    recurrence_day: form.recurrence_day === '' ? null : Number(form.recurrence_day),
    recurrence_time: form.recurrence_time || null,
    female_only: !!form.female_only,
    is_paused: !!form.is_paused,
    pause_note: String(form.pause_note || '').trim() || null,
    // Clearing the field must actually clear the column, which is why this is
    // `|| null` rather than a conditional spread. A patch that omits the key
    // when the input is empty makes the video un-removable: PostgREST leaves
    // absent columns alone, so a coach who deletes the URL and saves gets the
    // old clip back on the next page load, and has no way to tell why.
    video_url: cleanVideoUrl(form.video_url),
    video_caption: String(form.video_caption || '').trim() || null,
    // `|| null` for the same reason as video_url above — and it bites harder
    // here, because clearing image_url is how a coach goes BACK to the
    // discipline default. Omit the key and that is a one-way door: they can
    // override the default but never undo it.
    image_url: cleanImageUrl(form.image_url),
    image_focus: cleanImageFocus(form.image_focus),
  }
  if (!patch.name) throw new Error('A class needs a name')

  const { data, error } = await supabase
    .from('classes')
    .update(patch)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Turn the weekly rules into dated, bookable sessions (decision 10).
// Idempotent in SQL, so this is safe to press twice — it returns the count
// of sessions it genuinely added, which is 0 on the second press.
export async function generateSessions(orgId) {
  const { data, error } = await supabase.rpc('generate_class_sessions', { p_org_id: orgId })
  if (error) throw new Error(error.message)
  return data ?? 0
}

// ── Reading a class's own timetable (Step 3's data, used here for
// "next on") ───────────────────────────────────────────────────
// Sorts and filters the embedded sessions rather than issuing a second
// query. `status` is checked because a cancelled date must not be advertised
// as the next one — the coach cancelled it precisely so nobody turns up.
export function nextSession(cls) {
  const now = Date.now()
  return (cls.class_sessions || [])
    .filter((s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0] || null
}

export function scheduledCount(cls) {
  const now = Date.now()
  return (cls.class_sessions || []).filter(
    (s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() > now,
  ).length
}

export function fmtWhen(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// STEP 3 — the PUBLIC class page (/c/:slug)
// ============================================================
// Everything above this line runs for a signed-in coach or admin. Everything
// below runs for someone with NO ACCOUNT, and that changes how the data has
// to be fetched — not just which fields are shown.
//
// A plain `supabase.from('classes').eq('slug', …)` returns ZERO ROWS to a
// visitor without a login, because classes_select is
// `org_id in (select my_org_ids())` and a person with no membership has no
// org ids. It does not error. It returns an empty array, and the page renders
// "class not found" for the exact audience Step 3 is built for.
//
// So the public read goes through public_class_by_slug(), a SECURITY DEFINER
// function that returns a narrow set of public columns. See Section 11 of
// supabase-classes.sql for why the policy was not simply widened.

// PostgREST's code for "that function does not exist", which is what comes
// back when supabase-classes.sql has not been run yet. Distinguished from a
// real error because the fix is specific and worth stating.
export const RPC_MISSING = 'PGRST202'

// Timezone is PINNED, and that is not pedantry. starts_at is timestamptz, so
// toLocaleString() renders it in the VIEWER's zone by default. A member
// checking the timetable from Spain would be told Yoga is at 8pm when the
// class is at 7pm in Openshaw — the class is a place, not a video call, so
// its time is a fact about Manchester and nothing else.
const UK = 'Europe/London'

// 'Mon 29 Sep'
export function fmtDayDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: UK,
  })
}

// '9.30am' — the club's own notation, from the timestamp rather than the
// weekly rule, so a one-off moved date reads correctly.
export function fmtClockFromStamp(v) {
  if (!v) return '—'
  const parts = new Date(v).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: UK,
  })
  return fmtTime(parts)
}

// How many days away, in words. "Today"/"Tomorrow" beat a date for the
// question someone on this page is actually asking.
export function relativeWhen(v) {
  if (!v) return ''
  // Compared at DAY granularity in UK time. Subtracting timestamps and
  // dividing by 86,400,000 would call a class 21 hours away "today" or
  // "tomorrow" depending on the hour it happened to be looked at.
  const dayKey = (d) => d.toLocaleDateString('en-CA', { timeZone: UK })
  const target = dayKey(new Date(v))
  const today = dayKey(new Date())
  if (target === today) return 'Today'
  const tmr = new Date()
  tmr.setDate(tmr.getDate() + 1)
  if (target === dayKey(tmr)) return 'Tomorrow'
  return ''
}

// ── Step 4's vocabulary ─────────────────────────────────────
// The states come from session_bookable() in SQL. This turns each one into
// something a member can act on — which is the point of keeping
// 'not_enough_seats' separate from 'full' (decision 4). Takes the class so
// "contact the coach directly" can name them, and the group size so the
// message can say how many actually fit.
export function stateCopy(state, seatsLeft, places, cls) {
  // Trimmed, not raw. One class on the club's timetable has no coach and
  // arrives as an empty string — raw, that produced "message  directly" with a
  // double space where a name should be, on the message telling someone a
  // class is full. coachNameOf is hoisted; it is defined in Section 3b below.
  const coach = coachNameOf(cls)
  switch (state) {
    case 'ok':
      return { kind: 'ok', label: seatsLeft <= 5 ? `${seatsLeft} left` : `${seatsLeft} places`, can: true }
    case 'not_enough_seats':
      return {
        kind: 'tight',
        label: `Only ${seatsLeft} left`,
        // Your decision 4, spelled out on the button rather than buried:
        // a group of 5 facing 2 seats should be told both options.
        note: `You asked for ${places}. Book for ${seatsLeft}, or join the waiting list for all ${places}.`,
        can: false,
      }
    case 'full':
      // Your decision: waiting list OR contact the coach directly.
      return {
        kind: 'full',
        label: 'Full',
        note: coach ? `Join the waiting list, or message ${coach} directly.` : 'Join the waiting list.',
        can: false,
      }
    case 'paused':
      return {
        kind: 'off',
        label: 'Paused',
        note: cls?.pause_note || (coach ? `Message ${coach} to find out when it restarts.` : null),
        can: false,
      }
    case 'cancelled':
      // Shown, not hidden. A removed row reads as "that week never existed";
      // a struck-through "Cancelled" stops someone turning up.
      return { kind: 'off', label: 'Cancelled', note: 'This date is off. Other weeks are still on.', can: false }
    case 'past':
      return { kind: 'off', label: 'Closed', can: false }
    default:
      return { kind: 'off', label: '—', can: false }
  }
}

// ── The class itself ────────────────────────────────────────
export function usePublicClass(slug) {
  const [cls, setCls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    async function run() {
      if (!supabaseConfigured) {
        if (alive) { setMissing(true); setLoading(false) }
        return
      }
      setLoading(true)
      const { data, error: err } = await supabase.rpc('public_class_by_slug', {
        // Resolved from the DEPLOYMENT, never from the URL. The slug is
        // unique per org, so the org has to come from somewhere — and taking
        // it from the visitor's URL would let anyone read any club's classes
        // by editing the address bar.
        p_org_slug: tenant.key,
        p_class_slug: slug,
      })
      if (!alive) return
      if (err) {
        setMissing(err.code === RPC_MISSING)
        setError(err.code === RPC_MISSING ? null : err.message)
        setLoading(false)
        return
      }
      // `returns table (...)` means supabase-js hands back an ARRAY even
      // though at most one row can match (org_id, slug) is unique. Reading
      // `data.name` instead of `data[0].name` would silently render a class
      // page with no title rather than throwing.
      const row = (Array.isArray(data) ? data[0] : data) || null

      // A LOUD dev warning for a silent production failure.
      //
      // This page's org comes from tenant.key, which comes from VITE_TENANT,
      // which must match orgs.public_join_slug. That is a coupling across
      // three files (.env.local → theme.js → the seed), and VITE_* is
      // substituted at BUILD time, so a build with VITE_TENANT unset does not
      // error — tenant.key falls back to 'default', no org matches, and every
      // single shared class link 404s. The page looks fine. The links are
      // dead. Nothing logs.
      //
      // Zero rows is also the correct answer for a genuinely wrong slug, so
      // this cannot throw; it narrows where to look.
      if (!row && import.meta.env.DEV) {
        console.warn(
          `[classes] public_class_by_slug returned no row for org "${tenant.key}", class "${slug}".\n` +
            (tenant.key === 'default'
              ? 'VITE_TENANT is unset, so the org slug is "default". Set VITE_TENANT in .env.local and RESTART the dev server — Vite inlines it at build time.'
              : `Check that an org exists with public_join_slug = '${tenant.key}' and a class with slug = '${slug}' (supabase-classes-seed.sql).`),
        )
      }

      setCls(row)
      setError(null)
      setMissing(false)
      setLoading(false)
    }
    run()
    return () => { alive = false }
  }, [slug])

  return { cls, loading, error, missing, notFound: !loading && !missing && !error && !cls }
}

// ── Step 4: that class's own dated timetable ────────────────
// Re-reads whenever `places` changes, because the answer genuinely changes:
// a date with two mats left is available to one person and unavailable to a
// group of three. That is why list_session_states takes p_places — the same
// list shows different states to the same visitor.
export function usePublicSessions(classId, places) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !classId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('list_session_states', {
      p_class_id: classId,
      p_places: places,
    })
    if (error) {
      setRows([])
    } else {
      // 'past' is dropped rather than greyed out. Every other state is a
      // thing the visitor might act on; a date that has already run is just
      // noise between them and the next one they can book.
      setRows((data || []).filter((r) => r.state !== 'past'))
    }
    setLoading(false)
  }, [classId, places])

  useEffect(() => { refresh() }, [refresh])

  return { sessions: rows, loading, refresh }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3b · Coaches, class video, ratings
// ═══════════════════════════════════════════════════════════════════

// ── The coach's name, or nothing ────────────────────────────────────
// Not `cls.coach_name || null`. The club's own timetable has one class — Dog
// Business HIIT — with NO coach listed, and it arrives as an empty string, not
// as null. `||` catches that, but a name of '   ' (one stray space typed into
// the admin form) would pass straight through and render a "Coach" fact with a
// blank value next to it. Trim first, then decide.
export function coachNameOf(cls) {
  const n = (cls?.coach_name || '').trim()
  return n || null
}

// ── Where a coach's full write-up lives ─────────────────────────────
// /coaches#<slug>. Built from coach_slug, which is a STABLE key, never the
// display name — see the note on the column in supabase-classes.sql.
//
// Returns null when the class has no linked profile, which is the common case
// while the club fills bios in one at a time. The caller must render no link
// at all rather than a link to `/coaches#null`, which would scroll nowhere and
// look broken on 11 of 12 classes today.
export const COACHES_PATH = '/coaches'
export const coachPath = (slug) => (slug ? `${COACHES_PATH}#${slug}` : null)

// ── Video: turn a pasted URL into something safe to put in an iframe ──
// video_url is club-supplied and ends up as an <iframe src>, which makes it
// the single most dangerous field on a public page: a `javascript:` URL there
// is script execution in the page's own origin.
//
// The database already refuses anything that is not https:// (the
// classes_video_https CHECK). That is necessary and NOT sufficient — a
// constraint can tell https from javascript, but it cannot tell YouTube from
// an attacker's perfectly valid https site. So this is the second layer: an
// allowlist of HOSTS we are willing to frame, and a rewrite into each
// provider's documented embed form.
//
// Neither layer alone closes the hole. Drop the constraint and anything that
// writes to the table directly (a seed, psql, a future admin RPC) bypasses
// this function entirely. Drop this function and the constraint happily
// accepts https://attacker.example.
//
// Returns { src, provider } or null. A URL that is not on the list returns
// null and the page shows a plain link instead of a frame — refusing to embed
// an unknown host is a feature, and the caller must not fall back to raw src.
const VIDEO_HOSTS = {
  // YouTube. The /embed/ path is the only one that works in an iframe;
  // a watch?v= URL pasted from the address bar renders YouTube's
  // "refused to connect" box, which reads to the club as "the site is broken".
  'youtube.com': 'youtube',
  'www.youtube.com': 'youtube',
  'm.youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'youtube-nocookie.com': 'youtube',
  'www.youtube-nocookie.com': 'youtube',
  // Vimeo — player.vimeo.com/video/<id>
  'vimeo.com': 'vimeo',
  'www.vimeo.com': 'vimeo',
  'player.vimeo.com': 'vimeo',
}

export function videoEmbed(url) {
  const raw = (url || '').trim()
  if (!raw) return null

  let u
  try {
    u = new URL(raw)
  } catch {
    // Not a parseable URL at all. Returning null (not the string) is what
    // stops a half-typed value becoming an iframe src.
    return null
  }

  // Re-checked here even though the DB constraint exists, because this
  // function is also what the admin form will use to preview a URL BEFORE it
  // is saved — at which point no constraint has run yet.
  if (u.protocol !== 'https:') return null

  const provider = VIDEO_HOSTS[u.hostname.toLowerCase()]
  if (!provider) return null

  if (provider === 'youtube') {
    // Three shapes the club might paste, all yielding the same id:
    //   youtu.be/<id>            → first path segment
    //   /watch?v=<id>            → the query param
    //   /embed/<id>, /shorts/<id> → second path segment
    const seg = u.pathname.split('/').filter(Boolean)
    const id =
      u.hostname.toLowerCase() === 'youtu.be'
        ? seg[0]
        : u.searchParams.get('v') ||
          (['embed', 'shorts', 'v'].includes(seg[0]) ? seg[1] : null)
    // Ids are [A-Za-z0-9_-]. Validated rather than interpolated blind: the id
    // goes into a URL we then hand to the browser, and letting `../` or a `?`
    // through it is how an allowlisted host gets pointed somewhere else.
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null
    // nocookie + rel=0 so the club's own class video does not end with
    // YouTube recommending a competitor's gym.
    return {
      provider,
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
    }
  }

  // Vimeo: the numeric id is the last all-digits path segment.
  const id = u.pathname.split('/').filter(Boolean).filter((s) => /^\d+$/.test(s)).pop()
  if (!id) return null
  return { provider, src: `https://player.vimeo.com/video/${id}` }
}

// ── Class artwork ───────────────────────────────────────────────────

/**
 * A usable https image URL, or null.
 *
 * Deliberately NOT host-allowlisted, unlike videoEmbed(). The asymmetry is the
 * point: a video_url becomes an <iframe src>, which runs the framed site's
 * script inside our page, so only hosts we trust may be framed. An image_url
 * becomes an <img src>, which cannot execute anything — the worst outcome is a
 * hotlink that breaks or a tracking pixel. Allowlisting here would buy no
 * security and would lock the club out of whatever Canva, Drive or CDN URL they
 * already have, which is the only URL they are actually going to paste.
 *
 * https is enforced, and not as a formality: a http:// image on an https page
 * is blocked by the browser as mixed content, so the coach sees it save
 * successfully and then sees a broken icon, with the real reason buried in a
 * console nobody is looking at.
 *
 * Mirrors the classes_image_https CHECK constraint. Both exist on purpose —
 * this one so the page never renders a doomed <img>, the constraint so a row
 * written by any other route (SQL editor, a future import script) cannot get in.
 */
export function imageSrc(url) {
  const v = String(url || '').trim()
  if (!v) return null
  let u
  try {
    u = new URL(v)
  } catch {
    return null
  }
  return u.protocol === 'https:' ? v : null
}

/**
 * A CSS object-position value that is safe to put in a style attribute.
 *
 * This string is interpolated into inline CSS, so it is an injection surface
 * even though it presents as "just an alignment setting". The control is an
 * ALLOWLIST OF SHAPES, not a denylist of characters: one or two keywords, or
 * two percentages. Nothing containing a semicolon, a brace, a quote or `url(`
 * can match either pattern, so there is no escaping to get right and no
 * cleverness to be out-thought by.
 *
 * Falls back to 'center' rather than returning null, because every caller wants
 * a value and a null would mean each of them writing its own default — which is
 * how two call sites end up cropping the same photo differently.
 *
 * Mirrors classes_image_focus_safe in supabase-classes.sql.
 */
const FOCUS_KEYWORD = /^(left|right|top|bottom|center)( (left|right|top|bottom|center))?$/
const FOCUS_PERCENT = /^\d{1,3}% \d{1,3}%$/

// Returns '' — not 'center' — when the club has not set a focus, and the
// difference is the whole point. This value is applied as an INLINE style, so
// 'center' would beat every stylesheet: one file is used both as a card
// background (wide photo narrowed, centre is right) and as the 11:3 banner on
// the class page (the same photo flattened, where centre takes the top off a
// room full of raised arms). Those want different defaults and only CSS can
// give them one each. An empty string removes the inline declaration and lets
// each surface answer for itself.
//
// Unrecognised input still normalises to 'center', which is a separate case:
// the club typed something, it was not usable, and the safe fallback is the
// one they almost certainly meant.
export function imageFocus(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return ''
  if (FOCUS_KEYWORD.test(v) || FOCUS_PERCENT.test(v)) return v
  return 'center'
}

// ── Ratings ─────────────────────────────────────────────────────────
// rating_avg arrives NULL when rating_count is 0 — avg() of no rows is null,
// not zero. Branching on the COUNT and not on the average is the difference
// between "New class" and a 0.0-star review of a class nobody has rated.
export function ratingCopy(avg, count) {
  const n = Number(count || 0)
  if (!n) return null
  return {
    avg: Number(avg),
    count: n,
    // "1 rating", not "1 ratings". Small thing, but this string sits directly
    // under a real coach's name.
    label: `${Number(avg).toFixed(1)} · ${n} ${n === 1 ? 'rating' : 'ratings'}`,
  }
}

// ── A class's weekly slot as one line ───────────────────────────────
// "Thursdays, 7pm". Used on the coaches page, where each card lists the
// classes that coach leads and there is no single date to show — the point
// there is the recurring slot, not the next occurrence.
export function fmtRecurrence(day, time) {
  const d = dayLabel(day)
  return d ? `${d}s, ${fmtTime(time)}` : fmtTime(time)
}

// ── Grouping dates into months ──────────────────────────────────────
// The date cards on a class page are grouped under month headings. Eight
// weekly occurrences span two or three months, so a real 7-column month grid
// would be ~97% empty squares — a calendar shape that carries no information.
// Month headings over a card grid gives the same "where am I in the year"
// orientation without the emptiness.
//
// Keyed in Europe/London for the same reason every other date here is: a
// Sunday-evening class in the last week of a month is in a different MONTH
// depending on the viewer's timezone.
export function monthKey(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: UK, year: 'numeric', month: '2-digit' })
}

export function monthLabel(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { timeZone: UK, month: 'long', year: 'numeric' })
}

export function dayNumber(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { timeZone: UK, day: 'numeric' })
}

export function weekdayShort(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { timeZone: UK, weekday: 'short' })
}

// ── The coaches page read ───────────────────────────────────────────
// public_coaches(org_slug). Same wall, same reason as usePublicClass: a
// visitor has no membership row, so coaches_select matches nothing and a
// direct table read returns ZERO ROWS rather than an error. Nothing would
// appear in any log; the page would just say "no coaches yet".
export function usePublicCoaches() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!supabaseConfigured) {
        if (alive) { setLoading(false); setMissing(true) }
        return
      }
      const { data, error } = await supabase.rpc('public_coaches', {
        p_org_slug: tenant.key,
      })
      if (!alive) return
      if (error) {
        // The function not existing yet is a SETUP state, not a failure: the
        // club has not run supabase-classes.sql. Told apart here so the page
        // can name the file to run instead of showing "something went wrong".
        setMissing(error.code === RPC_MISSING || error.code === TABLE_MISSING)
        setRows([])
      } else {
        setRows(data || [])
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  return { coaches: rows, loading, missing }
}

// ── The whole timetable, in one call (Section 3c) ────────────────────
// public_classes(org_slug) backs the card calendar on /book. It exists because
// that page shows TWELVE classes: reusing public_class_by_slug would mean
// twelve round trips on gym wifi to draw one screen.
//
// This is a PROGRESSIVE ENHANCEMENT and the shape of the return says so. The
// timetable itself renders synchronously from hubClasses.js, so this hook has
// no `error` to surface and nothing waits on its `loading`. When it resolves,
// cards gain a bio, a video and a rating; when it never resolves — no Supabase
// keys, SQL not run, wifi down in the gym — the cards stay exactly as they
// were. A visitor cannot tell the difference, which is the point.
//
// Returned as a MAP keyed by slug rather than an array, because every consumer
// is asking "what does the database know about THIS card?". Handing back an
// array would put a .find() inside a render loop — 12 cards scanning 12 rows on
// every keystroke of the booking form.
export function usePublicClasses() {
  const [bySlug, setBySlug] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!supabaseConfigured) {
        if (alive) setLoading(false)
        return
      }
      const { data, error } = await supabase.rpc('public_classes', {
        p_org_slug: tenant.key,
      })
      if (!alive) return
      if (error || !data?.length) {
        // Deliberately silent. The distinction between "not set up yet" and
        // "request failed" matters on /coaches, where an empty page needs
        // explaining. Here there is no empty page to explain.
        setBySlug(null)
      } else {
        const map = {}
        for (const row of data) map[row.slug] = row
        setBySlug(map)
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  return { classesBySlug: bySlug, loading }
}

// ── The reviews read ────────────────────────────────────────────────
// A SEPARATE call from usePublicClass on purpose. The class row carries the
// name, coach, price and timetable — everything needed to start booking — and
// holding all of that behind a list of testimonials would delay the one thing
// the visitor came for. Reviews land a moment later, under a heading that is
// simply absent until they do.
export function usePublicReviews(slug, limit = 6) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!supabaseConfigured || !slug) {
        if (alive) setLoading(false)
        return
      }
      const { data, error } = await supabase.rpc('public_class_reviews', {
        p_org_slug: tenant.key,
        p_class_slug: slug,
        p_limit: limit,
      })
      if (!alive) return
      // No error branch worth surfacing. Reviews are decoration on a booking
      // page; if they fail to load the visitor should still be able to book,
      // and an error banner about testimonials would imply the class itself
      // is broken.
      setRows(error ? [] : data || [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [slug, limit])

  return { reviews: rows, loading }
}
