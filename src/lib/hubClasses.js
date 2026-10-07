// MADE Hub Classes — the club's real weekly timetable.
//
// Source: "MADE Hub Classes" (club PDF). Every class, time, coach and
// restriction below is transcribed from it. Nothing here is invented — if a
// class is not on the PDF it is not in this file, and if the PDF says "female
// only" that flag is set.
//
// ── Why a RECURRING RULE and not a list of dated sessions ────────────
// BookGym.jsx originally read `starts_at`: a single timestamp, i.e. a one-off
// event on a specific date. The Hub timetable is not that shape. "Monday
// 9.30am" is a rule that repeats every week with no end date.
//
// Seeding dated rows to match the old shape would look correct today and be
// an empty page in a month, the moment the seeded dates ran out. Storing the
// rule and computing the next occurrence at render time is correct every week
// forever, with zero maintenance.
//
// It also means the timetable renders with NO database call, which is what
// lets a signed-out guest see it instantly — and is why the page still works
// while supabase-bookings.sql remains unrun.

// Day indices match JavaScript's Date.getDay(): 0 = Sunday … 6 = Saturday.
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Display order starts at Monday, because the club's week does. Sunday is
// index 0 in JS but belongs at the END of a timetable a human reads.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * The timetable.
 *
 * `time` is 24-hour "HH:MM" — the single source of truth for sorting. The
 * PDF's "7.30 pm" and "9.30am" are human formats; storing them as written
 * would mean string-sorting "7.30pm" before "9.30am", putting the evening
 * class first. Parse once, format for display later.
 *
 * `femaleOnly` is a real access restriction from the PDF, not a category.
 * `paused` marks a class the PDF flags as not currently running.
 *
 * ── `dbSlug`: the join key to the database row (Section 3c) ──────────
 * This file renders /book with no database. The coach bio, video and rating
 * on each card come from public_classes() when the SQL has been run, so the
 * two halves have to be matched up, and `id` cannot do it — these ids were
 * written for this file ('mon-0930-hot-kettlebells') and the database
 * generates its own ('hot-kettlebells-mon-0930').
 *
 * It is WRITTEN DOWN rather than computed, and that is the opposite of the
 * choice made for the coach bios below. Computing it from the title is very
 * nearly right — `slugify(title) + '-mon-0930'` reproduces 11 of the 12
 * seeded slugs — and it is wrong anyway:
 *
 *   • It already fails on one. The seed's Sunday class is
 *     'propain-hiit-sun-1200' while its name is 'The Propain HIIT Class',
 *     which slugifies to 'the-propain-hiit-class-sun-1200'. A club shortens
 *     a slug by hand once and the convention is broken.
 *   • More importantly, a derived slug is a function of the NAME, and names
 *     are dynamic. updateClass() in classes.js deliberately never writes
 *     `slug` so that renaming a class cannot break a link already pasted
 *     into a group chat. So the day the club renames a class, every derived
 *     key stops matching and the coach panels quietly go empty — the exact
 *     rename failure this codebase is built to avoid.
 *
 * A slug is the one thing here that IS safe to duplicate, precisely because
 * nothing is permitted to change it. Copy a name and it drifts; copy an
 * immutable key and it cannot.
 */
