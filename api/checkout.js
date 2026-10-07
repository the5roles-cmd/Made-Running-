// POST /api/checkout — create a Stripe Checkout session for a gym booking.
//
// Body:    { bookingId, amountPennies, title, email, successUrl, cancelUrl }
// Returns: { url }            → redirect the member here to pay
//          { demo: true }     → no Stripe key on this deployment; the
//                               front-end simulates a successful payment
//                               so the booking flow is still demonstrable.
//
// Deliberately NO `stripe` npm dependency: we POST form-encoded straight
// to api.stripe.com. That keeps the client bundle untouched, avoids a
// cold-start SDK import, and means one fewer package to trust. The secret
// key is read from the Vercel environment at call time and never reaches
// the browser — the whole reason this runs server-side.
import { body, wrongMethod } from './_ai.js'

const isRealSecret = (k) =>
  typeof k === 'string' &&
  k.startsWith('sk_') &&
  !k.includes('...') &&
  !k.toLowerCase().includes('your')

export default async function handler(req, res) {
  if (wrongMethod(req, res, 'POST')) return

  const secret = process.env.STRIPE_SECRET_KEY

  const { bookingId, amountPennies, title, email, successUrl, cancelUrl } = body(req)

  // Graceful degradation: with no key configured, tell the client to run
  // the flow in demo mode rather than 500-ing. A paid demo without a
  // merchant account still needs to click through end-to-end.
  if (!isRealSecret(secret)) {
    return res.status(200).json({ demo: true })
  }

  if (!amountPennies || amountPennies < 1) {
    return res.status(400).json({ error: 'A positive amount is required to start checkout.' })
  }

  // Stripe's API takes x-www-form-urlencoded with bracketed nested keys.
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', successUrl || 'https://sutekwellness.com/book?paid=1')
  params.set('cancel_url', cancelUrl || 'https://sutekwellness.com/book?cancelled=1')
  if (email) params.set('customer_email', email)
  if (bookingId) params.set('client_reference_id', bookingId)
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'gbp')
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(amountPennies)))
  params.set('line_items[0][price_data][product_data][name]', title || 'Gym class booking')

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
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
    return res.status(500).json({ error: err.message || 'Checkout request failed.' })
  }
}
