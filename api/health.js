// GET /api/health — always 200. The frontend polls this to render the
// "Claude connected" / "Embeddings connected" badges, so it must answer
// even when nothing is configured; the booleans carry the bad news.
//
// Deliberately imports no SDK. It is the most-called route (every page
// load) and there is nothing here worth a cold start for.
import { realKey } from './_ai.js'

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    claude: realKey(process.env.ANTHROPIC_API_KEY),
    voyage: realKey(process.env.VOYAGE_API_KEY),
  })
}
