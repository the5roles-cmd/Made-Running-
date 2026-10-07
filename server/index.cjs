// ============================================================
// CRM Template — AI proxy server (stateless, CommonJS)
// Keys live here ONLY — the browser never sees them.
//
// Gotchas:
//   • Env is cached at boot: changing .env.local requires restart.
//   • Use API_PORT, not PORT (avoid conflict with Vite's default 3000).
//   • dotenv must point one level UP from __dirname (server/ → root).
//   • voyageai named export is VoyageAIClient (not VoyageAI).
// ============================================================

'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const express = require('express')
// @anthropic-ai/sdk ships CJS interop — the class is the .default export.
// Destructuring handles both `module.exports = Anthropic` and `module.exports.default = Anthropic`.
const { default: Anthropic } = require('@anthropic-ai/sdk')
const { VoyageAIClient } = require('voyageai')

// ── Key validation ──────────────────────────────────────────
// Reject placeholder strings like "sk-ant-..." or "your-key-here"
// so the server starts clean and health() is accurate.
const realKey = (k) =>
  k && typeof k === 'string' && !k.includes('...') && !k.toLowerCase().startsWith('your')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

// Clients are null when keys are absent — never throw at startup.
const anthropic = realKey(ANTHROPIC_API_KEY)
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null
const voyage = realKey(VOYAGE_API_KEY)
  ? new VoyageAIClient({ apiKey: VOYAGE_API_KEY })
  : null

const MODEL = 'claude-sonnet-4-6'
const PORT = process.env.API_PORT || 8797

// ── App ─────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '4mb' }))

// ── Utility: strip markdown code fences + find first JSON object ─
// Keeps the robust parse logic available even if not all routes need it yet.
function parseJson(raw) {
  if (!raw) return null
  // Strip ```json ... ``` fences
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  // Slice from first { to last }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

// ── GET /api/health ─────────────────────────────────────────
// Always 200 — the frontend uses this to render badge states.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claude: !!anthropic, voyage: !!voyage })
})

// ── POST /api/chat ──────────────────────────────────────────
// Body: { messages: [{role, content}], context?: { app, industry, ... } }
// Returns: { reply: string }
app.post('/api/chat', async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY not set. Add it to .env.local and restart.',
    })
  }

  const { messages = [], context = {} } = req.body

  const appName = context.app || 'this CRM'
  const industry = context.industry || 'your industry'

  const system = [
    `You are a helpful assistant embedded in ${appName}, a CRM platform used in ${industry}.`,
    'Your role is to help the team understand their records, draft communications, summarise account history, and work through pipeline decisions.',
    'Be concise. When the user provides CRM data (records, notes, pipeline stages), ground your answers in that data and cite specific details.',
    "If you don't have the data needed to answer accurately, say so — never invent client details, dates, or figures.",
    'Respond in plain prose. Avoid unnecessary bullet lists unless the user asks for a list.',
  ].join(' ')

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
    })
    // Join all text content blocks into a single string
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    res.json({ reply })
  } catch (err) {
    console.error('[/api/chat]', err.message)
    res.status(500).json({ error: err.message || 'Chat request failed.' })
  }
})

// ── POST /api/summarise ─────────────────────────────────────
// Body: { text: string }
// Returns: { summary: string }
app.post('/api/summarise', async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY not set. Add it to .env.local and restart.',
    })
  }

  const { text = '' } = req.body
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required.' })
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      system:
        'You are a neutral summariser. Write 2–3 sentences that capture the key facts, status, and any notable risks or opportunities in the text provided. Do not add opinions or recommendations. Use plain prose.',
      messages: [{ role: 'user', content: text.slice(0, 20000) }],
    })
    const summary = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    res.json({ summary })
  } catch (err) {
    console.error('[/api/summarise]', err.message)
    res.status(500).json({ error: err.message || 'Summarise request failed.' })
  }
})

// ── POST /api/match ─────────────────────────────────────────
// Body: { text: string }
// Returns: { embedding: number[] }
// The embedding is used by the caller for pgvector similarity search;
// no ranking or DB writes happen here (stateless by design).
app.post('/api/match', async (req, res) => {
  if (!voyage) {
    return res.status(503).json({
      error: 'VOYAGE_API_KEY not set. Add it to .env.local and restart.',
    })
  }

  const { text = '' } = req.body
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required.' })
  }

  try {
    const out = await voyage.embed({
      input: [text.slice(0, 30000)],
      model: 'voyage-3.5',
    })
    res.json({ embedding: out.data[0].embedding })
  } catch (err) {
    console.error('[/api/match]', err.message)
    res.status(500).json({ error: err.message || 'Embed request failed.' })
  }
})

