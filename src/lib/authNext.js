// ── Post-login destination ──────────────────────────────────────────────────
// Every public door on the landing page routes through /login?next=<path>, so
// exactly one page owns the question "are you signed in?" while each door
// keeps its own destination. Two rules make that safe and predictable.
//
// 1. `next` is only ever a same-origin PATH. A full URL is rejected even when
//    it is our own. Honouring "?next=https://evil.example" would turn the
//    login page into an open redirect: an attacker sends a link that really
//    is sutekwellness.com, the victim really does sign in, and the page then
//    bounces them somewhere else with a trusted-looking journey behind them.
//    Refusing anything that is not a bare path is the cheapest complete fix —
//    it needs no allowlist to maintain as routes are added.
//
// 2. Anything unusable falls back to /app rather than throwing. A malformed
//    `next` is a broken link, not a reason to strand someone who has just
//    typed their password correctly.

const FALLBACK = '/app'

export function safeNext(raw, fallback = FALLBACK) {
  if (!raw) return fallback

  let value
  try {
    value = decodeURIComponent(raw)
  } catch {
    // A malformed %-escape (e.g. "%E0%A4%A") throws a URIError.
    return fallback
  }

  // Must be root-relative. "//evil.example" is protocol-relative: it starts
  // with "/" but the browser resolves it to a different origin, so it is
  // excluded by name rather than caught by the startsWith('/') test. Some
  // browsers normalise backslashes to forward slashes, which makes "/\evil"
  // another way to spell the same trick.
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback

  return value
}

// Build the href a public door points at. Kept here next to safeNext so the
// encode and the decode can never drift apart.
export function loginHref(dest) {
  return `/login?next=${encodeURIComponent(dest)}`
}
