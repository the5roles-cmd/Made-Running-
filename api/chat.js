// POST /api/chat — the Assistant screen.
// Body:    { messages: [{ role, content }], context?: { app, industry } }
// Returns: { reply: string }
//
// The API key lives only in this process. It is read from the Vercel
// environment at invocation time and never reaches the client bundle —
// which is the entire reason this proxy exists rather than calling
// Anthropic from the browser.
import Anthropic from '@anthropic-ai/sdk'
import { MODEL, realKey, textOf, body, wrongMethod } from './_ai.js'

// Module scope, not handler scope: Vercel keeps the container warm between
// requests, so a hoisted client is reused instead of rebuilt per call. It is
// lazy because constructing it eagerly would throw at import time on a
// deployment with no key, turning a clean 503 into an unexplained crash.
let client = null
const anthropic = (apiKey) => (client ??= new Anthropic({ apiKey }))

export default async function handler(req, res) {
  if (wrongMethod(req, res, 'POST')) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!realKey(apiKey)) {
    return res.status(503).json({
      error:
        'ANTHROPIC_API_KEY is not set on this deployment. Add it in Vercel → Settings → Environment Variables, then redeploy.',
    })
  }

  const { messages = [], context = {} } = body(req)
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
    const response = await anthropic(apiKey).messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
    })
    res.status(200).json({ reply: textOf(response) })
  } catch (err) {
    console.error('[/api/chat]', err.message)
    res.status(500).json({ error: err.message || 'Chat request failed.' })
  }
}