export const HUB_CLASSES = [
  // ── Monday ──────────────────────────────────────────────────────
  {
    id: 'mon-0930-hot-kettlebells',
    dbSlug: 'hot-kettlebells-mon-0930',
    day: 1,
    time: '09:30',
    title: 'Hot Kettlebells',
    coach: 'Jade',
    discipline: 'kettlebells',
    femaleOnly: true,
  },
  {
    id: 'mon-1930-hot-kettlebells',
    dbSlug: 'hot-kettlebells-mon-1930',
    day: 1,
    time: '19:30',
    title: 'Hot Kettlebells',
    coach: 'Micah',
    discipline: 'kettlebells',
  },

  // ── Tuesday ─────────────────────────────────────────────────────
  {
    id: 'tue-0500-hiit',
    dbSlug: 'hiit-tue-0500',
    day: 2,
    time: '05:00',
    title: 'HIIT',
    coach: 'Hermen',
    discipline: 'hiit',
    // PDF: "(starting back next week)". Shown on the timetable but not
    // bookable — hiding it would make members think it was cancelled.
    paused: true,
    pausedNote: 'Starting back next week',
  },
  {
    id: 'tue-1830-catch-a-circuit',
    dbSlug: 'catch-a-circuit-tue-1830',
    day: 2,
    time: '18:30',
    title: 'CaTcH a Circuit',
    coach: 'Jade',
    discipline: 'circuit',
  },

  // ── Wednesday ───────────────────────────────────────────────────
  {
    id: 'wed-1845-the-valley',
    dbSlug: 'the-valley-wed-1845',
    day: 3,
    time: '18:45',
    title: 'The Valley',
    subtitle: 'Hot kettlebells',
    coach: 'K3 & Marvin',
    discipline: 'kettlebells',
  },

  // ── Thursday ────────────────────────────────────────────────────
  {
    id: 'thu-1830-dog-business-hiit',
    dbSlug: 'dog-business-hiit-thu-1830',
    day: 4,
    time: '18:30',
    title: 'Dog Business HIIT',
    // The PDF names no coach for this one. Left null deliberately rather
    // than guessed — the UI omits the "with …" line when coach is absent.
    coach: null,
    discipline: 'hiit',
  },
  {
    id: 'thu-1900-yoga',
    dbSlug: 'yoga-thu-1900',
    day: 4,
    time: '19:00',
    title: 'Yoga',
    coach: 'Brittany',
    discipline: 'yoga',
  },

  // ── Friday ──────────────────────────────────────────────────────
  {
    id: 'fri-0930-kettlebells',
    dbSlug: 'kettlebells-fri-0930',
    day: 5,
    time: '09:30',
    title: 'Kettlebells',
    coach: 'Daria',
    discipline: 'kettlebells',
    femaleOnly: true,
  },
  {
    id: 'fri-1045-the-valley',
    dbSlug: 'the-valley-fri-1045',
    day: 5,
    time: '10:45',
    title: 'The Valley',
    subtitle: 'Hot kettlebells',
    coach: 'K3 & Marvin',
    discipline: 'kettlebells',
  },

  // ── Saturday ────────────────────────────────────────────────────
  {
    id: 'sat-0800-hustle-hard',
    dbSlug: 'hustle-hard-sat-0800',
    day: 6,
    time: '08:00',
    title: 'Hustle Hard',
    coach: 'Malachi',
    discipline: 'hiit',
  },
  {
    id: 'sat-1930-hot-kettlebells',
    dbSlug: 'hot-kettlebells-sat-1930',
    day: 6,
    time: '19:30',
    title: 'Hot Kettlebells',
    coach: 'Micah',
    discipline: 'kettlebells',
  },

  // ── Sunday ──────────────────────────────────────────────────────
  {
    id: 'sun-1200-propain-hiit',
    // The one the convention does NOT reach: the seed shortened this slug by
    // hand. See the note above the array.
    dbSlug: 'propain-hiit-sun-1200',
    day: 0,
    time: '12:00',
    title: 'The Propain HIIT Class',
    coach: 'Nathaniel',
    discipline: 'hiit',
  },
]

// The closing line from the PDF, kept here so the page and the source stay
// in sync if the club changes it.
export const HUB_FOOTNOTE =
  'Join the group chats in the community and book your spaces. Everyone welcome.'

// ── Class price ──────────────────────────────────────────────────────
// £10.00 flat, given by the club. This was previously an invented £6.00
// placeholder; it is now a real figure, so the old "errs high, gets
// corrected at the door" hedge no longer applies.
//
// It still lives here rather than in the schema's defaults because
// classes.price_pennies DEFAULTS TO 0 and fmtPrice() renders 0 as "Free" —
// so until the SQL is run with real values, anything that falls through to
// the database would advertise twelve free classes. This constant is what
// stands between that default and the booking page.
//
// ONE shared number rather than twelve per-class ones, because the club
// charges one rate. If that ever stops being true the per-class figures
// belong in the database, not here.
//
// The DATABASE WINS wherever it has an opinion. Every read site uses
// `db?.price_pennies ?? HUB_PLACEHOLDER_PRICE_PENNIES`, so the moment the
// club sets prices in the Classes editor this constant stops being
// reached, and it is deleted with the rest of this file at cutover.
export const HUB_PLACEHOLDER_PRICE_PENNIES = 1000

