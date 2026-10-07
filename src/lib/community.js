// ── COMMUNITY FEED STUB ───────────────────────────────────────────────────────
// The community feed is the social heart of the club. Members post shout-outs,
// celebrate milestones, ask questions, and read club notices. It is NOT the
// Dashboard (metrics), NOT Social Events (calendar), and NOT The Hub (bookable
// sessions). This is members talking to members.
//
// >>> SWAP POINT: when a `community_posts` table exists in Supabase, replace the
// body of fetchCommunityFeed with:
//
//   import { supabase } from './supabase'
//   export async function fetchCommunityFeed(orgId) {
//     if (!orgId) return []
//     const { data, error } = await supabase
//       .from('community_posts')
//       .select(`
//         id, author, chapter, kind, body, created_at, likes,
//         community_comments ( id, author, body, created_at )
//       `)
//       .eq('org_id', orgId)
//       .order('created_at', { ascending: false })
//     if (error) return []
//     return (data || []).map((row) => ({
//       ...row,
//       createdAt: new Date(row.created_at),
//       comments: (row.community_comments || []).map((c) => ({
//         ...c,
//         createdAt: new Date(c.created_at),
//       })),
//     }))
//   }
//
// The table shape this expects:
//   community_posts ( id uuid PK, org_id uuid FK, author text, chapter text,
//     kind text, body text, created_at timestamptz, likes int default 0 )
//   community_comments ( id uuid PK, post_id uuid FK, author text, body text,
//     created_at timestamptz )
// ─────────────────────────────────────────────────────────────────────────────

// All dates are computed at module-load time relative to now so the demo
// never silently shows stale timestamps on a different day.
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3)

// ── Post kind vocabulary ──────────────────────────────────────────────────────
// `tone` maps to badge--{tone} in the design system (see Badge in ui.jsx).
// Do not put icon components here — this file stays React-free.
// The page maps value -> icon itself.

export const POST_KINDS = [
  { value: 'shout_out', label: 'Shout-out',   tone: 'accent'  },
  { value: 'milestone', label: 'Milestone',   tone: 'ok'      },
  { value: 'question',  label: 'Question',    tone: 'info'    },
  { value: 'notice',    label: 'Club notice', tone: 'warn'    },
]

