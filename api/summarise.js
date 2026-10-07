// POST /api/summarise — condenses a record's notes/history.
// Body:    { text: string }
// Returns: { summary: string }
import Anthropic from '@anthropic-ai/sdk'
import { MODEL, realKey, textOf, body, wrongMethod } from './_ai.js'

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

  const { text = '' } = body(req)
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required.' })
  }

  try {
    const response = await anthropic(apiKey).messages.create({
      model: MODEL,
      max_tokens: 256,
      system:
        'You are a neutral summariser. Write 2–3 sentences that capture the key facts, status, and any notable risks or opportunities in the text provided. Do not add opinions or recommendations. Use plain prose.',
      // Hard cap the input: a pathological record with thousands of notes
      // would otherwise blow the context window and 400 from the API.
      messages: [{ role: 'user', content: text.slice(0, 20000) }],
    })
    res.status(200).json({ summary: textOf(response) })
  } catch (err) {
    console.error('[/api/summarise]', err.message)
    res.status(500).json({ error: err.message || 'Summarise request failed.' })
  }
}
