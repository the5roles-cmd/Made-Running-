// POST /api/checkout — create a hosted payment page for a class booking or
// a shop cart, and return its URL.
//
// Body (one of two kinds):
//   { kind: 'class', bookingId, title, places, email, successUrl }
//   { kind: 'cart',  items: [{ productId, colourway, size, qty }], email, successUrl }
//
// Returns: { url }        → redirect the member here to pay
//          { demo: true } → no payment provider configured on this
//                           deployment; the front-end falls back to its
//                           demo behaviour so the flow stays demonstrable.
//
// ── THE SECURITY RULE THIS FILE EXISTS TO ENFORCE ──────────────
// The client NEVER sends an amount. The old version of this endpoint took
// `amountPennies` straight from the request body, which meant anyone with
// DevTools could buy a £10 class for 1p by editing the fetch. Now:
//
//   • class checkouts are priced from CLASS_PRICE_PENNIES below
//     (every class is £10 — the price the club set),
//   • cart checkouts are priced by looking each productId up in the SAME
//     catalogue file the Shop page renders from (src/lib/products.js),
//     so the price on screen and the price charged cannot disagree.
//
// Unknown product ids are dropped, quantities are clamped, and a cart
// that prices to zero is rejected rather than sent to the provider.
//
// ── PROVIDER SELECTION ─────────────────────────────────────────
// Square first (the club's real account), Stripe second (legacy — the keys
// may exist on old deployments), demo mode last. Both providers sit behind
// the same { url } contract so the client never knows which one answered.
import { body, wrongMethod } from './_ai.js'
import { realSquareToken, resolveLocationId, createPaymentLink } from './_square.js'
import { PRODUCTS } from '../src/lib/products.js'
import { randomUUID } from 'node:crypto'

// Every class is £10 — set by the club ("change the prices of each class to
// £10"). When per-class pricing diverges this must become a lookup against
// the class record, same pattern as the PRODUCTS lookup below.
const CLASS_PRICE_PENNIES = 1000

const isRealStripeSecret = (k) =>
  typeof k === 'string' &&
  k.startsWith('sk_') &&
  !k.includes('...') &&
  !k.toLowerCase().includes('your')

const clampInt = (n, lo, hi, fallback) => {
  const v = Math.trunc(Number(n))
  if (!Number.isFinite(v)) return fallback
  return Math.min(hi, Math.max(lo, v))
}

// Turn either body kind into one normalised shape:
//   [{ name, quantity, amountPennies }]  — amountPennies is PER UNIT.
// Returns { lineItems, referenceId, idempotencyKey } or { error }.
function buildOrder(payload) {
  if (payload.kind === 'cart') {
    const items = Array.isArray(payload.items) ? payload.items : []
    const lineItems = []
    for (const it of items) {
      const product = PRODUCTS.find((p) => p.id === it?.productId)
      if (!product) continue // unknown id: dropped, not trusted
      const qty = clampInt(it.qty, 1, 20, 1)
      const variant = [it.colourway, it.size].filter(Boolean).join(', ')
      lineItems.push({
        name: variant ? `${product.name} (${variant})` : product.name,
        quantity: qty,
        // Catalogue prices are float GBP (119.99); providers want integer
        // pennies. Math.round, not truncation: 34.99 * 100 is 3498.9999…
        // in IEEE 754 and truncating would undercharge by a penny.
        amountPennies: Math.round(product.price * 100),
      })
    }
    if (lineItems.length === 0) {
      return { error: 'No recognisable items in the cart.' }
    }
    return {
      lineItems,
      referenceId: undefined,
      // Carts have no server-side identity to key on, so a fresh UUID per
      // request. A retried network call may create a second (unpaid) link,
      // which is harmless — links cost nothing until paid.
      idempotencyKey: randomUUID(),
    }
  }

  // Default kind: 'class' (also covers legacy callers that sent no kind).
  const places = clampInt(payload.places, 1, 10, 1)
  return {
    lineItems: [
      {
        name: payload.title || 'Gym class booking',
        quantity: places,
        amountPennies: CLASS_PRICE_PENNIES,
      },
    ],
    referenceId: payload.bookingId || undefined,
    // Keyed on the booking: if the member's network drops and the client
    // retries, Square recognises the repeated key and returns the ORIGINAL
    // payment link instead of minting a duplicate order for the same booking.
    idempotencyKey: payload.bookingId ? `mr-booking-${payload.bookingId}` : randomUUID(),
  }
}

export default async function handler(req, res) {
  if (wrongMethod(req, res, 'POST')) return

  const payload = body(req)
  const squareToken = process.env.SQUARE_ACCESS_TOKEN
  const stripeSecret = process.env.STRIPE_SECRET_KEY

  // Graceful degradation: with no provider configured, tell the client to
  // run the flow in demo mode rather than 500-ing. A paid demo without a
  // merchant account still needs to click through end-to-end.
  if (!realSquareToken(squareToken) && !isRealStripeSecret(stripeSecret)) {
    return res.status(200).json({ demo: true })
  }

  const order = buildOrder(payload)
  if (order.error) {
    return res.status(400).json({ error: order.error })
  }

  const email = typeof payload.email === 'string' ? payload.email : undefined
  const successUrl = typeof payload.successUrl === 'string' ? payload.successUrl : undefined

  try {
    // ── Square (preferred) ─────────────────────────────────────
    if (realSquareToken(squareToken)) {
      const locationId = await resolveLocationId(squareToken)
      const url = await createPaymentLink({
        token: squareToken,
        locationId,
        lineItems: order.lineItems,
        email,
        redirectUrl: successUrl,
        referenceId: order.referenceId,
        idempotencyKey: order.idempotencyKey,
      })
      if (!url) return res.status(502).json({ error: 'Square returned no payment link.' })
      return res.status(200).json({ url })
    }

    // ── Stripe (legacy fallback) ───────────────────────────────
    // Form-encoded with bracketed nested keys, same as the original
    // implementation — but fed from the server-priced line items.
    const params = new URLSearchParams()
    params.set('mode', 'payment')
    // Fallback return addresses use the canonical maderunning.co.uk (same
    // deployment as the Vercel app domain, but the address a customer should
    // see in their browser after paying).
    params.set('success_url', successUrl || 'https://maderunning.co.uk/book?paid=1')
    params.set('cancel_url', payload.cancelUrl || 'https://maderunning.co.uk/book?cancelled=1')
    if (email) params.set('customer_email', email)
    if (order.referenceId) params.set('client_reference_id', order.referenceId)
    order.lineItems.forEach((li, i) => {
      params.set(`line_items[${i}][quantity]`, String(li.quantity))
      params.set(`line_items[${i}][price_data][currency]`, 'gbp')
      params.set(`line_items[${i}][price_data][unit_amount]`, String(li.amountPennies))
      params.set(`line_items[${i}][price_data][product_data][name]`, li.name)
    })
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const data = await r.json()
    if (!r.ok) {
      console.error('[/api/checkout]', data?.error?.message || r.status)
      return res.status(502).json({ error: data?.error?.message || 'Stripe checkout failed.' })
    }
    return res.status(200).json({ url: data.url })
  } catch (err) {
    console.error('[/api/checkout]', err.message)
    const status = err.status === 401 || err.status === 403 ? 502 : 500
    return res.status(status).json({ error: 'Could not start checkout. Please try again.' })
  }
}
