// ============================================================
// DEMO DATA — the club that exists only in a prospect's browser
// ============================================================
// src/lib/demoAuth.js fakes a signed-in owner. It does not fake anything for
// that owner to look at, so a demo build renders a correct, well-behaved,
// completely empty CRM: "No runners yet" on every screen. That is honest and
// useless — the prospect demo is sent to clubs deciding whether to buy, and an
// empty product demonstrates nothing except that it is empty.
//
// This module is the data half. It is only ever consulted when isDemoAuth is
// true (see the guards in src/lib/useData.js), so it cannot affect a real
// install even if it somehow shipped — which it does not, because the whole
// module is tree-shaken out of a normal build along with the rest of demo mode.
//
// ── Three rules this file follows, and why ──────────────────────────────────
//
// 1. DATES ARE RELATIVE, NEVER LITERAL.
//    This demo is a URL that gets emailed. Someone may open it a month after
//    it was deployed. Hardcoded dates would make "This week" show last month
//    and quietly turn the demo into evidence the product is abandoned. Every
//    timestamp below is derived from now() at module load, so the club is
//    always mid-season.
//
// 2. IDS LINE UP.
//    attendance.runner_id → records.id and volunteers.runner_id → records.id
//    are joined by the screens. Invented ids that do not match would render
//    rows with blank names, which reads as BROKEN rather than as new. Fake
//    data still needs referential integrity.
//
// 3. IT IS OBVIOUSLY A DEMO CLUB, NOT THE REAL ONE.
//    The runners here are invented. No real member of Made Running appears in
//    a build that gets sent to strangers — that would be the club's membership
//    list in a sales attachment. The sessions and locations are real because
//    they are already public on the website; the people are not.
import { demoOrgId, demoUser, isDemoAuth } from './demoAuth'
import { supabaseConfigured } from './supabase'
import {
  HUB_CLASSES,
  HUB_PLACEHOLDER_PRICE_PENNIES,
  classCopy,
  nextOccurrence,
} from './hubClasses'

// ── The one switch ──────────────────────────────────────────────────────────
// Exported from here, rather than redefined in each consumer, because two
// hooks now depend on it (useData.js and useMyRunner.js) and a copy that
// drifted would mean half the app served fixtures and half served nothing.
//
// Deliberately the CONJUNCTION, not isDemoAuth alone: a developer whose .env
// is genuinely missing should still get <SetupNotice> and honest empty states,
// not invented runners that look like real ones.
export const DEMO_DATA = isDemoAuth && !supabaseConfigured

// ── Clock ───────────────────────────────────────────────────────────────────
// Captured once at module load so every fixture agrees on "now" — generating
// per-call would let a list sort differently from the detail page it opens.
const NOW = new Date()
const DAY = 86400000
const iso = (msOffset) => new Date(NOW.getTime() + msOffset).toISOString()
const daysAgo = (d) => iso(-d * DAY)

// Most recent weekday `dow` (0=Sun…6=Sat) at a given hour, as an ISO string.
// `week` shifts whole weeks: 0 = this week, -1 = last week, 1 = next week.
function weekdayAt(dow, hour, minute, week = 0) {
  const d = new Date(NOW)
  d.setHours(hour, minute, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7) + week * 7)
  return d.toISOString()
}