// ── Class card artwork, keyed by DISCIPLINE ──────────────────────────
// The photo band across the top of each card on /book.
//
// Keyed by discipline, not by class, and that is a deliberate reduction of the
// club's workload rather than a shortcut in the code: the twelve classes on
// this timetable use only FOUR disciplines (six kettlebells, four hiit, one
// yoga, one circuit). Keying by class means twelve Canva exports and twelve
// more every time the timetable changes. Keying by discipline means four, and
// a new Monday kettlebells class inherits artwork on the day it is added
// without anybody opening Canva at all.
//
// A per-class override still exists and still wins — classes.image_url in the
// database, set in the Classes editor. This map is the floor, not the ceiling.
//
// ── Why import.meta.glob and not a literal '/img/class-hiit.webp' ────
// These files do not exist yet; the club is making them. A hardcoded path to
// a file that is not there is not a blank space, it is twelve failed network
// requests and twelve broken-image icons, and the failure happens in the
// member's browser where nobody on our side sees it.
//
// import.meta.glob resolves at BUILD time, so this object contains exactly the
// files that are actually present in the folder. No file, no key, no band, no
// request — the card renders as it does today. Drop an export in and it
// appears on the next build. The impossible state (a path with no file behind
// it) cannot be represented.
//
// It also gets Vite's asset pipeline for free: content-hashed filenames, so a
// replaced image is never served from a stale cache — which matters here,
// because "I uploaded the new one and it still shows the old one" is the
// single most likely support question about this feature.
const BAND_FILES = import.meta.glob(
  '../assets/classes/*.{webp,jpg,jpeg,png,avif}',
  { eager: true, query: '?url', import: 'default' },
)

/**
 * { kettlebells: '/assets/class-kettlebells-a1b2c3.webp', ... }
 *
 * The filename before the extension IS the discipline key, so adding artwork
 * for a discipline is renaming a file — no code change, no list to keep in
 * sync with the timetable above. Unknown names are harmless: a stray
 * 'class-notes.png' in the folder becomes a key nothing looks up.
 */
export const DISCIPLINE_IMAGE = Object.fromEntries(
  Object.entries(BAND_FILES).map(([path, url]) => [
    path.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase(),
    url,
  ]),
)

// ── Class films, keyed by DISCIPLINE ─────────────────────────────────
// A short clip of the session, shown inside the description on the class page.
// Same keying rule and same drop-a-file-in contract as the artwork above.
//
// ── Why a SEPARATE FOLDER from the card artwork ──────────────────────
// Because a film needs two files — the video and its poster frame — and the
// poster is an image. Put yoga.mp4 and yoga-poster.webp in assets/classes/ and
// the artwork glob picks the poster up too, inventing a discipline called
// 'yoga-poster' that nothing renders and quietly doubling the artwork folder's
// file count for every film added. Two folders keeps one rule per folder:
// in assets/classes/ the filename is the discipline, in here it is too, and
// yoga.mp4 + yoga.webp are a matched pair under one key.
//
// ── Why this is NOT classes.video_url ────────────────────────────────
// video_url is the club pasting a YouTube or Vimeo link, which is untrusted
// input: it goes through videoEmbed()'s host allowlist and ends up as an
// <iframe src> rebuilt from a validated id. A file in this repo is the exact
// opposite — we control the bytes, there is no third party to frame, and it
// renders as a native <video> with no iframe, no external request and nobody
// else's tracking on a page where a member is deciding whether to pay.
//
// Both can exist for one class. video_url WINS, for the same reason
// classes.image_url beats DISCIPLINE_IMAGE: a per-class thing the club chose
// beats a per-discipline default we supplied. See ClassPage.
const FILM_FILES = import.meta.glob(
  '../assets/class-films/*.{mp4,webm}',
  { eager: true, query: '?url', import: 'default' },
)
const FILM_POSTERS = import.meta.glob(
  '../assets/class-films/*.{webp,jpg,jpeg,png,avif}',
  { eager: true, query: '?url', import: 'default' },
)