// ── POST /api/checkout ──────────────────────────────────────
// Local-dev mirror of api/checkout.js (Vercel serverless). Same contract,
// two runtimes — keep them in sync. Square first, Stripe as legacy
// fallback, { demo: true } when neither is configured so the booking flow
// still completes on screen without a merchant account.
//
// The client NEVER sends an amount — see the long comment in
// api/checkout.js. Body kinds:
//   { kind: 'class', bookingId, title, places, email, successUrl }
//   { kind: 'cart',  items: [{ productId, colourway, size, qty }], email, successUrl }
//
// This file is CommonJS but _square.js and products.js are ES modules;
// require() cannot load ESM, dynamic import() can. Loaded lazily on the
// first checkout call and cached — zero cost for the AI-only workflows
// this server mostly exists for.
const { pathToFileURL } = require('url')
const { randomUUID } = require('crypto')

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const realStripe = (k) =>
  typeof k === 'string' && k.startsWith('sk_') && !k.includes('...') && !k.toLowerCase().includes('your')

const CLASS_PRICE_PENNIES = 1000 // every class is £10, set by the club

let checkoutDepsPromise = null
function checkoutDeps() {
  if (!checkoutDepsPromise) {
    checkoutDepsPromise = Promise.all([
      import(pathToFileURL(path.join(__dirname, '..', 'api', '_square.js')).href),
      import(pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'products.js')).href),
    ]).then(([square, products]) => ({ ...square, PRODUCTS: products.PRODUCTS }))
  }
  return checkoutDepsPromise
}

const clampInt = (n, lo, hi, fallback) => {
  const v = Math.trunc(Number(n))
  if (!Number.isFinite(v)) return fallback
  return Math.min(hi, Math.max(lo, v))
}

// Same normalisation as api/checkout.js buildOrder() — keep in sync.
function buildOrder(payload, PRODUCTS) {
  if (payload.kind === 'cart') {
    const items = Array.isArray(payload.items) ? payload.items : []
    const lineItems = []
    for (const it of items) {
      const product = PRODUCTS.find((p) => p.id === (it && it.productId))
      if (!product) continue
      const qty = clampInt(it.qty, 1, 20, 1)
      const variant = [it.colourway, it.size].filter(Boolean).join(', ')
      lineItems.push({
        name: variant ? `${product.name} (${variant})` : product.name,
        quantity: qty,
        amountPennies: Math.round(product.price * 100),
      })
    }
    if (lineItems.length === 0) return { error: 'No recognisable items in the cart.' }
    return { lineItems, referenceId: undefined, idempotencyKey: randomUUID() }
  }
  const places = clampInt(payload.places, 1, 10, 1)
  return {
    lineItems: [
      { name: payload.title || 'Gym class booking', quantity: places, amountPennies: CLASS_PRICE_PENNIES },
    ],
    referenceId: payload.bookingId || undefined,
    idempotencyKey: payload.bookingId ? `mr-booking-${payload.bookingId}` : randomUUID(),
  }
}

app.post('/api/checkout', async (req, res) => {
  const payload = req.body || {}
  const squareToken = process.env.SQUARE_ACCESS_TOKEN
  const { realSquareToken, resolveLocationId, createPaymentLink, PRODUCTS } = await checkoutDeps()

  if (!realSquareToken(squareToken) && !realStripe(STRIPE_SECRET_KEY)) {
    return res.json({ demo: true })
  }

  const order = buildOrder(payload, PRODUCTS)
  if (order.error) return res.status(400).json({ error: order.error })

  const email = typeof payload.email === 'string' ? payload.email : undefined
  const successUrl = typeof payload.successUrl === 'string' ? payload.successUrl : undefined

  try {
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
      return res.json({ url })
    }

    // Stripe legacy fallback — fed from the server-priced line items.
    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('success_url', successUrl || 'http://localhost:4970/book?paid=1')
    params.set('cancel_url', payload.cancelUrl || 'http://localhost:4970/book?cancelled=1')
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
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'Stripe checkout failed.' })
    res.json({ url: data.url })
  } catch (err) {
    console.error('[/api/checkout]', err.message)
    const status = err.status === 401 || err.status === 403 ? 502 : 500
    res.status(status).json({ error: 'Could not start checkout. Please try again.' })
  }
})

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API up on :${PORT}  (claude:${!!anthropic}  voyage:${!!voyage})`)
})