// Stable, readable, uuid-shaped. Hand-written rather than generated so the
// cross-references below can be written literally and checked by eye.
const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`
const R = (n) => id('11111111', n) // runners  (records)
const S = (n) => id('22222222', n) // sessions
const C = (n) => id('33333333', n) // chapters
const A = (n) => id('44444444', n) // accounts
const V = (n) => id('55555555', n) // volunteers
const D = (n) => id('66666666', n) // deals
const T = (n) => id('77777777', n) // activities
const O = (n) => id('88888888', n) // shopify_orders
const AT = (n) => id('99999999', n) // attendance
const CL = (n) => id('aaaaaaaa', n) // classes
const CS = (n) => id('bbbbbbbb', n) // class_sessions

const org = demoOrgId

// ── Chapters (locations) ────────────────────────────────────────────────────
const chapters = [
  { id: C(1), org_id: org, name: 'Manchester', address: 'Platt Fields Park, M14', is_primary: true, created_at: daysAgo(900) },
  { id: C(2), org_id: org, name: 'Salford', address: 'Peel Park, M5', is_primary: false, created_at: daysAgo(240) },
]

// ── Runners ─────────────────────────────────────────────────────────────────
// Invented people. Status mix is deliberate: a demo where everyone is 'active'
// hides the lifecycle tracking, which is most of what the CRM is for. The
// at_risk and lapsed rows are the ones that make a club owner lean forward.
const RUNNERS = [
  ['Amara Okafor', 'active', ['run-leader', '5k'], 'Leads the Saturday group. Training for Manchester half.'],
  ['Danny Whitfield', 'active', ['10k'], 'Joined through a friend referral in the spring.'],
  ['Priya Raman', 'active', ['5k', 'new-to-running'], 'First 5k completed in April. Very consistent since.'],
  ['Tom Beresford', 'at_risk', ['10k'], 'Was every week until a calf strain. Not seen for a month.'],
  ['Shauna Kelly', 'active', ['pacer', 'half'], 'Paces the 30-minute group on Saturdays.'],
  ['Marcus Bell', 'new', ['new-to-running'], 'Came to his first Wednesday run last week.'],
  ['Leah Donnelly', 'active', ['5k'], 'Brings two colleagues most weeks.'],
  ['Idris Mahmood', 'active', ['run-leader', 'marathon'], 'Run leader, Salford. Manchester marathon finisher.'],
  ['Nina Castellano', 'lapsed', ['5k'], 'Moved to Leeds in the summer. Worth a check-in.'],
  ['Joe Hartley', 'at_risk', ['10k'], 'Two no-shows after booking. Follow up before he drifts.'],
  ['Fay Adeyemi', 'active', ['ambassador', '5k'], 'Runs the Instagram takeovers.'],
  ['Callum Reid', 'new', ['new-to-running'], 'Signed up online, has not attended yet.'],
  ['Hannah Searle', 'active', ['half'], 'Back after injury. Building mileage again.'],
  ['Ravi Sharma', 'active', ['10k', 'pacer'], 'Reliable Monday regular.'],
]

// Contact details that cannot reach anybody, by construction. example.com is
// reserved by RFC 2606 and 07700 900xxx is Ofcom's range set aside for
// fiction, so no row in a demo sent to strangers can ever deliver mail or
// ring a real phone. A plausible-looking real-format number could.
const emailFor = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`
const phoneFor = (i) => `07700 900${String(100 + i).padStart(3, '0')}`

const records = RUNNERS.map(([title, status, tags, summary], i) => ({
  id: R(i + 1),
  org_id: org,
  // A few runners are linked to a partner organisation so the PARTNER column
  // demonstrates the relationship rather than showing a column of dashes.
  account_id: i === 0 ? A(1) : i === 4 ? A(2) : i === 7 ? A(3) : null,
  title,
  summary,
  status,
  tags,
  email: emailFor(title),
  phone: phoneFor(i),
  lifetime_spend: [48, 0, 0, 0, 32, 0, 0, 65, 0, 0, 32, 0, 0, 0][i] || 0,
  text_blob: null,
  ai_summary: null,
  // Spread joining dates across two years so "newest first" is meaningful and
  // the new/lapsed statuses have plausible histories behind them.
  created_at: daysAgo(720 - i * 47),
}))

