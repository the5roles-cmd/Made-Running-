// ============================================================
// ★ THE CUSTOMIZATION SURFACE ★
// The entire domain vocabulary lives here. Screens, the kanban,
// nav, and the SQL `check(...)` enums all read from these arrays.
// To re-skin for a new client you mostly edit THIS file + theme.js
// + one [data-tenant] block in theme.css. See docs/NEW-CLIENT.md.
// ============================================================
import { ACTIVE_TENANT_KEY } from './theme'

// ── Entity labels, per industry ────────────────────────────
// Everything else refers to entities by these labels, so flipping
// VITE_TENANT cascades the rename through the whole UI (nav, kanban,
// page titles) with zero component edits. Add a new client by adding
// a key here that matches its theme.js / theme.css tenant key.
const ENTITY_LABELS = {
  default: {
    account: { singular: 'Account', plural: 'Accounts' },
    contact: { singular: 'Contact', plural: 'Contacts' },
    record: { singular: 'Record', plural: 'Records' },
    deal: { singular: 'Deal', plural: 'Deals' },
  },
  hospital: {
    account: { singular: 'Department', plural: 'Departments' },
    contact: { singular: 'Clinician', plural: 'Clinicians' },
    record: { singular: 'Patient', plural: 'Patients' },
    deal: { singular: 'Referral', plural: 'Referrals' },
  },
  football: {
    account: { singular: 'Sponsor', plural: 'Sponsors' },
    contact: { singular: 'Contact', plural: 'Contacts' },
    record: { singular: 'Member', plural: 'Members' },
    deal: { singular: 'Package', plural: 'Packages' },
  },
  finance: {
    account: { singular: 'Firm', plural: 'Firms' },
    contact: { singular: 'Contact', plural: 'Contacts' },
    record: { singular: 'Client', plural: 'Clients' },
    deal: { singular: 'Mandate', plural: 'Mandates' },
  },
  pharma: {
    account: { singular: 'Provider', plural: 'Providers' },
    contact: { singular: 'Prescriber', plural: 'Prescribers' },
    record: { singular: 'Product', plural: 'Products' },
    deal: { singular: 'Opportunity', plural: 'Opportunities' },
  },
  construction: {
    account: { singular: 'Client', plural: 'Clients' },
    contact: { singular: 'Contact', plural: 'Contacts' },
    record: { singular: 'Project', plural: 'Projects' },
    deal: { singular: 'Bid', plural: 'Bids' },
  },
  accountancy: {
    account: { singular: 'Client', plural: 'Clients' },
    contact: { singular: 'Contact', plural: 'Contacts' },
    record: { singular: 'Engagement', plural: 'Engagements' },
    deal: { singular: 'Proposal', plural: 'Proposals' },
  },
  // Made Running — two audiences, one vocabulary:
  //   record (Module A · Community) → Runner — lifecycle, not sales pipeline.
  //   account (Module B · Business) → Partner — press/brand/wholesale/venue.
  //   deal    (Module B · Business) → Collab  — one pipeline, every agreement type.
  maderunning: {
    account: { singular: 'Partner', plural: 'Partners' },
    contact: { singular: 'Contact', plural: 'Contacts' },
    record: { singular: 'Runner', plural: 'Runners' },
    deal: { singular: 'Collab', plural: 'Collabs' },
  },
}

export const ENTITIES = ENTITY_LABELS[ACTIVE_TENANT_KEY] || ENTITY_LABELS.default

// ── Roles (team members within an org) ─────────────────────
// 'coach' owns classes and sees only their own. It sits BETWEEN admin and
// member: more than a runner, less than the club. Ordered most- to
// least-privileged so any UI rendering this list reads top-down.
//
// Mirrors the CHECK constraint on memberships.role in supabase-classes.sql.
// Add a role here and you must add it there too — the database is the one
// that actually refuses, and a role the UI offers but Postgres rejects
// fails at save time with a constraint error no user can act on.
export const ROLES = ['owner', 'admin', 'coach', 'member', 'viewer']