const disciplineKey = (path) =>
  path.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase()

/**
 * { yoga: { src: '/assets/yoga-a1b2c3.mp4', poster: '/assets/yoga-d4e5f6.webp' } }
 *
 * `poster` is `null` when no still sits beside the film, and that is a real
 * state rather than an oversight: without one the browser shows a black
 * rectangle until the first frame decodes, so the UI draws its own placeholder
 * instead of an empty void. Never a guess — a poster pulled from the wrong
 * footage is worse than none, because it promises a room the film does not
 * show. (The club's Yoga still and Yoga film are two different rooms, which is
 * exactly how that trap was found.)
 */
export const DISCIPLINE_FILM = Object.fromEntries(
  Object.entries(FILM_FILES).map(([path, src]) => {
    const key = disciplineKey(path)
    const posterEntry = Object.entries(FILM_POSTERS).find(
      ([p]) => disciplineKey(p) === key,
    )
    return [key, { src, poster: posterEntry ? posterEntry[1] : null }]
  }),
)

// ── Placeholder class descriptions ───────────────────────────────────
// PLACEHOLDER COPY. Nobody at the club wrote these — I did, so that the class
// pages have something to show before the club fills in the real thing.
//
// Keyed by discipline for the same reason the artwork is: four pieces of copy
// cover twelve classes, and a new kettlebells class inherits one on the day it
// is added.
//
// ── The line these deliberately do not cross ──────────────────────
// Every sentence describes the FORMAT of the session — what a kettlebell class
// is, what intervals are, what to bring. Not one makes a claim about Made
// Running specifically: no promises about results, no numbers, no "our
// award-winning coaches", nothing about the room, nothing a member could turn
// up and find untrue. That is the whole test applied while writing them.
//
// The reason is not fastidiousness. This copy sits on a page where somebody
// decides to hand over money, which makes an invented claim a consumer-facing
// one. Generic-but-true costs the club nothing if it ships as-is; specific-
// but-invented is a liability the club never agreed to. Where a real claim
// would obviously help — "suitable for complete beginners" — it is left out,
// because whether that is true is the coach's call and not mine.
//
// THE DATABASE WINS. Every read site uses `db?.description || DISCIPLINE_COPY
// [discipline]`, so the moment a coach types a description in the Classes
// editor this stops being reached for that class. No migration, no cleanup.
export const DISCIPLINE_COPY = {
  kettlebells:
    'A strength and conditioning class built around the kettlebell. Expect ' +
    'swings, squats, presses and carries, put together in rounds with rest ' +
    'between them, so you work hard in short bursts rather than flat out for ' +
    'the whole hour. Weights are chosen per person, so the same session works ' +
    'whether it is your first one or your fiftieth. Bring water and trainers ' +
    'you can lift in.',
  hiit:
    'High-intensity interval training: short, hard efforts with short ' +
    'recoveries, repeated. Mostly bodyweight and simple kit, so there is ' +
    'nothing technical to learn before you start — the intensity is set by how ' +
    'hard you push in each interval, which means everyone in the room works at ' +
    'their own level from the same clock. Bring water and a towel.',
  yoga:
    'A movement and mobility class — a slower session built around holding ' +
    'positions, breathing and working through a full range of motion. It ' +
    'suits a rest day or the day after something heavy. Mats are the only ' +
    'kit you need; wear something you can stretch in.',
  circuit:
    'A circuit class: a set of stations you rotate through on a timer, mixing ' +
    'strength, conditioning and bodyweight work. Because you move on when the ' +
    'clock says so rather than when you finish, the session takes the same ' +
    'time for everybody regardless of pace. Bring water and a towel.',
}