// ── Seed data (demo only — see SWAP POINT above) ──────────────────────────────
// 16 posts spread across the last three weeks, newest first,
// mixing all four kinds and all four chapters.
// 6 posts carry one to three comments; the rest have none.
const POSTS = [
  // ── Posts from the last 24 hours ─────────────────────────────────────────
  {
    id: 'cp-001',
    author: 'Chinara Osei',
    chapter: 'London',
    kind: 'shout_out',
    body: 'Massive thank you to Marcus for running at the back with me on Thursday. Longest I have ever gone without stopping. You stayed the whole way and never made me feel like I was holding anyone up.',
    createdAt: hoursAgo(3),
    likes: 24,
    comments: [
      {
        author: 'Marcus Webb',
        body: 'That is what we are here for. See you Tuesday.',
        createdAt: hoursAgo(2),
      },
      {
        author: 'Aisha Conteh',
        body: 'This is Made Running. No one gets left behind.',
        createdAt: hoursAgo(1),
      },
    ],
  },
  {
    id: 'cp-002',
    author: 'Dele Afolabi',
    chapter: 'Manchester',
    kind: 'notice',
    body: 'Tuesday route change. The stretch along Princess Road near the Mersey crossing is closed for gas works until at least the 12th. We are going round via Chorlton Water Park instead. Same meeting point, same time. See the pinned map in the group chat.',
    createdAt: hoursAgo(7),
    likes: 41,
    comments: [
      {
        author: 'Yemi Abara',
        body: 'Cheers for the heads up, nearly went the wrong way last week.',
        createdAt: hoursAgo(5),
      },
    ],
  },
  {
    id: 'cp-003',
    author: 'Priya Nair',
    chapter: 'Birmingham',
    kind: 'milestone',
    body: 'First sub-25 5k this morning at Cannon Hill parkrun. 24:51. I have been chasing that for seven months. Going to need a minute.',
    createdAt: hoursAgo(11),
    likes: 58,
    comments: [
      {
        author: 'Kwame Asante',
        body: 'Seven months of work right there. Well earned.',
        createdAt: hoursAgo(9),
      },
      {
        author: 'Jade Mensah',
        body: 'Sub-25 club. Welcome.',
        createdAt: hoursAgo(8),
      },
      {
        author: 'Priya Nair',
        body: 'Thank you both. Sub-23 next.',
        createdAt: hoursAgo(6),
      },
    ],
  },
  {
    id: 'cp-004',
    author: 'Tobi Akinwale',
    chapter: 'Bristol',
    kind: 'question',
    body: 'Winter road running — what are people using for shoes? The pavements round my way get pretty greasy from October onwards and I am sliding around in my current trainers. Looking for something with a bit more grip without going full trail shoe.',
    createdAt: hoursAgo(18),
    likes: 12,
    comments: [
      {
        author: 'Fatima Diallo',
        body: 'Nike Pegasus Trail has done me well on wet Bristol pavements. Not aggressive enough to feel weird on tarmac either.',
        createdAt: hoursAgo(14),
      },
    ],
  },

  // ── Posts from 1–3 days ago ───────────────────────────────────────────────
  {
    id: 'cp-005',
    author: 'Josephine Asante',
    chapter: 'London',
    kind: 'milestone',
    body: 'Session 100 done. I counted. Started with Made Running when I could barely run to the end of my road and now here we are.',
    createdAt: hoursAgo(28),
    likes: 87,
    comments: [
      {
        author: 'Dele Afolabi',
        body: 'One hundred. Respect.',
        createdAt: hoursAgo(26),
      },
    ],
  },
  {
    id: 'cp-006',
    author: 'Emmanuel Boateng',
    chapter: 'Manchester',
    kind: 'shout_out',
    body: 'Shout out to the whole Saturday morning crew who turned out in that rain. Twenty-three of us. Nobody bailed. That is the club right there.',
    createdAt: hoursAgo(36),
    likes: 45,
    comments: [],
  },
  {
    id: 'cp-007',
    author: 'Sade Oluwole',
    chapter: 'Birmingham',
    kind: 'notice',
    body: "Birmingham chapter AGM is on the 14th at 7pm, Stirchley Community Market. We are voting on the new kit colourways and agreeing next season's charity partners. All members welcome, not just the regulars.",
    createdAt: hoursAgo(50),
    likes: 19,
    comments: [],
  },
  {
    id: 'cp-008',
    author: 'Nkechi Okafor',
    chapter: 'Bristol',
    kind: 'question',
    body: 'Anyone done the Bristol 10k before? Looking for advice on the hill around mile 4. Does it break people as much as it looks like it does on the course map?',
    createdAt: hoursAgo(62),
    likes: 8,
    comments: [
      {
        author: 'Tobi Akinwale',
        body: 'It is steep but it is short. Walk it if you need to, the flat after is fast and you make the time back.',
        createdAt: hoursAgo(58),
      },
      {
        author: 'Nkechi Okafor',
        body: 'That is reassuring. Thank you.',
        createdAt: hoursAgo(55),
      },
    ],
  },

  // ── Posts from 4–7 days ago ───────────────────────────────────────────────
  {
    id: 'cp-009',
    author: 'Marcus Webb',
    chapter: 'London',
    kind: 'shout_out',
    body: 'Big up Chinara for showing up three weeks in a row after saying running was not for her. It clearly is.',
    createdAt: hoursAgo(96),
    likes: 33,
    comments: [],
  },
  {
    id: 'cp-010',
    author: 'Yemi Abara',
    chapter: 'Manchester',
    kind: 'milestone',
    body: 'Half marathon done — Salford Quays, 1:54:32. First one. Took a year of showing up on cold Tuesday nights to get there. Worth every one of them.',
    createdAt: hoursAgo(110),
    likes: 72,
    comments: [
      {
        author: 'Emmanuel Boateng',
        body: 'Sub two next. You have got it.',
        createdAt: hoursAgo(106),
      },
    ],
  },
  {
    id: 'cp-011',
    author: 'Kwame Asante',
    chapter: 'Birmingham',
    kind: 'notice',
    body: 'Reminder that the Edgbaston Reservoir loop is closed on Sundays until further notice due to the cycle lane resurfacing. We are switching to Cannon Hill — route goes up to the mac and back around the boating lake. About 6k total.',
    createdAt: hoursAgo(130),
    likes: 27,
    comments: [],
  },

  // ── Posts from 8–14 days ago ──────────────────────────────────────────────
  {
    id: 'cp-012',
    author: 'Fatima Diallo',
    chapter: 'Bristol',
    kind: 'shout_out',
    body: 'Wanted to say thank you to everyone who came to the Harbourside run on Saturday. Thirty people. Six of them first-timers. That is what this club is about.',
    createdAt: hoursAgo(168),
    likes: 39,
    comments: [],
  },
  {
    id: 'cp-013',
    author: 'Aisha Conteh',
    chapter: 'London',
    kind: 'question',
    body: 'What does everyone do for nutrition before a long run? I am fine on anything under an hour but once I go past that I start to struggle around the 75-minute mark. Looking for what has actually worked for people rather than what the internet says.',
    createdAt: hoursAgo(195),
    likes: 21,
    comments: [],
  },
  {
    id: 'cp-014',
    author: 'Jade Mensah',
    chapter: 'Birmingham',
    kind: 'milestone',
    body: 'Completed Couch to 5K today. Nine weeks ago I could not run for 60 seconds. This morning I ran for 30 minutes without stopping. Whatever comes next, that matters.',
    createdAt: hoursAgo(230),
    likes: 94,
    comments: [],
  },

  // ── Posts from 15–21 days ago ─────────────────────────────────────────────
  {
    id: 'cp-015',
    author: 'Dele Afolabi',
    chapter: 'Manchester',
    kind: 'notice',
    body: 'The new kit order closes Friday at midnight. If you want your name on the list, get your size in by then. No late additions once it goes to the printers.',
    createdAt: hoursAgo(312),
    likes: 35,
    comments: [],
  },
  {
    id: 'cp-016',
    author: 'Josephine Asante',
    chapter: 'London',
    kind: 'shout_out',
    body: 'Three years ago this week, Hermen started Made Running with a WhatsApp group and twelve people who showed up. Look at us now.',
    createdAt: hoursAgo(480),
    likes: 116,
    comments: [],
  },
]

