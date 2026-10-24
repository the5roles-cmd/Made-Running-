// ============================================================
// DEMO ASSISTANT — answers computed from the fixtures, not from Claude
// ============================================================
// "Ask Made Running" posts to /api/chat, which is the Express proxy in
// server/index.cjs. The prospect demo is a STATIC Vercel deploy: there is no
// Express, and vercel.json rewrites everything except /api/* to index.html —
// so /api/chat is a plain 404. api.js then parses the HTML body as JSON,
// fails, falls back to `{}`, and ChatThread renders `data.reply`, which is
// undefined. An EMPTY assistant bubble.
//
// That is the single worst failure mode available to a demo being emailed to
// clubs: not an error they could forgive, but a feature that visibly does
// nothing. Hence this module.
//
// ── Why not just proxy to the real Claude API ───────────────────────────────
// Because the demo URL is sent to strangers and posted on. A serverless
// function with a live ANTHROPIC_API_KEY behind an unauthenticated page is an
// open invoice — anyone who finds the link can spend the club's budget, at
// whatever rate they like. The demo deliberately ships with no credentials of
// any kind, and that has to include this one.
//
// ── The honesty constraint ──────────────────────────────────────────────────
// The project rule is that no screen may claim what the database cannot
// confirm. These answers are inside it, narrowly: in demo mode the fixture
// store IS the database, so a count derived from it is as true as a count
// derived from Postgres. What this module must never do is invent a FACT —
// "turnout is up 20% on last month" is not computable here, so it is not said.
//
// Nor does it pretend to be the real assistant. Every reply is grounded in a
// number the prospect can go and check on the Runners or Sessions screen, and
// anything outside the handled set gets the honest deflection at the bottom
// rather than a confident guess.
import { demoList } from './demoData'

const names = (rows) => rows.map((r) => r.title).join(', ')