// Used when the discipline tag is NOT corroborated — see classCopy() below for
// why that matters. Says only what is true of every entry on this timetable: a
// group session, a fixed weekly slot, mixed ability. No kit, no format, no
// duration, no intensity, because those are the things that differ and the
// things I do not know.
export const GENERIC_COPY =
  'A group session on the timetable, in the same slot every week. All levels ' +
  'train together and the work scales to whoever is in the room. Bring water ' +
  'and a towel. If you want to know exactly what this one involves before you ' +
  'book, ask in the group chat.'

// ── Why the discipline tag is not enough on its own ──────────────────
// `discipline` was added to HUB_CLASSES to pick a COLOUR and a piece of
// artwork. Reusing it to pick PROSE quietly promotes it from a styling bucket
// to a public claim: tagging "The Valley" as `kettlebells` so it gets the right
// accent is harmless, but printing "a class built around the kettlebell" on its
// booking page asserts something about The Valley that nobody at the club ever
// told me.
//
// So the tag has to be corroborated by the one piece of evidence the club
// actually wrote: the class NAME. "Hot Kettlebells" earns the kettlebell copy.
// "The Valley" does not, and gets GENERIC_COPY instead.
//
// Deriving this from the name rather than adding a hand-set flag is deliberate,
// because every way it can go wrong goes wrong SAFELY. Rename "The Valley" to
// "Valley Kettlebells" and the specific copy appears, correctly. Rename
// "Kettlebells" to something opaque and the copy retreats to the generic — less
// useful, still true. There is no rename that makes this page lie.
const COPY_EVIDENCE = {
  kettlebells: /kettle/i,
  hiit: /\bhiit\b|interval/i,
  yoga: /yoga/i,
  circuit: /circuit/i,
}

/** The placeholder description for a timetable class, or null if none fits. */
export function classCopy(hub) {
  if (!hub) return null
  const pattern = COPY_EVIDENCE[hub.discipline]
  if (pattern && pattern.test(hub.title || '')) {
    return DISCIPLINE_COPY[hub.discipline] || GENERIC_COPY
  }
  return GENERIC_COPY
}

/**
 * A HUB_CLASSES entry, reshaped into the row public_class_by_slug() returns.
 *
 * This exists so ClassPage can render before the SQL has ever been run. The
 * alternative was a second set of branches through that page for "no database"
 * — and that page is 45KB of carefully-stated edge cases about capacity,
 * pausing and group size. Adding a parallel path through it would double the
 * number of states to reason about and halve the chance either stays correct.
 *
 * Matching the row shape instead means the page keeps ONE code path. It cannot
 * tell the difference, which is precisely the property worth having: anything
 * that renders correctly with a real row renders correctly with this one.
 *
 * ── What is deliberately NULL ──────────────────────────────────────
 * `id`. A fabricated id would be handed to usePublicSessions(), which would
 * query real session rows and find none — leaving a date picker that is
 * permanently, silently empty. Null makes the absence explicit so the page can
 * say where to book instead. See `preview` in ClassPage.
 *
 * `video_url`, `rating_avg`, `rating_count`. There is no honest client-side
 * stand-in for a video the club has not filmed or a review nobody has left.
 * Empty sections are correct here; invented ones would be a lie on a page
 * somebody is reading in order to decide whether to pay.
 */
export function hubClassToPublic(hub, { coachBio = null } = {}) {
  if (!hub) return null
  return {
    id: null,
    name: hub.title,
    coach_name: hub.coach || null,
    // classCopy, not DISCIPLINE_COPY[hub.discipline] — the discipline tag has
    // to be corroborated by the class name before it is allowed to describe
    // the class in prose. See classCopy().
    description: classCopy(hub),
    location: null,
    capacity: 40,
    price_pennies: HUB_PLACEHOLDER_PRICE_PENNIES,
    recurrence_day: hub.day,
    recurrence_time: hub.time,
    female_only: !!hub.femaleOnly,
    is_paused: !!hub.paused,
    pause_note: hub.pauseNote || null,
    coach_slug: hub.coach ? coachSlug(hub.coach) : null,
    // The derived "Jade leads Hot Kettlebells on Monday mornings…" line. True
    // by construction — it is generated FROM the timetable, so it cannot claim
    // a class that is not on it.
    coach_bio: coachBio,
    coach_photo_url: null,
    coach_credentials: null,
    video_url: null,
    video_caption: null,
    image_url: null,
    image_focus: null,
    rating_avg: null,
    rating_count: 0,
  }
}

