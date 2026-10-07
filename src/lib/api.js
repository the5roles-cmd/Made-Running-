// ============================================================
// Thin client wrappers around the /api/* proxy (server/index.cjs).
// The browser NEVER holds AI keys — it only calls same-origin /api,
// which Vite proxies to the Express server.
// ============================================================

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// Chat with the grounded assistant. `context` = records/pipeline snapshot
// the server injects into the system prompt so answers cite real data.
export const chat = (messages, context) => post('/api/chat', { messages, context })

// Summarise a record (post-save enrichment). Returns { summary }.
export const summarise = (text) => post('/api/summarise', { text })

// Embed text → returns { embedding } only; ranking stays in Postgres.
export const embedText = (text) => post('/api/match', { text })

// Health probe: { ok, claude, voyage } — used by SetupNotice / StyleGuide.
export const health = async () => {
  const res = await fetch('/api/health')
  return res.json().catch(() => ({ ok: false }))
}