// ── Record statuses (lifecycle of the primary entity) ──────
// `tone` maps to a .badge--{tone} class in app.css. Per-tenant because
// Made Running's Runner lifecycle (attendance-driven) doesn't map onto
// the generic sales-pipeline-flavoured statuses other tenants use.
const STATUS_SETS = {
  default: [
    { value: 'new', label: 'New', tone: 'info' },
    { value: 'active', label: 'Active', tone: 'accent' },
    { value: 'on_hold', label: 'On hold', tone: 'pending' },
    { value: 'won', label: 'Won', tone: 'confirmed' },
    { value: 'archived', label: 'Archived', tone: 'neutral' },
  ],
  // Runner lifecycle: attendance signal drives status, not a sales stage.
  // `at_risk` = no attendance in 30 days — the re-engagement trigger that
  // the Community dashboard and RecordDetail surface prominently.
  maderunning: [
    { value: 'new', label: 'New', tone: 'info' },
    { value: 'active', label: 'Active', tone: 'accent' },
    { value: 'at_risk', label: 'At risk', tone: 'pending' },
    { value: 'lapsed', label: 'Lapsed', tone: 'cancelled' },
    { value: 'archived', label: 'Archived', tone: 'neutral' },
  ],
}
export const RECORD_STATUSES = STATUS_SETS[ACTIVE_TENANT_KEY] || STATUS_SETS.default

// ── Pipeline stages (the kanban columns) ───────────────────
// Order = left→right column order. Keep in sync with the
// deals.stage check() constraint in supabase-setup.sql. Per-tenant:
// Made Running's Collab pipeline covers every external agreement type
// (press/brand/charity/sponsorship/wholesale/venue/ambassador) on one board.
const STAGE_SETS = {
  default: [
    { value: 'lead', label: 'Lead', tone: 'info' },
    { value: 'qualified', label: 'Qualified', tone: 'info' },
    { value: 'proposal', label: 'Proposal', tone: 'pending' },
    { value: 'negotiation', label: 'Negotiation', tone: 'pending' },
    { value: 'won', label: 'Won', tone: 'confirmed' },
    { value: 'lost', label: 'Lost', tone: 'cancelled' },
  ],
  maderunning: [
    { value: 'outreach', label: 'Outreach', tone: 'info' },
    { value: 'in_discussion', label: 'In discussion', tone: 'info' },
    { value: 'agreed', label: 'Agreed', tone: 'pending' },
    { value: 'live', label: 'Live', tone: 'confirmed' },
    { value: 'archived', label: 'Archived', tone: 'neutral' },
  ],
}
export const PIPELINE_STAGES = STAGE_SETS[ACTIVE_TENANT_KEY] || STAGE_SETS.default

// Stages that count as "closed" (excluded from open-pipeline views/totals).
// Generic tenants close on won/lost; Made Running's Collab pipeline closes
// on live (the agreement is running — success) or archived (ended).
const CLOSED_STAGE_VALUES = {
  default: ['won', 'lost'],
  maderunning: ['live', 'archived'],
}
export const OPEN_STAGES = PIPELINE_STAGES.filter(
  (s) => !(CLOSED_STAGE_VALUES[ACTIVE_TENANT_KEY] || CLOSED_STAGE_VALUES.default).includes(s.value),
)

// ── Activity kinds (timeline) ──────────────────────────────
export const ACTIVITY_KINDS = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'stage_change', label: 'Stage change' },
]

// ── Made Running additive enums (Module A / Module B / Outreach) ──
// Only meaningful when ACTIVE_TENANT_KEY === 'maderunning', but exported
// unconditionally (empty array otherwise) so importing them is always safe.
const isMadeRunning = ACTIVE_TENANT_KEY === 'maderunning'

