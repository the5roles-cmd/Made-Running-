// ============================================================
// Shared Square helpers for the serverless API routes.
//
// Underscore prefix: Vercel does not turn this file into a route — it is a
// plain module that api/checkout.js imports. Mirrors the convention set by
// _ai.js.
//
// No `square` npm dependency, same reasoning as the Stripe code this sits
// beside: we POST JSON straight to Square's REST API. One fewer package to
// trust, no cold-start SDK import, and the access token is read from the
// environment at call time — it never reaches the browser.
// ============================================================

// Square splits sandbox and production into two HOSTS, not two key prefixes
// the way Stripe does (sk_test_/sk_live_). A sandbox token sent to the
// production host just gets 401 UNAUTHORIZED with no hint that the token is
// fine and the host is wrong — so the environment has to be named
// explicitly. Default is production: that is where the club's real payment
// links live, and a sandbox token against the production host fails loudly
// at the first test rather than silently taking pretend money.
export const squareHost = () =>
  (process.env.SQUARE_ENV || 'production') === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com'

// Reject placeholders ("your-token", "EAAA...") the same way _ai.js does for
// Anthropic keys: a half-configured environment should answer "demo mode",
// not fail deep inside an HTTP 401.
export const realSquareToken = (k) =>
  typeof k === 'string' &&
  k.length > 20 &&
  !k.includes('...') &&
  !k.toLowerCase().startsWith('your')

// Pinned, not "latest": Square versions its API by date header and reserves
// the right to change response shapes between versions. An unpinned version
// means the API changes under us on Square's schedule instead of ours.
const SQUARE_VERSION = '2025-01-23'

async function squareFetch(path, { method = 'GET', token, body }) {
  const r = await fetch(`${squareHost()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    // Spread, not `body: undefined`: fetch rejects a body KEY on GET even
    // when its value is undefined in some runtimes, and the linter agrees.
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const detail = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || `HTTP ${r.status}`
    const err = new Error(detail)
    err.status = r.status
    throw err
  }
  return data
}

// Module-scope cache. Serverless instances stay warm between requests, so
// after the first call the location lookup costs nothing; a cold start pays
// one extra round-trip. SQUARE_LOCATION_ID in the environment skips the
// lookup entirely and is the recommended setup.
let cachedLocationId = null

export async function resolveLocationId(token) {
  const configured = process.env.SQUARE_LOCATION_ID
  if (configured && !configured.toLowerCase().startsWith('your')) return configured
  if (cachedLocationId) return cachedLocationId
  const data = await squareFetch('/v2/locations', { token })
  const active = (data.locations || []).find((l) => l.status === 'ACTIVE')
  if (!active) throw new Error('No active Square location on this account.')
  cachedLocationId = active.id
  return cachedLocationId
}

/**
 * Create a Square-hosted payment page and return its URL.
 *
 * lineItems: [{ name, quantity, amountPennies }] — amounts are PER UNIT, in
 * pennies, and must already be server-computed. This function deliberately
 * has no parameter through which a client-supplied total could arrive.
 *
 * idempotencyKey is required by Square on this endpoint and is the guard
 * against double-charging: if a network timeout makes a caller retry, Square
 * recognises the repeated key and returns the ORIGINAL link rather than
 * creating a second order.
 */
export async function createPaymentLink({
  token,
  locationId,
  lineItems,
  email,
  redirectUrl,
  referenceId,
  idempotencyKey,
}) {
  const data = await squareFetch('/v2/online-checkout/payment-links', {
    method: 'POST',
    token,
    body: {
      idempotency_key: idempotencyKey,
      order: {
        location_id: locationId,
        reference_id: referenceId || undefined,
        line_items: lineItems.map((li) => ({
          name: li.name,
          quantity: String(li.quantity),
          base_price_money: { amount: li.amountPennies, currency: 'GBP' },
        })),
      },
      checkout_options: {
        redirect_url: redirectUrl || undefined,
        // Card on the hosted page; the club takes cash "on arrival" through
        // the other branch of the booking form, not through Square.
        ask_for_shipping_address: false,
      },
      pre_populated_data: email ? { buyer_email: email } : undefined,
    },
  })
  return data?.payment_link?.url || null
}