/** Find a timetable entry by the database slug the URL carries. */
export function hubClassByDbSlug(slug) {
  return HUB_CLASSES.find((c) => c.dbSlug === slug) || null
}

// ── Formatting ───────────────────────────────────────────────────────

/**
 * "09:30" → "9.30am", "19:30" → "7.30pm", "12:00" → "12pm".
 *
 * Matches the club's own punctuation (a dot, not a colon) so the page reads
 * like the PDF members already know. On-the-hour times drop ".00" — "7pm",
 * not "7.00pm" — which is how the PDF writes them too.
 */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${period}` : `${h12}.${String(m).padStart(2, '0')}${period}`
}

/**
 * The next calendar date this weekly class falls on, from `now`.
 *
 * The subtlety is the "today" case. If it is Monday 08:00 and the class is
 * Monday 09:30, the answer is today — 1.5 hours away. If it is Monday 21:00,
 * Monday's class has been and gone, so the answer is Monday NEXT week. Using
 * a plain `day - today` difference would return 0 both times and advertise a
 * class that finished three hours ago.
 */
export function nextOccurrence(cls, now = new Date()) {
  const [h, m] = cls.time.split(':').map(Number)
  const result = new Date(now)
  result.setHours(h, m, 0, 0)

  let delta = (cls.day - now.getDay() + 7) % 7
  // Same weekday but the start time has already passed → jump a full week.
  if (delta === 0 && result.getTime() <= now.getTime()) delta = 7
  result.setDate(result.getDate() + delta)
  return result
}

/**
 * Human distance to a class: "Today", "Tomorrow", or "Thursday".
 *
 * Compared on calendar DAYS, not elapsed milliseconds. A class 20 hours away
 * can be either today or tomorrow depending on what time it is now, so a
 * duration-based check ("< 24h = today") is wrong roughly half the time.
 */
export function relativeDay(date, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return DAY_NAMES[date.getDay()]
}

/**
 * The timetable grouped for display: Monday → Sunday, each day's classes
 * sorted by start time.
 *
 * Sorting on the "HH:MM" string is safe *because* it is zero-padded 24-hour —
 * "05:00" < "18:30" lexicographically as well as numerically. That property
 * is the entire reason the data is stored in this format.
 */
export function classesByDay() {
  return WEEK_ORDER.map((day) => ({
    day,
    name: DAY_NAMES[day],
    classes: HUB_CLASSES.filter((c) => c.day === day).sort((a, b) => a.time.localeCompare(b.time)),
  })).filter((group) => group.classes.length > 0)
}

/**
 * The whole timetable as a flat list ordered by what is happening soonest,
 * for the "Up next" view. Paused classes are excluded — a class that is not
 * running cannot be "next".
 */
export function upcomingClasses(now = new Date(), limit = 4) {
  return HUB_CLASSES.filter((c) => !c.paused)
    .map((c) => ({ ...c, when: nextOccurrence(c, now) }))
    .sort((a, b) => a.when - b.when)
    .slice(0, limit)
}

// ── Coaches, DERIVED from the timetable ──────────────────────────────
//
// Section 3c. The timetable cards open a coach panel, which needs a name, a
// stable key and something to read. The first two are already here. The third
// is the interesting one, and it is DERIVED rather than stored.
//
// The reason: the placeholder bios in supabase-coaches-seed.sql are sentences
// that only restate the timetable — "Jade leads CaTcH a Circuit on Tuesday
// evenings and the Monday morning Hot Kettlebells." A sentence computed FROM
// the timetable cannot drift from it. Storing the same paragraph in this file
// as well would create a second copy to forget: rename a class in Section 2
// and the card heading would change while the coach's blurb kept the old name,
// which is precisely the failure your "class names are dynamic" rule forbids.
//
// It also means /book has something real to show with NO database at all,
// while a REAL bio — one the coach actually wrote — overrides this the moment
// supabase-coaches-seed.sql is replaced with their own words. See mergeCoach()
// in BookGym.jsx: the derived line is the floor, never the ceiling.
//
// What is NOT derived: credentials, photos and ratings. A qualification cannot
// be inferred from a timetable, and a rating is other people's opinion of a
// named human being. Those stay empty until the database supplies them.

/**
 * "K3 & Marvin" → "k3-marvin", "Jade" → "jade".
 *
 * Must agree with the `slug` column in supabase-coaches-seed.sql, because that
 * is the key the two halves are joined on and the anchor /coaches#<slug> uses.
 * The ampersand is dropped rather than turned into "and": the seed says
 * "k3-marvin", and a slug that disagrees silently fails to match.
 */
export function coachSlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
}

// 05:00 and 09:30 are both "mornings"; 18:30 is an "evening". Split at noon
// and 5pm to match how the club talks about its own sessions.
function dayPart(hhmm) {
  const h = Number(hhmm.split(':')[0])
  if (h < 12) return 'mornings'
  if (h < 17) return 'afternoons'
  return 'evenings'
}

/**
 * A one-line blurb for a coach, built from the classes they actually lead.
 *
 * Two classes with the SAME title collapse into one clause — "The Valley on
 * Wednesday evenings and Friday mornings" rather than naming The Valley twice,
 * which is how a person would say it out loud.
 *
 * The verb agrees with the name, not with the number of classes: "K3 & Marvin
 * LEAD", "Jade LEADS". A shared-handle coach is a plural subject, and getting
 * this wrong reads as broken English on a page carrying a real person's name.
 */
export function deriveCoachBio(name, classes) {
  const mine = (classes || []).filter((c) => c.coach === name)
  if (!mine.length) return null

  const byTitle = []
  for (const c of mine) {
    const found = byTitle.find((g) => g.title === c.title)
    const when = `${DAY_NAMES[c.day]} ${dayPart(c.time)}`
    if (found) found.whens.push(when)
    else byTitle.push({ title: c.title, whens: [when] })
  }

  const list = (parts) =>
    parts.length <= 1
      ? parts.join('')
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

  const clauses = byTitle.map((g) => `${g.title} on ${list(g.whens)}`)
  const plural = /\s(&|and)\s/i.test(name)
  return `${name} ${plural ? 'lead' : 'leads'} ${list(clauses)}.`
}

/**
 * Every coach on the timetable, alphabetical, each with their classes and a
 * derived blurb.
 *
 * Classes with no named coach are skipped rather than grouped under "TBC". One
 * of the club's real classes (Dog Business HIIT) genuinely has no coach on the
 * sheet, and inventing a placeholder person to hold it would put a name on the
 * page that does not exist.
 */
export function coachRoster(classes = HUB_CLASSES) {
  const names = [...new Set(classes.map((c) => c.coach).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
  return names.map((name) => ({
    name,
    slug: coachSlug(name),
    bio: deriveCoachBio(name, classes),
    classes: classes
      .filter((c) => c.coach === name)
      .sort((a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day) || a.time.localeCompare(b.time)),
  }))
}

// ── Availability (DESIGN DECISION — see note in BookGym.jsx) ─────────
//
// Decides what a visitor may do with a given class. Split out from the
// rendering so the club's access rules live in one readable place rather
// than being spread through JSX.
//
// Returns: { bookable: boolean, label: string, note: string|null }
export function classAvailability(cls) {
  if (cls.paused) {
    return { bookable: false, label: 'Not running', note: cls.pausedNote || null }
  }
  if (cls.femaleOnly) {
    // Shown to everyone, with the restriction stated plainly. Hiding these
    // classes from the timetable would misrepresent how busy the Hub is.
    return { bookable: true, label: 'Book a space', note: 'Female only' }
  }
  return { bookable: true, label: 'Book a space', note: null }
}
