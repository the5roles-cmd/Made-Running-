// ── SOCIAL EVENTS STUB ────────────────────────────────────────────────────
// Social Events are everything the club puts on OUTSIDE the weekly group run.
// They are NOT Sessions. Sessions are the structured weekly runs that track
// attendance and reset a Runner's at_risk clock — those live in the `sessions`
// table. Social Events are socials, brand launches, talks, race trips, charity
// nights, film nights, Christmas do, etc.
//
// >>> SWAP POINT: when a `social_events` table exists in Supabase, replace the
// body of fetchSocialEvents with:
//
//   import { supabase } from './supabase'
//   export async function fetchSocialEvents(orgId) {
//     if (!orgId) return []
//     const { data, error } = await supabase
//       .from('social_events')
//       .select('*')
//       .eq('org_id', orgId)
//       .order('date', { ascending: true })
//     if (error) return []
//     return data || []
//   }
//
// Keep the same shape: array of the objects defined in SEED_EVENTS below.
// ─────────────────────────────────────────────────────────────────────────

// All dates are computed at module-load time relative to today so the demo
// never silently shows "no upcoming events" on a different day.
function daysFromNow(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

// Event type vocabulary — label + a CSS-safe key for colour-coding.
export const EVENT_TYPES = [
  { value: 'social',    label: 'Social',      color: '#12857a' }, // teal
  { value: 'talk',      label: 'Talk',         color: '#3d6377' }, // slate-blue
  { value: 'race_trip', label: 'Race Trip',    color: '#9a7b1f' }, // amber
  { value: 'charity',   label: 'Charity',      color: '#2f7d4f' }, // green
  { value: 'brand',     label: 'Brand',        color: '#1c1c1c' }, // ink
  { value: 'workshop',  label: 'Workshop',     color: '#6a4bc4' }, // violet
]

export function typeForValue(v) {
  return EVENT_TYPES.find((t) => t.value === v) || EVENT_TYPES[0]
}

// ── Seed data (demo only — see SWAP POINT above) ─────────────────────────
// ~2–3 past events for calendar history, then ~10 upcoming spread across
// the next 10 weeks.
const SEED_EVENTS = [
  // ── Past events (visible history) ────────────────────────────────────
  {
    id: 'evt-001',
    title: 'Salford Chapter Launch Social',
    type: 'social',
    date: daysFromNow(-18),
    startTime: '19:00',
    endTime: '22:00',
    chapter: 'Salford',
    location: 'The Eagle Inn, Salford',
    description:
      'Celebrating the official launch of our Salford chapter. Drinks, stories, and welcoming new faces to the crew. No one gets left behind.',
    capacity: 60,
    going: 54,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-002',
    title: 'Mental Health & Running — Panel Talk',
    type: 'talk',
    date: daysFromNow(-9),
    startTime: '18:30',
    endTime: '20:30',
    chapter: 'Manchester City Centre',
    location: "Hall\u00e9 St. Peter's, Manchester",
    description:
      'Runners, coaches, and an Andy\'s Man Club facilitator discuss how consistent movement changes the mental health game. Q&A included.',
    capacity: 80,
    going: 72,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-003',
    title: 'boohooMAN Kit Drop Preview',
    type: 'brand',
    date: daysFromNow(-3),
    startTime: '17:00',
    endTime: '19:30',
    chapter: 'Manchester City Centre',
    location: 'Northern Quarter, Manchester',
    description:
      'Exclusive first look at the Made Running × boohooMAN capsule collection. Community members only — limited places.',
    capacity: 40,
    going: 40,
    isFree: true,
    price: null,
  },

  // ── Upcoming events ───────────────────────────────────────────────────
  {
    id: 'evt-004',
    title: 'Post-Run Friday Social — NQ',
    type: 'social',
    date: daysFromNow(3),
    startTime: '19:30',
    endTime: '22:30',
    chapter: 'Manchester City Centre',
    location: 'Common Bar, Northern Quarter',
    description:
      'After the Friday evening run, pull up for a pint (or a pint of water — we don\'t judge). Open to all runners and friends of the crew.',
    capacity: null,
    going: 38,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-005',
    title: 'Fundraiser 5K — Andy\'s Man Club',
    type: 'charity',
    date: daysFromNow(7),
    startTime: '09:00',
    endTime: '11:30',
    chapter: 'Manchester City Centre',
    location: 'Heaton Park, Manchester',
    description:
      'A fundraising 5K in aid of Andy\'s Man Club. Bring mates, wear your kit, and help us hit our target of £2,500. Every pace welcome.',
    capacity: 120,
    going: 87,
    isFree: false,
    price: 5,
  },
  {
    id: 'evt-006',
    title: 'Manchester Half Race Trip',
    type: 'race_trip',
    date: daysFromNow(14),
    startTime: '07:00',
    endTime: '14:00',
    chapter: 'All Chapters',
    location: 'Deansgate, Manchester (start line)',
    description:
      'We\'re taking a crew to the Manchester Half. Meet at Deansgate at 7am for a warm-up jog to the start village together. All finish times welcome.',
    capacity: 50,
    going: 31,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-007',
    title: 'Run Recovery Workshop',
    type: 'workshop',
    date: daysFromNow(17),
    startTime: '10:00',
    endTime: '12:00',
    chapter: 'Manchester City Centre',
    location: 'Barry\'s Bootcamp Manchester',
    description:
      'A hands-on workshop with our coaches: mobility, foam rolling, cold exposure, and nutrition basics for running recovery. In partnership with Barry\'s.',
    capacity: 30,
    going: 22,
    isFree: false,
    price: 10,
  },
  {
    id: 'evt-008',
    title: 'Balenciaga x Made Running — Film Night',
    type: 'brand',
    date: daysFromNow(21),
    startTime: '19:00',
    endTime: '21:30',
    chapter: 'Manchester City Centre',
    location: 'HOME Manchester',
    description:
      'An exclusive screening of the Balenciaga x Made Running short film, followed by a Q&A with Hermen and the creative team behind the collab.',
    capacity: 100,
    going: 64,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-009',
    title: 'Salford Chapter 1st Birthday',
    type: 'social',
    date: daysFromNow(28),
    startTime: '18:00',
    endTime: '22:00',
    chapter: 'Salford',
    location: 'The Crescent, Salford',
    description:
      'One year of Salford running strong. Come celebrate with the chapter that proved No One Gets Left Behind isn\'t just a motto — it\'s a practice.',
    capacity: 80,
    going: 41,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-010',
    title: 'Running & Mental Health Talk — HMP Manchester Partnership',
    type: 'talk',
    date: daysFromNow(35),
    startTime: '14:00',
    endTime: '16:00',
    chapter: 'Manchester City Centre',
    location: 'Manchester Central Library',
    description:
      'Hermen Dange speaks about Made Running\'s partnership with HMP Manchester: how community running is used as a rehabilitation and reintegration tool.',
    capacity: 150,
    going: 89,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-011',
    title: 'Couch-to-5K Graduation Social',
    type: 'social',
    date: daysFromNow(42),
    startTime: '19:00',
    endTime: '21:30',
    chapter: 'All Chapters',
    location: 'Elnecot, Cutting Room Square, Manchester',
    description:
      'This season\'s Couch-to-5K cohort cross the finish line together. A proper celebration for everyone who showed up, week after week.',
    capacity: 70,
    going: 28,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-012',
    title: 'Parkrun Takeover — Heaton Park',
    type: 'race_trip',
    date: daysFromNow(49),
    startTime: '08:30',
    endTime: '10:30',
    chapter: 'All Chapters',
    location: 'Heaton Park Parkrun, Manchester',
    description:
      'Made Running takes over Heaton Park parkrun. Show up in your kit, run your pace, and let the city see the crew in force.',
    capacity: null,
    going: 47,
    isFree: true,
    price: null,
  },
  {
    id: 'evt-013',
    title: 'Run Leaders & Coaches Workshop',
    type: 'workshop',
    date: daysFromNow(56),
    startTime: '09:00',
    endTime: '13:00',
    chapter: 'Manchester City Centre',
    location: 'Sports City, Manchester',
    description:
      'Invite-only professional development day for chapter run leaders, coaches, and pacers. Route safety, pacing strategies, and community care.',
    capacity: 25,
    going: 18,
    isFree: true,
    price: null,
  },
]

// Async-shaped accessor — keeps the same promise API for when the
// SWAP POINT above is replaced with a real Supabase call.
export async function fetchSocialEvents() {
  return SEED_EVENTS
}

// Helper: get events for a given calendar month.
export function eventsForMonth(events, year, month) {
  return events.filter((e) => {
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
}

// Helper: get events for a specific calendar day.
export function eventsForDay(events, year, month, day) {
  return events.filter((e) => {
    const d = new Date(e.date)
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    )
  })
}