// Counts reach the reader as prose, so they have to agree with their verb.
// "1 runners are flagged" is the kind of seam that makes a demo feel generated
// — and this one DID ship that way until the first read-through caught it.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Each entry is [test, answer]. First match wins, so order is specificity:
// "who should I follow up" must beat the bare "runners" match below it.
//
// Matching is keyword-based rather than semantic on purpose. A fuzzy matcher
// that lands on the wrong handler produces a confidently irrelevant answer,
// which is worse in front of a buyer than an honest "I can't answer that".
const HANDLERS = [
  [
    /at.?risk|follow.?up|drift|lapsed|losing|win.?back/i,
    () => {
      const rows = demoList('records')
      const atRisk = rows.filter((r) => r.status === 'at_risk')
      const lapsed = rows.filter((r) => r.status === 'lapsed')
      return [
        `${plural(atRisk.length, 'runner is', 'runners are')} flagged at risk and ${plural(lapsed.length, 'has', 'have')} lapsed.`,
        atRisk.length && `At risk: ${names(atRisk)}.`,
        lapsed.length && `Lapsed: ${names(lapsed)}.`,
        'Each one has a note on their record explaining why — open Runners to see it.',
      ]
        .filter(Boolean)
        .join(' ')
    },
  ],
  [
    /new (runner|member|joiner)|just joined|newest|first.?time/i,
    () => {
      const neu = demoList('records').filter((r) => r.status === 'new')
      return `${plural(neu.length, 'runner is', 'runners are')} new: ${names(neu)}. None has attended more than once yet, so they are the group most likely to drop off without a nudge.`
    },
  ],
  [
    /turnout|attend|how many came|register|check.?in/i,
    () => {
      const past = demoList('sessions', { order: 'starts_at' }).filter(
        (s) => s.type === 'run' && new Date(s.starts_at) < new Date(),
      )
      const last = past[0]
      if (!last) return 'No completed sessions yet.'
      const n = demoList('attendance').filter((a) => a.session_id === last.id).length
      const total = demoList('attendance').length
      return `The most recent completed run was ${last.title} on ${new Date(last.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, with ${plural(n, 'runner', 'runners')} checked in. There are ${total} check-ins recorded across all sessions.`
    },
  ],
  [
    /volunteer|run leader|pacer|ambassador/i,
    () => {
      const v = demoList('volunteers')
      const by = {}
      for (const row of v) by[row.volunteer_type] = (by[row.volunteer_type] || 0) + 1
      const parts = Object.entries(by).map(([t, n]) => `${n} ${t.replace(/_/g, ' ')}`)
      const paused = v.filter((r) => r.status !== 'active').length
      return `${plural(v.length, 'volunteer', 'volunteers')} on the books: ${parts.join(', ')}. ${paused} currently paused.`
    },
  ],
  [
    /partner|sponsor|deal|pipeline|funding|grant/i,
    () => {
      const deals = demoList('deals')
      const open = deals.filter((d) => !/won|lost/i.test(d.stage || ''))
      const value = open.reduce((t, d) => t + (d.value || 0), 0)
      const accounts = demoList('accounts')
      return `${plural(accounts.length, 'partner organisation', 'partner organisations')} and ${plural(deals.length, 'conversation', 'conversations')}, of which ${plural(open.length, 'is', 'are')} still open, worth £${value.toLocaleString('en-GB')} in total. The partner shows in the PARTNER column on Runners, and the conversation itself on that runner's record.`
    },
  ],
  [
    /shop|order|kit|merch|revenue|spend|money|income/i,
    () => {
      const orders = demoList('shopify_orders')
      const total = orders.reduce((t, o) => t + (o.total || 0), 0)
      return `${plural(orders.length, 'kit order', 'kit orders')} totalling £${total}. Each one is linked to the runner who placed it, so it counts towards the lifetime spend on their record.`
    },
  ],
  [
    /session|timetable|schedule|this week|next week|upcoming|when do/i,
    () => {
      const now = new Date()
      const next = demoList('sessions', { order: 'starts_at', ascending: true }).filter(
        (s) => new Date(s.starts_at) > now,
      )
      const fmt = (s) =>
        `${s.title} — ${new Date(s.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
      return `${plural(next.length, 'session is', 'sessions are')} scheduled ahead. Next up: ${next.slice(0, 3).map(fmt).join('; ')}.`
    },
  ],
  [
    /how many runner|roster|membership|total member|club size/i,
    () => {
      const rows = demoList('records')
      const active = rows.filter((r) => r.status === 'active').length
      return `${plural(rows.length, 'runner', 'runners')} on the roster, ${active} of them currently active. The rest are split between new, at risk and lapsed — that breakdown is the point of the status column.`
    },
  ],
]

// ── The fallback ────────────────────────────────────────────────────────────
// Reached whenever none of the handlers above matches, which on an open text
// box is most questions. It is the reply a prospect is most likely to see, so
// it is doing more selling than any of the real answers.
//
// It deflects rather than guesses, and says WHY, because the alternative — a
// plausible-sounding invented answer — is the thing that would lose the sale
// the moment they checked it against the Runners screen. It also names what
// the live assistant would have had (the club's actual rows, a real model)
// so the limitation reads as a property of the demo, not of the product.
const FALLBACK = `I can't answer that one in the demo. This build ships with no database and no AI credentials on purpose — it is a public link, so there is nothing here anyone could run up a bill on or pull real member data out of.

In a connected club the assistant answers from your live rows. Here I can still tell you about the sample club's runners, at-risk list, turnout, volunteers, partners, kit orders or timetable — try one of those.`

// Returns a string, always. Sync, but ChatThread awaits it so the shape
// matches the real `chat()` call and the two paths stay interchangeable.
export function demoAnswer(question) {
  const q = String(question || '')
  for (const [test, answer] of HANDLERS) {
    if (test.test(q)) return answer()
  }
  return FALLBACK
}