// ── The signed-in demo user, as a club member ───────────────────────────────
// useMyRunner joins the auth session to a club record by EMAIL, so without a
// row carrying the demo session's address the runner-side screens (Profile, My
// Runs) show a brand-new member with no history — a streak of 0 and four empty
// period cards. That is the half of the product a club owner is buying for
// their members, so it cannot be the half that looks unfinished.
//
// Pushed into `records` rather than kept separate so this row flows through
// everything else automatically: it appears in the roster, and the attendance
// generator below picks it up like any other active runner, which is what
// gives the profile a believable history instead of a hand-written one.
//
// Email is taken from demoAuth rather than retyped. The two must match exactly
// or the join silently fails, and a literal copied into a second file is how
// that happens.
records.push({
  id: R(90),
  org_id: org,
  account_id: null,
  title: demoUser.user_metadata.full_name,
  summary: 'This is you. Signed in with the demo account.',
  status: 'active',
  tags: ['run-leader'],
  email: demoUser.email,
  phone: '07700 900199',
  lifetime_spend: 0,
  text_blob: null,
  ai_summary: null,
  created_at: daysAgo(380),
})

// ── Sessions ────────────────────────────────────────────────────────────────
// The club's real public timetable: Mon 7:15pm, Wed 5:00am, Sat 9:00am.
// Four weeks back and two forward, so "this week" always has both a completed
// run to look at and an upcoming one to manage.
const SLOTS = [
  [1, 19, 15, 'Monday Club Run', 'Platt Fields Park, Manchester', C(1)],
  [3, 5, 0, 'Wednesday Sunrise 5k', 'Whitworth Park, Manchester', C(1)],
  [6, 9, 0, 'Saturday Social Run', 'Fallowfield Loop, Manchester', C(1)],
]

const sessions = []
let sIdx = 0
for (let week = -4; week <= 2; week += 1) {
  for (const [dow, h, m, title, location, chapterId] of SLOTS) {
    sIdx += 1
    sessions.push({
      id: S(sIdx),
      org_id: org,
      chapter_id: chapterId,
      type: 'run',
      title,
      location,
      starts_at: weekdayAt(dow, h, m, week),
      recurring: true,
      capacity: null,
      created_at: daysAgo(400),
    })
  }
}

// A couple of non-run sessions so the Gym/hub screens are not empty either.
sessions.push(
  { id: S(100), org_id: org, chapter_id: C(1), type: 'hub_workshop', title: 'Strength for Runners', location: 'The Gym, Ardwick', starts_at: weekdayAt(2, 18, 30, 0), recurring: false, capacity: 16, created_at: daysAgo(60) },
  { id: S(101), org_id: org, chapter_id: C(1), type: 'hub_training', title: 'Run Leader Training', location: 'The Gym, Ardwick', starts_at: weekdayAt(4, 18, 0, 1), recurring: false, capacity: 12, created_at: daysAgo(30) },
  { id: S(102), org_id: org, chapter_id: C(2), type: 'hub_networking', title: 'Salford Meet & Mile', location: 'Peel Park, Salford', starts_at: weekdayAt(0, 10, 0, 1), recurring: false, capacity: 40, created_at: daysAgo(21) },
)

// ── Attendance ──────────────────────────────────────────────────────────────
// Only for sessions that have already happened — a demo showing attendance at
// a future run would be an obvious tell. Durations vary per runner so the
// pace/leaderboard screens have a real spread to sort.
const PAST = sessions.filter((s) => new Date(s.starts_at) < NOW && s.type === 'run')
const attendance = []
let aIdx = 0
for (const s of PAST) {
  // Deterministic turnout: a stable slice of the roster, varying by session so
  // every runner's history looks different. Math.random() is avoided on
  // purpose — it would reshuffle on every render and make totals flicker.
  const seed = sessions.indexOf(s)
  const turnout = 6 + (seed % 5)
  for (let k = 0; k < turnout; k += 1) {
    const runner = records[(seed * 3 + k * 2) % records.length]
    if (runner.status === 'lapsed' || runner.status === 'new') continue
    aIdx += 1
    attendance.push({
      id: AT(aIdx),
      org_id: org,
      session_id: s.id,
      runner_id: runner.id,
      attended_at: s.starts_at,
      checked_in_by: null,
      duration_seconds: 1500 + ((seed * 37 + k * 53) % 900), // 25:00 – 40:00
    })
  }
}