// Collab `deal_type` — one typed pipeline instead of seven bespoke tables.
// `ambassador_agreement` may optionally reference a runner_id (see
// supabase-setup.sql) — the paid/contracted relationship is tracked here,
// separately from the person's community volunteer role (VOLUNTEER_TYPES).
export const DEAL_TYPES = isMadeRunning
  ? [
      { value: 'press', label: 'Press' },
      { value: 'brand_collab', label: 'Brand collab' },
      { value: 'charity', label: 'Charity' },
      { value: 'sponsorship', label: 'Sponsorship' },
      { value: 'wholesale', label: 'Wholesale' },
      { value: 'venue_vendor', label: 'Venue / vendor' },
      { value: 'ambassador_agreement', label: 'Ambassador agreement' },
    ]
  : []

// `sessions.type` — powers both weekly runs and Hub bookings from one
// table, filtered per screen (Sessions.jsx vs Hub.jsx).
export const SESSION_TYPES = isMadeRunning
  ? [
      { value: 'run', label: 'Run' },
      { value: 'hub_workshop', label: 'Hub workshop' },
      { value: 'hub_training', label: 'Hub training' },
      { value: 'hub_networking', label: 'Hub networking' },
      { value: 'gym_class', label: 'Gym class' },
    ]
  : []
export const HUB_SESSION_TYPES = SESSION_TYPES.filter((t) => t.value.startsWith('hub_'))
// Runs = everything that isn't a hub_* type or a bookable gym class.
export const RUN_SESSION_TYPES = SESSION_TYPES.filter(
  (t) => !t.value.startsWith('hub_') && t.value !== 'gym_class',
)
// Gym classes are the paid, publicly-bookable sessions (see BookGym.jsx +
// supabase-bookings.sql). They carry a price_pennies and are filtered out
// of the run list above so they don't double-appear on Sessions.jsx.
export const GYM_SESSION_TYPES = SESSION_TYPES.filter((t) => t.value === 'gym_class')

// What appears on The Gym's weekly timetable (Gym.jsx).
//
// Deliberately BROADER than GYM_SESSION_TYPES: a member looking at the
// timetable wants everything the gym puts on that week — the paid classes
// AND the workshops, training blocks and networking sessions. Splitting
// those across two screens because one of them happens to carry a
// price_pennies would be an internal billing distinction leaking into a
// member's week view.
//
// It stays narrower than SESSION_TYPES, though: 'run' is excluded, because
// the weekly runs are the club's other half and already have their own home
// (a runner checks into them on My profile, a coach reads the register on
// Attendance). Putting them here would make the same run appear twice, with
// two different check-in paths.
export const GYM_TIMETABLE_TYPES = SESSION_TYPES.filter((t) => t.value !== 'run')

// `volunteers.volunteer_type` — the community role (unpaid or informal),
// distinct from a Collab's `ambassador_agreement` (the paid/contracted deal).
// Ambassador and Hub coach were removed: both were roles the club does not
// actually fill this way. Ambassador overlapped with the Collab pipeline's
// `ambassador_agreement` — a contracted, paid relationship — so offering it
// here invited someone to volunteer for a role that is negotiated, not
// applied for. Hub coach outlived The Hub itself, which is now The Gym and
// staffed by instructors rather than volunteers.
//
// The DATABASE constraint still permits both values
// (volunteers.volunteer_type check in run_leader/pacer/ambassador/hub_coach/
// media), and that is deliberate rather than an oversight: tightening the
// check would reject any historical row already carrying one, and this list
// controls what can be CHOSEN, not what was. See volunteerTypeLabel() below
// for how an old row still renders.
export const VOLUNTEER_TYPES = isMadeRunning
  ? [
      { value: 'run_leader', label: 'Run leader' },
      { value: 'pacer', label: 'Pacer' },
      { value: 'media', label: 'Media' },
    ]
  : []

/**
 * Label for a stored volunteer_type, including retired ones.
 *
 * A row written before Ambassador and Hub coach were removed still holds that
 * value, and looking it up in VOLUNTEER_TYPES now returns undefined. Falling
 * back to the raw value would print "hub_coach" at a member; falling back to
 * blank would make the badge look broken. Neither is what a retired role
 * should look like — it should read as a normal, if unavailable, role.
 */
