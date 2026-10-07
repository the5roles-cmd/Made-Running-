// ── SALES AGGREGATION HELPERS ─────────────────────────────────────────
// Pure functions over shopify_orders rows. No React, no Supabase, no side
// effects. Safe against null/undefined/empty input throughout.
//
// Two non-obvious design choices are documented inline:
//   1. monthOnMonth returns pct: null (not 0) when previous === 0.
//   2. revenueByMonth always emits zero-revenue months.

// Coerce a Supabase numeric column (arrives as string) to a safe number.
// Non-numeric values become 0 to avoid poisoning aggregates with NaN.
function safeTotal(raw) {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

// ── formatGBP ─────────────────────────────────────────────────────────
// Render a GBP amount. Values >= 100 show no decimals (£8,420); values
// below 100 show exactly 2 decimals (£27.50). Handles 0 and non-numeric
// input as £0.00. Negative values place minus before the symbol (-£12.00).
export function formatGBP(n) {
  const value = (n == null || !Number.isFinite(Number(n))) ? 0 : Number(n)

  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : 2

  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(abs)

  return value < 0 ? `-${formatted}` : formatted
}

// ── salesSummary ───────────────────────────────────────────────────────
export function salesSummary(orders) {
  const rows = Array.isArray(orders) ? orders : []
  if (rows.length === 0) {
    return { revenue: 0, orderCount: 0, avgOrder: 0, firstOrderAt: null, lastOrderAt: null }
  }

  let revenue = 0
  let earliest = null
  let latest = null

  for (const row of rows) {
    revenue += safeTotal(row?.total)
    const d = row?.ordered_at ? new Date(row.ordered_at) : null
    if (d && Number.isFinite(d.getTime())) {
      if (!earliest || d < earliest) earliest = d
      if (!latest || d > latest) latest = d
    }
  }

  const orderCount = rows.length
  const avgOrder = orderCount > 0 ? revenue / orderCount : 0

  return { revenue, orderCount, avgOrder, firstOrderAt: earliest, lastOrderAt: latest }
}

// ── revenueByMonth ────────────────────────────────────────────────────
// Returns exactly `months` buckets, oldest first, ending on the current
// month. Zero-revenue months are still emitted — omitting them would make
// a bar chart silently lie about a genuinely quiet month.
//
// Month keys are built from local date parts (getFullYear/getMonth) rather
// than slicing the ISO string. ISO slicing would use UTC, which misfires
// a late-evening UK order into the following month.
export function revenueByMonth(orders, months = 6) {
  const rows = Array.isArray(orders) ? orders : []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-based

  // Build the month window from oldest to newest
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    let y = currentYear
    let m = currentMonth - i
    // Normalise across year boundaries
    while (m < 0) { m += 12; y -= 1 }

    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const shortName = new Date(y, m, 1).toLocaleString('en-GB', { month: 'short' })

    // If the window spans a year boundary, disambiguate the label so two
    // identically-named months (e.g. Jan appearing in year N and N+1) are
    // visually distinct.
    const yearMin = currentYear - Math.ceil((months - 1) / 12)
    const needsYear = y <= yearMin || months > 12
    const label = needsYear ? `${shortName} ${String(y).slice(2)}` : shortName

    buckets.push({ key, label, revenue: 0, orders: 0 })
  }

  // Index buckets by key for O(1) lookup
  const index = {}
  for (const b of buckets) index[b.key] = b

  for (const row of rows) {
    if (!row?.ordered_at) continue
    const d = new Date(row.ordered_at)
    if (!Number.isFinite(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (index[key]) {
      index[key].revenue += safeTotal(row.total)
      index[key].orders += 1
    }
  }

  return buckets
}

// ── monthOnMonth ──────────────────────────────────────────────────────
// Returns the percentage change between last month and this month.
// pct is null (not 0) when previous === 0. A percentage change from zero
// is mathematically undefined and renders as an em-dash on the page —
// returning 0 would mislead: it implies no change rather than no baseline.
export function monthOnMonth(orders) {
  const rows = Array.isArray(orders) ? orders : []
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth()

  let py = cy
  let pm = cm - 1
  if (pm < 0) { pm = 11; py -= 1 }

  const currentKey = `${cy}-${String(cm + 1).padStart(2, '0')}`
  const previousKey = `${py}-${String(pm + 1).padStart(2, '0')}`

  let current = 0
  let previous = 0

  for (const row of rows) {
    if (!row?.ordered_at) continue
    const d = new Date(row.ordered_at)
    if (!Number.isFinite(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const t = safeTotal(row.total)
    if (key === currentKey) current += t
    if (key === previousKey) previous += t
  }

  let pct = null
  let direction = 'flat'

  if (previous > 0) {
    pct = ((current - previous) / previous) * 100
    direction = current > previous ? 'up' : current < previous ? 'down' : 'flat'
  } else if (current > 0) {
    // previous is 0 but current is not: unambiguously up, pct stays null
    direction = 'up'
  }
  // both zero: flat, pct null

  return { pct, direction, current, previous }
}

// ── topProducts ───────────────────────────────────────────────────────
// Groups orders by the `items` string (a single product name per order).
// Orders with missing/empty items are ignored rather than creating an
// empty-string bucket. share is each product's fraction of total revenue.
export function topProducts(orders, limit = 5) {
  const rows = Array.isArray(orders) ? orders : []
  const map = {}
  let grandTotal = 0

  for (const row of rows) {
    const name = typeof row?.items === 'string' ? row.items.trim() : ''
    if (!name) continue
    const t = safeTotal(row.total)
    grandTotal += t
    if (!map[name]) map[name] = { name, revenue: 0, orders: 0 }
    map[name].revenue += t
    map[name].orders += 1
  }

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map(p => ({ ...p, share: grandTotal > 0 ? p.revenue / grandTotal : 0 }))
}

// ── recentOrders ──────────────────────────────────────────────────────
// Returns raw order objects, newest first. Sorts a shallow copy to avoid
// mutating the caller's React state array.
export function recentOrders(orders, limit = 8) {
  const rows = Array.isArray(orders) ? orders : []
  return [...rows]
    .sort((a, b) => {
      const da = a?.ordered_at ? new Date(a.ordered_at).getTime() : 0
      const db = b?.ordered_at ? new Date(b.ordered_at).getTime() : 0
      return db - da
    })
    .slice(0, limit)
}