// ── Volunteers ──────────────────────────────────────────────────────────────
const volunteers = [
  { id: V(1), org_id: org, runner_id: R(1), volunteer_type: 'run_leader', status: 'active', started_at: daysAgo(500) },
  { id: V(2), org_id: org, runner_id: R(8), volunteer_type: 'run_leader', status: 'active', started_at: daysAgo(300) },
  { id: V(3), org_id: org, runner_id: R(5), volunteer_type: 'pacer', status: 'active', started_at: daysAgo(210) },
  { id: V(4), org_id: org, runner_id: R(14), volunteer_type: 'pacer', status: 'active', started_at: daysAgo(150) },
  { id: V(5), org_id: org, runner_id: R(11), volunteer_type: 'ambassador', status: 'active', started_at: daysAgo(120) },
  { id: V(6), org_id: org, runner_id: R(13), volunteer_type: 'media', status: 'paused', started_at: daysAgo(90) },
]

// ── Partners / sponsors ─────────────────────────────────────────────────────
// Invented local businesses. Named so they are plainly illustrative rather
// than implying a real commercial relationship the club does not have.
const accounts = [
  { id: A(1), org_id: org, name: 'Northern Physio Collective', industry: 'healthcare', website: 'https://example.com', status: 'active', notes: 'Injury screening for members, two sessions a month.', created_at: daysAgo(400) },
  { id: A(2), org_id: org, name: 'Ardwick Coffee House', industry: 'hospitality', website: 'https://example.com', status: 'active', notes: 'Post-run coffee discount for members.', created_at: daysAgo(300) },
  { id: A(3), org_id: org, name: 'Pennine Sportswear', industry: 'retail', website: 'https://example.com', status: 'active', notes: 'Kit supplier. Discussing a club range.', created_at: daysAgo(180) },
  { id: A(4), org_id: org, name: 'Manchester Community Trust', industry: 'nonprofit', website: 'https://example.com', status: 'active', notes: 'Grant funder for the outreach programme.', created_at: daysAgo(150) },
]

// record_id matters more than it looks. RecordDetail.jsx renders
// `deals.filter((d) => d.record_id === id)`, so a deal with a null record_id
// appears on NO screen in this build — there is no Partners page any more, the
// runner's record is the only place a deal surfaces. Written as null first
// time round, which left the linked-deals panel dead on all fourteen runners.
//
// Linked to the runners who already show that partner in their PARTNER column,
// so the two facts agree: Idris is the club's contact at the kit supplier,
// Amara at the physios. Two of the four stay unlinked on purpose — a club-level
// grant genuinely belongs to no single member, and a demo where every row is
// populated teaches the viewer nothing about which fields are optional.
const deals = [
  { id: D(1), org_id: org, account_id: A(3), record_id: R(8), title: 'Club kit range 2026', value: 4200, stage: 'in_discussion', stage_changed_at: daysAgo(9), created_at: daysAgo(70) },
  { id: D(2), org_id: org, account_id: A(4), record_id: null, title: 'Outreach grant — beginners programme', value: 7500, stage: 'agreed', stage_changed_at: daysAgo(21), created_at: daysAgo(120) },
  { id: D(3), org_id: org, account_id: A(1), record_id: R(1), title: 'Physio partnership renewal', value: 1800, stage: 'live', stage_changed_at: daysAgo(45), created_at: daysAgo(330) },
  { id: D(4), org_id: org, account_id: A(2), record_id: null, title: 'Saturday coffee sponsorship', value: 900, stage: 'outreach', stage_changed_at: daysAgo(3), created_at: daysAgo(14) },
]

