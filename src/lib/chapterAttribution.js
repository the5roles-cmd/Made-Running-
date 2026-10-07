// chapterAttribution.js
//
// WHY THIS FILE EXISTS:
// The `records` table (Runners) has NO chapter_id column — there is no direct
// runner→chapter link in the schema. Chapters are only reachable indirectly:
//   attendance row  →  session row  →  chapter row
// So a runner's "home chapter" must be INFERRED from which chapter's sessions
// they actually turn up to. That inference is the entire purpose of this module.
//
// NOTE ON COLUMN NAMES (verified against supabase-setup.sql):
//   attendance.runner_id  references records.id  (NOT record_id — see the
//   create table attendance block in supabase-setup.sql, line ~234)
//   shopify_orders.runner_id also references records.id — both use runner_id,
//   so there is NO name asymmetry between these two tables in this project.
//
// Both exports are pure functions: no React, no Supabase, no side-effects.
// Safe against null / undefined / empty inputs throughout.

/**
 * attributeRunnersToChapters
 *
 * For each runner, counts attendances per chapter and assigns the chapter they
 * attended the MOST. Tie-break rules (applied in order):
 *   1. Most-recently attended session (sessions.starts_at DESC)
 *   2. Lowest chapter_id string (deterministic, prevents render flicker)
 *
 * Runners with zero usable attendance rows do not appear in the returned Map.
 * Attendance rows whose session is unknown, or whose session has a null
 * chapter_id, are silently skipped — they carry no chapter signal.
 *
 * @param {Array} attendanceRows  rows from the `attendance` table
 * @param {Array} sessionRows     rows from the `sessions` table
 * @returns {Map<string, string>} runnerId → chapterId
 */
export function attributeRunnersToChapters(attendanceRows, sessionRows) {
  if (!attendanceRows?.length || !sessionRows?.length) return new Map()

  // Build a sessionId → session lookup once so we never do a nested .find()
  // inside the attendance loop (attendance can be ~900 rows in production).
  const sessionById = new Map()
  for (const s of sessionRows) {
    if (s?.id) sessionById.set(String(s.id), s)
  }

  // runner → chapter → { count, latestStartsAt }
  // Using nested Maps avoids string-key collisions from id concatenation.
  const tally = new Map() // Map<runnerId, Map<chapterId, { count, latestStartsAt }>>

  for (const row of attendanceRows) {
    if (!row?.runner_id) continue
    const session = sessionById.get(String(row.session_id))
    if (!session?.chapter_id) continue // unknown session or null chapter — skip

    const runnerId = String(row.runner_id)
    const chapterId = String(session.chapter_id)
    const startsAt = session.starts_at ? new Date(session.starts_at).getTime() : 0

    if (!tally.has(runnerId)) tally.set(runnerId, new Map())
    const chapters = tally.get(runnerId)

    if (!chapters.has(chapterId)) {
      chapters.set(chapterId, { count: 0, latestStartsAt: 0 })
    }
    const entry = chapters.get(chapterId)
    entry.count += 1
    if (startsAt > entry.latestStartsAt) entry.latestStartsAt = startsAt
  }

  // Resolve each runner to their winning chapter.
  const result = new Map()
  for (const [runnerId, chapters] of tally) {
    let winnerChapterId = null
    let winnerCount = -1
    let winnerLatest = -1

    for (const [chapterId, { count, latestStartsAt }] of chapters) {
      const beats =
        count > winnerCount ||
        (count === winnerCount && latestStartsAt > winnerLatest) ||
        (count === winnerCount && latestStartsAt === winnerLatest && chapterId < winnerChapterId)

      if (beats) {
        winnerChapterId = chapterId
        winnerCount = count
        winnerLatest = latestStartsAt
      }
    }

    if (winnerChapterId !== null) result.set(runnerId, winnerChapterId)
  }

  return result
}

/**
 * salesByChapter
 *
 * Breaks Shopify order revenue down by the runner's inferred home chapter.
 * Orders whose runner is not in runnerChapterMap are grouped into a single
 * trailing { chapterId: null, name: 'Unattributed' } bucket. That bucket is
 * a data-quality signal, not a real chapter, so it always sorts LAST regardless
 * of its revenue — letting it top the chart would misrepresent the club.
 * Chapters with zero orders are omitted from the output.
 *
 * Supabase `numeric` columns arrive as strings — every `total` is coerced with
 * Number(). NaN (e.g. from null / garbage data) is treated as 0.
 *
 * @param {Array} orders            rows from `shopify_orders`
 * @param {Map<string,string>} runnerChapterMap  output of attributeRunnersToChapters
 * @param {Array} chapterRows       rows from `chapters`
 * @returns {Array<{ chapterId: string|null, name: string, revenue: number, orders: number }>}
 */
export function salesByChapter(orders, runnerChapterMap, chapterRows) {
  if (!orders?.length) return []

  // Build chapterId → name lookup
  const chapterName = new Map()
  for (const c of (chapterRows || [])) {
    if (c?.id) chapterName.set(String(c.id), c.name ?? String(c.id))
  }

  const buckets = new Map() // chapterId|null → { revenue, orders }
  let unattributed = { revenue: 0, orders: 0 }

  for (const order of orders) {
    if (!order) continue
    // Coerce numeric — Supabase returns numeric columns as strings
    const total = Number(order.total)
    const amount = Number.isNaN(total) ? 0 : total

    const runnerId = order.runner_id ? String(order.runner_id) : null
    const chapterId = runnerId ? (runnerChapterMap?.get(runnerId) ?? null) : null

    if (chapterId === null) {
      // No chapter mapping for this runner — goes to Unattributed
      unattributed.revenue += amount
      unattributed.orders += 1
    } else {
      if (!buckets.has(chapterId)) buckets.set(chapterId, { revenue: 0, orders: 0 })
      const b = buckets.get(chapterId)
      b.revenue += amount
      b.orders += 1
    }
  }

  // Build output array (known chapters only), sorted by revenue DESC
  const rows = []
  for (const [chapterId, { revenue, orders }] of buckets) {
    rows.push({
      chapterId,
      name: chapterName.get(chapterId) ?? chapterId,
      revenue,
      orders,
    })
  }
  rows.sort((a, b) => b.revenue - a.revenue)

  // Unattributed always trails — it is a data-quality bucket, not a chapter
  if (unattributed.orders > 0) {
    rows.push({ chapterId: null, name: 'Unattributed', ...unattributed })
  }

  return rows
}