// Async-shaped accessor — keeps the same promise API for when the
// SWAP POINT above is replaced with a real Supabase call.
export async function fetchCommunityFeed() {
  return POSTS
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * timeAgo — compact relative string from a Date.
 * Returns 'just now', '14m', '3h', '2d', '3w'.
 * Handles null/undefined and future dates without crashing.
 */
export function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  if (isNaN(diff) || diff < 0) return 'just now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

/**
 * feedByKind — filter posts by kind value.
 * A null or 'all' kind returns the full array.
 */
export function feedByKind(posts, kind) {
  if (!kind || kind === 'all') return posts
  return posts.filter((p) => p.kind === kind)
}

/**
 * topContributors — aggregate authors across the feed.
 * Returns up to `limit` entries sorted by posts DESC then likes DESC.
 * Shape: { author, chapter, posts: number, likes: number }
 */
export function topContributors(posts, limit = 5) {
  const map = {}
  for (const p of posts) {
    if (!map[p.author]) {
      map[p.author] = { author: p.author, chapter: p.chapter, posts: 0, likes: 0 }
    }
    map[p.author].posts += 1
    map[p.author].likes += p.likes || 0
  }
  return Object.values(map)
    .sort((a, b) => b.posts - a.posts || b.likes - a.likes)
    .slice(0, limit)
}

// ── @mentions ─────────────────────────────────────────────────────────────────
// Tagging a member in a post. Three pure functions, no React, no DOM — the
// page owns the textarea and the dropdown, this file owns the rules.
//
// >>> SWAP POINT (roster): mentionableMembers() currently derives the roster
// from the feed itself, because the feed is a stub and there is no other list
// of people to read. When `community_posts` and the `records` table are wired
// up, the roster should come from RECORDS — the club's actual membership —
// not from who happens to have posted. Deriving from the feed has one obvious
// flaw worth naming: a member who has never posted cannot be tagged, which is
// exactly backwards, since a quiet member is the one most worth pulling into
// a conversation. Swap the source, keep matchMentions() and splitMentions().

// Lowercase and strip accents so "@bea" finds "Béatrice" and "@osei" finds
// "Osei" regardless of how either was typed. NFD splits a letter from its
// diacritic; the range strip then removes the diacritic on its own.
function foldName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * mentionableMembers — everyone who can be tagged, derived from the feed.
 * Counts posts so the ranking in matchMentions can break ties by how active
 * someone is. Comment-only authors are included: replying to a thread is
 * enough to make you a person other members will want to tag.
 *
 * @returns {{ author: string, chapter: string, posts: number }[]} A-Z
 */
export function mentionableMembers(posts = []) {
  const map = new Map()
  const add = (author, chapter) => {
    if (!author) return
    const existing = map.get(author)
    if (existing) {
      existing.posts += 1
      // A chapter learned later fills a gap left by a comment, which carries
      // no chapter of its own. First non-empty value wins.
      if (!existing.chapter && chapter) existing.chapter = chapter
      return
    }
    map.set(author, { author, chapter: chapter || '', posts: 1 })
  }
  for (const p of posts) {
    add(p.author, p.chapter)
    for (const c of p.comments || []) add(c.author, c.chapter)
  }
  return [...map.values()].sort((a, b) => a.author.localeCompare(b.author))
}

/**
 * activeMentionQuery — is the caret currently inside an @mention?
 *
 * Returns { start, query } where `start` is the index of the '@', or null.
 *
 * Two rules do the work:
 *   1. The '@' must begin a word. Without this, every email address in a post
 *      ("mail me at dele@made.run") opens the dropdown mid-typing.
 *   2. The fragment may contain AT MOST ONE space. Club members are tagged by
 *      full name — "@Chinara Osei" — so stopping at the first space would make
 *      every surname untypeable. Allowing unlimited spaces is the opposite
 *      failure: the dropdown would stay open for the rest of the paragraph.
 *
 * @param {string} text  full textarea value
 * @param {number} caret selectionStart
 */
export function activeMentionQuery(text, caret) {
  const upto = String(text || '').slice(0, caret)
  const at = upto.lastIndexOf('@')
  if (at === -1) return null

  const before = at === 0 ? '' : upto[at - 1]
  if (before && !/[\s(\[]/.test(before)) return null

  const fragment = upto.slice(at + 1)
  // Letters, combining marks, hyphens and apostrophes, with one optional
  // space-separated second word.
  if (!/^[\p{L}\p{M}'’-]*(?: [\p{L}\p{M}'’-]*)?$/u.test(fragment)) return null
  // A runaway fragment means the '@' was almost certainly not a mention.
  if (fragment.length > 32) return null

  return { start: at, query: fragment }
}

/**
 * matchMentions — rank the roster against what has been typed so far.
 *
 * Three tiers, and the order between them is the whole point:
 *   0. full-name prefix   "chi"  -> Chinara Osei
 *   1. any WORD prefix    "osei" -> Chinara Osei
 *   2. anywhere inside    "sei"  -> Chinara Osei
 *
 * Tier 1 is the one that matters. People reach for a surname at least as
 * often as a first name, and a strict left-to-right prefix match — the naive
 * implementation — silently makes surnames unsearchable. Tier 2 is kept last
 * and deliberately weak: it rescues a typo'd or half-remembered name without
 * ever outranking a real prefix hit.
 *
 * An empty query returns the most active members, so opening the dropdown
 * with a bare '@' is useful rather than alphabetical noise.
 */
export function matchMentions(query, people = [], limit = 6) {
  if (!query) {
    return [...people]
      .sort((a, b) => b.posts - a.posts || a.author.localeCompare(b.author))
      .slice(0, limit)
  }

  const q = foldName(query)
  const scored = []

  for (const person of people) {
    const name = foldName(person.author)
    let tier = -1
    if (name.startsWith(q)) tier = 0
    else if (name.split(/\s+/).some((word) => word.startsWith(q))) tier = 1
    else if (name.includes(q)) tier = 2
    if (tier === -1) continue
    scored.push({ person, tier })
  }

  scored.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.person.posts - a.person.posts ||
      a.person.author.localeCompare(b.person.author),
  )
  return scored.map((s) => s.person).slice(0, limit)
}

/**
 * splitMentions — break a post body into plain and mention segments so the
 * page can render tags as chips.
 *
 * Matched against the KNOWN roster rather than a generic /@\w+/ pattern, for
 * two reasons. Names contain spaces, so a word-based regex would highlight
 * "@Chinara" and leave "Osei" as loose text. And an unknown handle is not a
 * mention — highlighting "@everyone" or "@made.run" as if it were a person
 * would be a link to nobody.
 *
 * Names are sorted longest-first so "Marcus Webb" is tried before a
 * hypothetical "Marcus", which alternation would otherwise match first and
 * truncate.
 *
 * @returns {{ type: 'text'|'mention', value: string }[]}
 */
export function splitMentions(body, names = []) {
  const text = String(body || '')
  if (!text || !names.length) return [{ type: 'text', value: text }]

  const pattern = [...names]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
  if (!pattern) return [{ type: 'text', value: text }]

  // The trailing guard stops "@Marcus" matching inside "@Marcuson".
  const re = new RegExp(`@(?:${pattern})(?![\\p{L}\\p{M}])`, 'giu')
  const out = []
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    out.push({ type: 'mention', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out.length ? out : [{ type: 'text', value: text }]
}

// ── Media attachments ─────────────────────────────────────────────────────────
// Pictures and video on a post. Pure rules only — the page owns the file input
// and the object URLs.
//
// >>> SWAP POINT (storage): attachments are currently held as blob: object URLs
// created by URL.createObjectURL, which live in the browser's memory and die
// with the tab. That is honest for a demo but it is NOT an upload — nothing
// leaves the device and nothing is shared with anyone.
//
// The real path is Supabase Storage:
//
//   const path = `${orgId}/${postId}/${crypto.randomUUID()}-${file.name}`
//   const { error } = await supabase.storage.from('community-media')
//     .upload(path, file, { contentType: file.type, upsert: false })
//   const { data } = supabase.storage.from('community-media').getPublicUrl(path)
//   // then persist data.publicUrl on the post row
//
// with a `community_media` table ( id, post_id FK, kind, url, storage_path,
// width, height, duration_seconds ) and a storage RLS policy scoped to
// org_id — the same per-org boundary every other table uses. Video should get
// a server-side transcode before it is worth calling production; a phone
// straight out of the camera roll is routinely 100MB+ of HEVC that some
// browsers will not play.

// Caps are per-file. Deliberately generous for pictures and tight for video:
// a 5-minute clip of a Saturday run is the normal case, a full unedited
// recording is not, and every byte here sits in the tab's memory until the
// page is closed.
export const MEDIA_LIMITS = {
  maxFiles: 4,
  maxImageBytes: 12 * 1024 * 1024, // 12 MB
  maxVideoBytes: 64 * 1024 * 1024, // 64 MB
  // `accept` for the file input. Broad MIME wildcards rather than an
  // extension list, so a phone offers its camera roll instead of a file
  // browser — the difference between a two-tap post and a five-tap one.
  accept: 'image/*,video/*',
}

export function mediaKind(type) {
  const t = String(type || '')
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  return null
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/**
 * validateMediaFile — can this file be attached?
 *
 * Returns { ok: true, kind } or { ok: false, error } with a message written
 * for a member, not a developer: it says which file and what to do, because
 * "Invalid file" on a phone in a park tells someone nothing they can act on.
 *
 * The `accept` attribute on the input is a filter, not a guarantee — a drag
 * and drop, a paste, or "All Files" in the OS picker all bypass it — so the
 * type is checked again here.
 */
export function validateMediaFile(file) {
  if (!file) return { ok: false, error: 'That file could not be read.' }
  const kind = mediaKind(file.type)
  if (!kind) {
    return { ok: false, error: `${file.name} is not a picture or a video.` }
  }
  const cap = kind === 'image' ? MEDIA_LIMITS.maxImageBytes : MEDIA_LIMITS.maxVideoBytes
  if (file.size > cap) {
    return {
      ok: false,
      error: `${file.name} is ${formatBytes(file.size)} — ${kind === 'image' ? 'pictures' : 'videos'} need to be under ${formatBytes(cap)}.`,
    }
  }
  return { ok: true, kind }
}

/**
 * acceptMediaFiles — validate a whole selection against the per-post cap.
 *
 * Returns { accepted, errors }. Partial success is intentional: picking four
 * photos where one is oversized should attach the other three and say why the
 * fourth did not, rather than rejecting the batch and making the member work
 * out which file was the problem.
 *
 * @param {File[]} files    newly picked files
 * @param {number} existing how many are already attached
 */
export function acceptMediaFiles(files, existing = 0) {
  const accepted = []
  const errors = []
  let slots = Math.max(0, MEDIA_LIMITS.maxFiles - existing)

  for (const file of files) {
    if (slots === 0) {
      errors.push(`Up to ${MEDIA_LIMITS.maxFiles} files per post — ${file.name} was not added.`)
      continue
    }
    const result = validateMediaFile(file)
    if (!result.ok) {
      errors.push(result.error)
      continue
    }
    accepted.push({ file, kind: result.kind })
    slots -= 1
  }
  return { accepted, errors }
}

// ── Deleting ──────────────────────────────────────────────────────────────────

/**
 * The signed-in member is represented in the feed by this literal author name.
 *
 * This is the seam where the demo differs from production. Right now a post is
 * "mine" if handleNewPost stamped it 'You'. With real auth this becomes a
 * comparison of post.authorId against session.user.id, and the check must ALSO
 * be enforced by a Supabase RLS policy — a client-side check decides what to
 * *show*, never what is *allowed*. Anyone can call the API directly.
 */
export const SELF_AUTHOR = 'You'

/**
 * canDeletePost — the deletion policy, in one place.
 *
 * Deliberately its own function rather than an inline `post.author === 'You'`
 * scattered across the JSX, because this is a product rule that clubs argue
 * about and it should be changeable in one edit. Three plausible rules:
 *
 *   1. Author deletes their own, always.            ← current
 *   2. Author deletes, but not once others have
 *      commented (their replies would vanish too).
 *   3. Author deletes within N minutes of posting,
 *      then it belongs to the noticeboard.
 *
 * Rule 1 is the least surprising default and the safest for a demo: a member
 * who posts a photo of a group run and is asked to take it down can do so
 * immediately, with no explaining. Rules 2 and 3 are one line each — see the
 * commented alternatives.
 *
 * @param {object} post
 * @returns {boolean}
 */
export function canDeletePost(post) {
  if (!post) return false
  if (post.author !== SELF_AUTHOR) return false

  // Rule 2 — protect other members' replies:
  //   if (post.comments?.length) return false
  //
  // Rule 3 — 15-minute grace window:
  //   const age = Date.now() - new Date(post.createdAt).getTime()
  //   if (age > 15 * 60 * 1000) return false

  return true
}

/**
 * releaseMediaItem — hand a single attachment's memory back to the browser.
 *
 * Guarded on the `blob:` scheme for a real reason, not defensiveness. Seeded
 * posts carry ordinary paths ('/img/community/hyde-park.jpg'). Passing one of
 * those to revokeObjectURL is silently ignored by the browser, so nothing would
 * break — but the guard documents that only URLs WE minted are ours to destroy,
 * which is the invariant a future reader needs when media starts arriving from
 * Supabase Storage as signed https URLs.
 *
 * @param {{url?: string}} item
 */
export function releaseMediaItem(item) {
  const url = item?.url
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * releasePostMedia — revoke every blob a post owns.
 *
 * Call this when a post is destroyed. Skipping it is not a crash, it is a leak:
 * object URLs are excluded from garbage collection precisely because the
 * browser cannot know whether you still intend to use the string. A deleted
 * post holding a 64 MB video keeps all 64 MB resident until the tab closes.
 *
 * SWAP POINT (storage): once media lives in Supabase Storage this must ALSO
 * remove the stored object, or deleting a post only hides it while the file
 * stays publicly reachable by anyone who copied the URL:
 *
 *   await supabase.storage.from('community-media').remove(paths)
 *
 * @param {{media?: Array}} post
 */
export function releasePostMedia(post) {
  for (const item of post?.media || []) releaseMediaItem(item)
}