const RETIRED_VOLUNTEER_LABELS = {
  ambassador: 'Ambassador',
  hub_coach: 'Hub coach',
}

export function volunteerTypeLabel(value) {
  const known = VOLUNTEER_TYPES.find((t) => t.value === value)
  if (known) return known.label
  if (RETIRED_VOLUNTEER_LABELS[value]) return RETIRED_VOLUNTEER_LABELS[value]
  // Last resort for a value from neither list: make it readable rather than
  // leaking the raw enum.
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

// ── Sidebar navigation (grouped) ───────────────────────────
// `icon` = a lucide-react icon NAME (resolved by string in Sidebar).
// `soon:true` renders a disabled "soon" item.
// Icon convention (applies everywhere, every tenant): one set, lucide-react
// only. `Bot` = every AI touchpoint, `Zap` = every automation event.
// No star/sparkle glyphs.
const NAV_GROUPS_DEFAULT = [
  {
    label: 'Workspace',
    items: [
      { to: '/app', label: 'Dashboard', icon: 'LayoutDashboard', end: true },
      { to: '/app/accounts', label: ENTITIES.account.plural, icon: 'Building2' },
      { to: '/app/contacts', label: ENTITIES.contact.plural, icon: 'Users' },
      { to: '/app/records', label: ENTITIES.record.plural, icon: 'FolderKanban' },
      { to: '/app/pipeline', label: 'Pipeline', icon: 'Kanban' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/app/assistant', label: 'Assistant', icon: 'Bot' },
      { to: '/app/academy', label: 'Academy', icon: 'GraduationCap' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/app/style', label: 'Style guide', icon: 'Palette' },
      { to: '/app/settings', label: 'Settings', icon: 'Settings' },
    ],
  },
]

// Made Running — two top-level modules mirroring the two audiences
// (community/lifecycle vs. business/partnerships), plus a bounded,
// privacy-separated Outreach group. Routes are registered by their
// owning Phase-1 worker; listing them here ahead of that is fine.
const NAV_GROUPS_MADERUNNING = [
  {
    // Renamed from "Community" when the Community feed item was added —
    // same fix as Store/Shop below. A group and a child sharing a name
    // reads as a stutter in the rail and makes the child impossible to
    // refer to unambiguously in conversation.
    label: 'Club',
    items: [
      // The index route is the member's OWN profile — see App.jsx.
      { to: '/app', label: 'My profile', icon: 'CircleUser', end: true },
      // A member's own numbers: distance, finish times, week/month/year
      // comparisons. Sits directly under My profile because it answers the
      // follow-up question that screen provokes — "so am I actually getting
      // anywhere?" — and it is the member's half of what Attendance shows a
      // coach about the whole club.
      { to: '/app/my-runs', label: 'My runs', icon: 'Footprints' },
      // No "Club dashboard" tab, and no "Attendance" tab either — both
      // deleted, in that order, and for the same reason. Each was a REPORT:
      // a headcount, an at-risk count, a six-week bar, a distance total.
      // Reports are what you build when you can't see the work; this app
      // shows the work directly, so they were a second, staler answer to
      // questions the working screens already answer live.
      //
      // No "Runners" tab either, same reasoning. A raw table of everybody
      // was a database view wearing a nav item, and it is the screen a
      // member should least be one click from. The /app/records and
      // /app/records/:id routes remain — Community and the session register
      // link into individual runners.
      // No "Sessions" tab. The three weekly runs are a fixed property of the
      // club (schedule.js), and every audience now meets them where they
      // actually matter: a runner checks into them on My profile, a coach
      // reads the register on Attendance. A separate list of the same three
      // rows was a third answer to a question nobody was asking.
      //
      // The /app/sessions ROUTE still exists and still works — SessionDetail
      // links back to it, and the Hub links into it. Only the rail entry is
      // gone. Deleting the route as well would break those two links.
      //
      // Distinct from the runs on purpose: a Social Event is everything else
      // the club puts on — socials, talks, race trips. Merging the two would
      // corrupt the attendance signal the whole Runner lifecycle reads from.
      { to: '/app/events', label: 'Social Events', icon: 'CalendarHeart' },
      // Was "The Hub". Renamed because "Hub" named the ROOM and left the
      // member to guess what happened in it; "The Gym" names what they get.
      // The route moved with it (/app/hub still redirects — SessionDetail
      // and older bookmarks point there).
      { to: '/app/gym', label: 'The Gym', icon: 'Dumbbell' },
      // ── Class booking · flow-chart Step 1a ──────────────────────────
      // `manage: true` is a THIRD visibility state, and it had to be added
      // because this rail only knew two: everyone, or staff.
      //
      // A coach is neither. They must see this item (it is their whole job
      // in the app) and must NOT see the staff group. Marking it `staff`
      // would hide it from the coaches who need it; leaving it unmarked
      // would offer every runner a class-admin screen that bounces them
      // straight back out. See navFor() below.
      //
      // Sits directly under The Gym on purpose: The Gym is where a member
      // reads the timetable, this is where the coach fills it.
      { to: '/app/classes', label: 'Classes', icon: 'CalendarCheck', manage: true },
      // The members' feed — shout-outs, milestones, notices. Deliberately
      // NOT named after the group it sits in; see the group label note above.
      { to: '/app/community', label: 'Community', icon: 'MessagesSquare' },
      // No "Attendance" tab. The club-wide register and its week/month/year
      // analysis are gone from the rail with the Club dashboard; the data
      // itself is not. Every check-in still lives in the `attendance` table
      // and is still read in three places that matter more than a report
      // did: a runner checks in on My profile, reads their own distance and
      // times on My runs, and a coach reads one session's register on that
      // session's own page. The number was never the point — the check-in is.
      // NOT staff-only, unlike Community above. Volunteers is the one
      // screen that is genuinely two screens: a runner opens it to apply for
      // a role, a coach opens it to approve those applications and read the
      // roster. Hiding it from members would remove the only way into the
      // club's volunteer pipeline — see the role split in Volunteers.jsx.
      { to: '/app/volunteers', label: 'Volunteers', icon: 'HeartHandshake' },
      // Referral invites. Lives here because growth comes from members
      // bringing members, and this is where the members are.
      //
      // "Invite", not "Add": the member cannot actually add anyone. The page
      // opens their own mail/SMS/WhatsApp app with a message they choose to
      // send, and nothing lands in the club's database until the friend signs
      // up themselves. A label promising more than the button delivers is the
      // kind of small lie that costs trust on the very first click.
      { to: '/app/add-friend', label: 'Invite a friend', icon: 'UserPlus' },
    ],
  },
  // ── What is NOT here any more, and why ──────────────────────────────
  //
  // Deleted outright: the Business group (Dashboard, Partners, Collabs,
  // Chapters), the Outreach group, Sales, Assistant and the Style guide.
  //
  // Every one of them was a screen for running the club as a BUSINESS —
  // sponsorship pipelines, partner records, revenue, an internal design
  // reference. The app this became is the one a runner opens: check in,
  // see your distance, book a class, buy the kit, volunteer, bring a
  // friend. Those two products were sharing a sidebar, and the business
  // half was the louder one — a member's seven screens sat above twelve
  // they could never use, and a coach's first impression was a CRM.
  //
  // The DATA is untouched. `accounts`, `deals`, `chapters`,
  // `outreach_programs` and their RLS policies all still exist in Supabase
  // exactly as they were, so any of these screens can come back as a file
  // and a route without a migration. This is a deletion of surface, not of
  // records — see the catch-all in App.jsx for how the old URLs behave.
  //
  // The AI did NOT go with the Assistant page: "Ask Made Running" in the
  // topbar opens the slide-over (ChatPanel), which was always the way in
  // that people actually used.
  // The "Store" group is back, but its one item is `soon: true` — the club
  // asked for the Shop button to be visible again while the shop stays
  // disabled (Oct 2026). The Sidebar renders `soon` items as aria-disabled
  // placeholders with no link, which matters here because the /app/shop
  // route is still gone: a live link would land on the /app catch-all.
  // When the shop reopens, drop the flag (and restore the route in App.jsx).
  {
    label: 'Store',
    items: [{ to: '/app/shop', label: 'Shop', icon: 'ShoppingBag', soon: true }],
  },
  {
    label: 'Intelligence',
    items: [{ to: '/app/academy', label: 'Academy', icon: 'GraduationCap' }],
  },
  {
    label: 'System',
    items: [{ to: '/app/settings', label: 'Settings', icon: 'Settings' }],
  },
]

export const NAV_GROUPS = isMadeRunning ? NAV_GROUPS_MADERUNNING : NAV_GROUPS_DEFAULT

// ── Who sees what ───────────────────────────────────────────────────────────
// A member and a coach are using two different products that happen to share
// a database. `staff: true` on an item (or a whole group) means "this answers
// a question about the CLUB", and a runner signing in should not see it.
//
// ⚠️ This is navigation, NOT security. Hiding a link does not make its route
// unreachable — anyone can type /app/records — and it does not stop a query.
// The actual boundary is RLS in Supabase, which scopes every row to the
// caller's org. If a table genuinely must be invisible to members rather than
// merely un-navigable, that has to be a policy on the table, not a flag here.
const STAFF_ROLES = ['owner', 'admin']

export const isStaffRole = (role) => STAFF_ROLES.includes(role)

// 'coach' is deliberately NOT in STAFF_ROLES, and that is the single most
// important line in this file for the booking system.
//
// It is tempting to treat a coach as staff — they run the classes, they take
// payment, they feel senior. But STAFF_ROLES is what opens /app/records (the
// club's entire people list), /app/sessions, and the rest of the club-wide
// surface. Your spec says a coach sees ONLY their own classes. Adding 'coach'
// here would hand every coach the whole club in one character, and nothing
// would visibly break to warn anyone.
//
// So a coach gets its own predicate and its own dashboard, and reaches
// exactly one screen that staff also reach: nothing.
export const isCoachRole = (role) => role === 'coach'

// Anyone who runs a class from the inside: coaches plus club staff. Use this
// for "can this person take payment / add a walk-in / cancel a session"
// (decision: BOTH coach and admin), never for "can this person see the club".
export const canManageClasses = (role) => isStaffRole(role) || isCoachRole(role)

// Filter the rail for a role. Groups that end up empty are dropped entirely,
// so a member never sees a lone "System" heading with nothing beneath it.
export function navFor(role) {
  if (isStaffRole(role)) return NAV_GROUPS

  // A coach sits between a member and staff, so the filter needs three
  // outcomes rather than two:
  //   i.staff  → club-wide screens. Staff only; a coach does NOT get these.
  //   i.manage → "I run a class". Coaches AND staff.
  //   neither  → everyone.
  //
  // Written as a positive allow-list (`!i.manage || canManage`) rather than
  // a chain of role checks, so adding a fourth audience later means one flag
  // and one clause, not rewriting this function.
  const canManage = canManageClasses(role)

  return NAV_GROUPS.filter((g) => !g.staff)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.staff && (!i.manage || canManage)),
    }))
    .filter((g) => g.items.length > 0)
}

// Convenience lookups ---------------------------------------
export const stageMeta = (v) => PIPELINE_STAGES.find((s) => s.value === v) || PIPELINE_STAGES[0]
export const statusMeta = (v) => RECORD_STATUSES.find((s) => s.value === v) || RECORD_STATUSES[0]
export const dealTypeMeta = (v) => DEAL_TYPES.find((t) => t.value === v)