const activities = [
  { id: T(1), org_id: org, kind: 'note', body: 'Checked in after the calf strain — hoping to return in a fortnight.', account_id: null, contact_id: null, record_id: R(4), deal_id: null, occurred_at: daysAgo(5) },
  { id: T(2), org_id: org, kind: 'call', body: 'Called about the two missed bookings. Nothing wrong, just work shifts.', account_id: null, contact_id: null, record_id: R(10), deal_id: null, occurred_at: daysAgo(2) },
  { id: T(3), org_id: org, kind: 'meeting', body: 'Kit range samples reviewed. Waiting on pricing for the quarter-zip.', account_id: A(3), contact_id: null, record_id: null, deal_id: D(1), occurred_at: daysAgo(9) },
  { id: T(4), org_id: org, kind: 'email', body: 'Grant confirmation received. Programme starts next month.', account_id: A(4), contact_id: null, record_id: null, deal_id: D(2), occurred_at: daysAgo(21) },
  { id: T(5), org_id: org, kind: 'note', body: 'Moved to Leeds — offered a transfer to the Leeds parkrun crowd.', account_id: null, contact_id: null, record_id: R(9), deal_id: null, occurred_at: daysAgo(30) },
]

const shopify_orders = [
  { id: O(1), org_id: org, runner_id: R(1), order_number: '#1042', total: 48, items: 'Club tee + cap', ordered_at: daysAgo(6) },
  { id: O(2), org_id: org, runner_id: R(5), order_number: '#1041', total: 32, items: 'Club tee', ordered_at: daysAgo(11) },
  { id: O(3), org_id: org, runner_id: R(8), order_number: '#1039', total: 65, items: 'Quarter-zip', ordered_at: daysAgo(19) },
  { id: O(4), org_id: org, runner_id: R(11), order_number: '#1036', total: 32, items: 'Club tee', ordered_at: daysAgo(27) },
]

// ── Classes, and the one table in this file that is NOT invented ────────────
// /book renders the club's real timetable from hubClasses.js with no database
// call at all, which is why it looked perfect in the demo while /app/classes —
// the staff screen that reads supabase.from('classes') — said "No classes yet".
// Two screens, the same ten classes, and only one of them knew about them.
//
// So this table is DERIVED from HUB_CLASSES rather than written out again.
// Three reasons, in order of how much they matter:
//
//   1. It cannot contradict /book. A prospect who clicks Classes in the admin
//      rail and then opens the public timetable sees the same ten rows at the
//      same times with the same coaches, because there is one list.
//   2. It is real. Every name, time and coach came off the club's own PDF.
//      A demo whose Classes screen shows invented classes teaches a prospect
//      nothing about this club, and it would be the one place in the product
//      where the demo and the live site disagreed.
//   3. `slug` is hub.dbSlug, so the "copy share link" button on that screen
//      produces a URL that actually RESOLVES — ClassPage falls back to
//      hubClassByDbSlug() when there is no database. A seeded slug of my own
//      invention would copy a link to a 404, which is a worse demo than an
//      empty table.
//
// ── What stays null, deliberately ─────────────────────────────────────
// coach_id (no membership rows exist here), location (the PDF names none),
// chapter_id, image_url, video_url, and every rating field. These classes
// carry REAL coaches' first names. Inventing a credential for Jade or a
// 4.6-star average for Nathaniel is not dressing up a demo, it is publishing
// a claim about a named human being in a file that gets emailed to strangers.
// `description` is the one soft field that is filled, via classCopy(), which
// only describes the FORMAT of a session and is already used on the live site.
const classes = HUB_CLASSES.map((hub, i) => ({
  id: CL(i + 1),
  org_id: org,
  slug: hub.dbSlug,
  name: hub.title,
  coach_name: hub.coach || null,
  coach_id: null,
  description: classCopy(hub),
  location: null,
  chapter_id: null,
  // 40 is the club's stated default, and the same number hubClassToPublic()
  // reports on the public card, so the two screens agree on capacity too.
  capacity: 40,
  price_pennies: HUB_PLACEHOLDER_PRICE_PENNIES,
  recurrence_day: hub.day,
  recurrence_time: hub.time,
  female_only: !!hub.femaleOnly,
  is_paused: !!hub.paused,
  pause_note: hub.pauseNote || null,
  video_url: null,
  video_caption: null,
  image_url: null,
  image_focus: null,
  created_at: daysAgo(200 - i),
}))

