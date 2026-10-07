// POST /api/match — turns text into an embedding vector.
// Body:    { text: string }
// Returns: { embedding: number[] }
//
// Stateless by design: no ranking and no DB writes happen here. The caller
// takes the vector and runs the pgvector similarity search itself, under
// RLS, so this route can never become a way to read another org's rows.
import { VoyageAIClient } from 'voyageai'
import { realKey, body, wrongMethod } from './_ai.js'

let client = null
const voyage = (apiKey) => (client ??= new VoyageAIClient({ apiKey }))

export default async function handler(req, res) {
  if (wrongMethod(req, res, 'POST')) return

  const apiKey = process.env.VOYAGE_API_KEY
  if (!realKey(apiKey)) {
    return res.status(503).json({
      error:
        'VOYAGE_API_KEY is not set on this deployment. Add it in Vercel → Settings → Environment Variables, then redeploy.',
    })
  }

  const { text = '' } = body(req)
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required.' })
  }

  try {
    const out = await voyage(apiKey).embed({
      input: [text.slice(0, 30000)],
      model: 'voyage-3.5',
    })
    res.status(200).json({ embedding: out.data[0].embedding })
  } catch (err) {
    console.error('[/api/match]', err.message)
    res.status(500).json({ error: err.message || 'Embed request failed.' })
  }
}
