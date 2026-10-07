// ============================================================
// Shared helpers for the Vercel serverless API routes.
//
// Files inside `api/` whose name begins with `_` are NOT turned into
// routes by Vercel — they are plain modules the real handlers import.
// That is the only reason this can sit here rather than in server/.
//
// THIS FILE MIRRORS server/index.cjs (the local Express dev proxy).
// Same contract, two runtimes: `npm run dev` serves it from a long-lived
// Express process on API_PORT; production serves it from per-request
// serverless functions. If you change the model, a system prompt, or the
// key validation, change it in BOTH or local and prod will disagree.
// ============================================================

export const MODEL = 'claude-sonnet-4-6'

// Reject placeholder strings like "sk-ant-..." or "your-key-here". Without
// this an environment that was half-configured (someone pasted the example
// value) fails deep inside the SDK with an opaque 401. With it, the route
// answers 503 and says exactly which variable is missing.
export const realKey = (k) =>
  typeof k === 'string' &&
  k.length > 0 &&
  !k.includes('...') &&
  !k.toLowerCase().startsWith('your')

// Claude returns an array of content blocks (text, tool_use, thinking…).
// Only the text ones are meant for the user.
export const textOf = (response) =>
  response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

// Vercel parses the body for us, but only when Content-Type is
// application/json. Anything else arrives as a raw string or undefined,
// so normalise rather than trusting req.body to already be an object.
export function body(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

// Express matched on method for us (app.post vs app.get); a bare serverless
// handler receives every method, so each route has to check for itself.
// Returns true when it has already answered and the caller should bail.
export function wrongMethod(req, res, allowed) {
  if (req.method === allowed) return false
  res.setHeader('Allow', allowed)
  res.status(405).json({ error: `Method ${req.method} not allowed.` })
  return true
}