// Dated occurrences of the above, which is what generate_class_sessions() does
// in Postgres: turn each weekly RULE into eight bookable rows.
//
// Eight ahead and two behind. The two in the past are the reason the number on
// the screen is believable — nextSession() and scheduledCount() both filter to
// the future, so a class with only future rows reads as one that has never
// run, and a club looking at this screen is checking whether it understands
// their timetable, not ours.
//
// Every row is 'scheduled'. The schema also allows 'cancelled', and showing
// that state would demonstrate a real feature — but a cancelled row here says
// "Hot Kettlebells did not happen on the 3rd", which is a statement about a
// real class with a real coach on a real date. The feature can go
// undemonstrated; that sentence cannot be made true from this file.
const class_sessions = []
classes.forEach((cls, ci) => {
  const first = nextOccurrence({ day: cls.recurrence_day, time: cls.recurrence_time }, NOW)
  for (let w = -2; w < 8; w++) {
    const when = new Date(first.getTime() + w * 7 * DAY)
    class_sessions.push({
      id: CS(ci * 100 + (w + 2) + 1),
      org_id: org,
      class_id: cls.id,
      starts_at: when.toISOString(),
      status: 'scheduled',
      created_at: daysAgo(30),
    })
  }
})

// ── The store ───────────────────────────────────────────────────────────────
// Mutable on purpose. A prospect clicking "New Runner" and seeing the row
// appear is worth far more than a read-only tour, and with supabase === null
// the real insert path would throw. Lives in memory only: a refresh restores
// the pristine club, which is the right behaviour for a demo that strangers
// share — nobody can deface it for the next viewer.
const TABLES = {
  records,
  sessions,
  attendance,
  volunteers,
  chapters,
  accounts,
  deals,
  activities,
  shopify_orders,
  classes,
  class_sessions,
}

// ── Embedded resources ──────────────────────────────────────────────────────
// Five screens ask Supabase for a JOIN, not a column list:
//
//   Volunteers.jsx  '*, records(title, email)'
//   Records.jsx     '*, accounts(name)'
//   RecordDetail.jsx'*, accounts(name)'
//   Sessions.jsx    '*, chapters(name)'
//   Gym.jsx         '*, chapters(name)'
//
// PostgREST answers those with a NESTED object keyed by the RELATED TABLE's
// name — `row.records.title`, not `row.runner_id`. Flat fixtures satisfy the
// `*` half completely and still render "—" in every joined column, which is
// how the volunteers table arrived showing six runners with no names.
//
// The map is keyed by table and lists its outgoing foreign keys. Embeds are
// attached unconditionally rather than by parsing the select string: an extra
// key nobody reads costs nothing, whereas a missing one is a visible defect,
// and this way a screen that later adds an embed is already served.
//
// One level deep, deliberately. volunteers → records → accounts would recurse,
// and PostgREST would not return that nesting anyway unless it were asked for.
const EMBEDS = {
  records: [['account_id', 'accounts']],
  volunteers: [['runner_id', 'records']],
  sessions: [['chapter_id', 'chapters']],
  attendance: [
    ['runner_id', 'records'],
    ['session_id', 'sessions'],
  ],
  deals: [
    ['account_id', 'accounts'],
    ['record_id', 'records'],
  ],
  activities: [['record_id', 'records']],
  shopify_orders: [['runner_id', 'records']],
  classes: [['chapter_id', 'chapters']],
}

// ── The OTHER direction ─────────────────────────────────────────────────────
// useManagedClasses asks for '*, chapters(name), class_sessions(id, starts_at,
// status)' — two embeds that look alike in the select string and are opposite
// operations underneath. `chapters` follows chapter_id OUTWARD to one parent
// row. `class_sessions` scans a CHILD table for every row pointing back, and
// returns an ARRAY.
//
// A flag on EMBEDS ("isArray: true") would have hidden that: same map, same
// lookup, one boolean deciding whether to .find() or .filter(). Two maps make
// the two directions impossible to confuse, and the asymmetry is real — a
// missing parent is `null`, a missing child set is `[]`, and nextSession()
// does `(cls.class_sessions || []).filter(...)` precisely because those are
// different kinds of absence.
//
// Keyed: table → [[childTable, fkColumnOnTheChild]].
const CHILD_EMBEDS = {
  classes: [['class_sessions', 'class_id']],
}

// Returns a COPY. The stored row stays flat so that demoUpdate keeps writing
// to plain data, and so an embedded object never gets persisted into the table
// it was derived from.
function withEmbeds(table, row) {
  const spec = EMBEDS[table]
  const children = CHILD_EMBEDS[table]
  if (!row || (!spec && !children)) return row
  const out = { ...row }
  for (const [fk, related] of spec || []) {
    const id = row[fk]
    // null FK → null embed, which is what PostgREST returns and what the
    // screens' `row.accounts?.name` guards already expect.
    out[related] = id ? (TABLES[related] || []).find((r) => r.id === id) || null : null
  }
  for (const [child, fk] of children || []) {
    // Never null. PostgREST returns [] for a parent with no children, and a
    // null here would be the one value `(cls.class_sessions || [])` cannot
    // tell apart from "the embed was never requested".
    out[child] = (TABLES[child] || []).filter((r) => r[fk] === row.id)
  }
  return out
}

export function demoList(table, { order = 'created_at', ascending = false } = {}) {
  const rows = TABLES[table]
  if (!rows) return [] // unknown table → empty, exactly like a real empty table
  const sorted = [...rows].sort((a, b) => {
    const x = a[order]
    const y = b[order]
    if (x === y || x == null || y == null) return 0
    return (x > y ? 1 : -1) * (ascending ? 1 : -1)
  })
  return sorted.map((r) => withEmbeds(table, r))
}

export function demoRow(table, rowId) {
  const row = (TABLES[table] || []).find((r) => r.id === rowId)
  return row ? withEmbeds(table, row) : null
}

// Filtered read, for the one hook that does not go through useData.
//
// useMyRunner asks questions useList cannot express — "the record whose email
// is mine", "my attendance rows", "any run session on this calendar day" — so
// it talks to supabase directly and would need a fake client to work in demo
// mode. This is the smaller alternative: an equality filter plus an optional
// range, which is every operator that hook actually uses.
//
// String comparisons are case-insensitive on purpose. The real query matches
// email with `.ilike`, and a demo that behaved case-sensitively would diverge
// from production in precisely the place where the auth-to-record join lives.
export function demoWhere(table, match = {}, { order, ascending = false, range } = {}) {
  let rows = (TABLES[table] || []).filter((row) =>
    Object.entries(match).every(([k, v]) => {
      if (typeof v === 'string' && typeof row[k] === 'string') {
        return row[k].toLowerCase() === v.toLowerCase()
      }
      return row[k] === v
    }),
  )
  // Half-open [from, to), matching the .gte()/.lt() pair the hook uses to mean
  // "this calendar day" — inclusive at both ends would catch midnight twice.
  if (range) {
    const { column, from, to } = range
    rows = rows.filter((row) => row[column] >= from && row[column] < to)
  }
  if (order) {
    rows = [...rows].sort((a, b) => {
      const x = a[order]
      const y = b[order]
      if (x === y || x == null || y == null) return 0
      return (x > y ? 1 : -1) * (ascending ? 1 : -1)
    })
  }
  return rows.map((r) => withEmbeds(table, r))
}

export function demoInsert(table, values) {
  const rows = TABLES[table]
  if (!rows) return { ...values }
  const row = {
    id: `demo-${table}-${Date.now()}`,
    org_id: org,
    created_at: new Date().toISOString(),
    ...values,
  }
  rows.unshift(row)
  // Embedded too: several screens splice the returned row straight into state
  // instead of refetching, and a row that arrived without its join would show
  // a blank partner column until the next reload.
  return withEmbeds(table, row)
}

export function demoUpdate(table, rowId, values) {
  const rows = TABLES[table]
  if (!rows) return null
  const i = rows.findIndex((r) => r.id === rowId)
  if (i === -1) return null
  rows[i] = { ...rows[i], ...values }
  return withEmbeds(table, rows[i])
}
