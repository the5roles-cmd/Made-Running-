// ============================================================
// invites.js — client-side invite composition for Made Running.
// Pure module: no React, no Supabase, no network calls.
// All invite delivery goes through the user's own installed
// apps (mail / Messages / WhatsApp) via URL schemes — nothing
// is sent automatically on their behalf.
// ============================================================

// ── Channel metadata ─────────────────────────────────────────

/**
 * The three supported invite channels.
 * Each entry drives both the channel-chooser UI and the URL-
 * building logic in composeInvite().
 *
 * @type {Array<{ value: string, label: string, placeholder: string, hint: string }>}
 */
export const CONTACT_METHODS = [
  {
    value: 'email',
    label: 'Email',
    placeholder: 'friend@example.co.uk',
    hint: "Your default mail app will open with the message ready to go — you send it when you're ready. Nothing goes out automatically.",
  },
  {
    value: 'mobile',
    label: 'Mobile',
    placeholder: '07700 900123',
    hint: "Your Messages app will open with the invite pre-filled — you tap send. Made Running never sees or sends the message.",
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    placeholder: '07700 900123',
    hint: "WhatsApp will open in your browser or app with the message ready — you send it yourself. Nothing is sent on your behalf.",
  },
]

// ── Auto-detection (STUB — owner to implement) ───────────────

/**
 * Attempt to infer the contact method from a raw string typed
 * by the user. Returns both the detected method and a normalised
 * version of the value, plus a validity flag.
 *
 * THIS FUNCTION IS A DOCUMENTED STUB. The project owner will
 * implement the body. Do not add logic here until they do.
 *
 * CONTRACT
 * --------
 * @param {string} _raw - Whatever the user typed (email address,
 *   UK phone number in any common format, international number,
 *   etc.). May have leading/trailing whitespace.
 *
 * @returns {{ method: 'email'|'mobile'|'whatsapp'|null, normalised: string, valid: boolean }}
 *   - method:     detected channel, or null if the input is
 *                 unrecognisable.
 *   - normalised: cleaned-up version ready to pass to composeInvite().
 *                 For email: trimmed + lower-cased.
 *                 For mobile / whatsapp: E.164-ish digits only, with
 *                 the UK country code resolved so that 07700 900123,
 *                 +44 7700 900123, and 447700900123 all collapse to
 *                 the same string (447700900123). Use normaliseUkNumber()
 *                 exported below.
 *   - valid:      true only when the value looks well-formed enough
 *                 to submit (e.g. a syntactically valid email, or a
 *                 UK mobile with 10 digits after the country code).
 *
 * GENUINE AMBIGUITY the owner must resolve:
 *   A WhatsApp handle IS a phone number. A bare UK mobile like
 *   07700 900123 is structurally identical whether the user wants
 *   to send via SMS or WhatsApp — the shape alone cannot distinguish
 *   them. The function must choose a strategy:
 *     (a) always prefer 'mobile' for bare numbers, letting the user
 *         switch channel manually; or
 *     (b) inspect the channel the user has already selected via the
 *         UI and pass it in as a second param; or
 *     (c) return { method: null } for bare numbers and force explicit
 *         channel selection.
 *   The current page implementation uses the EXPLICITLY SELECTED
 *   channel from state, so auto-detection is only additive (validates
 *   and normalises). Once this function is implemented the page can
 *   call it to validate before enabling the primary action button.
 *
 * // TODO(owner): implement the detection / normalisation body.
 */
export function detectContactMethod(_raw) {
  // Placeholder — returns a safe default so the module imports cleanly.
  // _raw is intentionally unused; the owner will implement the body.
  return { method: null, normalised: '', valid: false }
}

// ── UK phone normalisation ───────────────────────────────────

/**
 * Normalise a UK phone number to digits only, suitable for wa.me URLs.
 *
 * Rules:
 *   - Strips spaces, dashes, brackets, and a leading '+'.
 *   - Converts a leading '0' to '44' (UK country code prefix).
 *   - Leaves an existing '44' prefix unchanged.
 *   - Returns '' if the input contains no digits at all.
 *
 * Examples:
 *   '07700 900123'    -> '447700900123'
 *   '+44 7700 900123' -> '447700900123'
 *   '447700900123'    -> '447700900123'
 *   'not a number'    -> ''
 *
 * @param {string} raw
 * @returns {string} digits only
 */
export function normaliseUkNumber(raw) {
  if (!raw) return ''
  // Remove the leading + if present.
  let s = String(raw).replace(/^\+/, '')
  // Strip the redundant trunk-prefix notation `(0)` that some UK callers
  // write after the country code — e.g. +44 (0)7700 900123.
  // This must happen before digit-only stripping so `(0)` isn't mistaken
  // for a meaningful digit.
  s = s.replace(/\(0\)/, '')
  // Strip all remaining non-digit characters (spaces, dashes, brackets).
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return ''
  // Leading '0' means local UK format — replace with country code.
  if (digits.startsWith('0')) return '44' + digits.slice(1)
  // Already has the 44 prefix (or some other country code) — leave alone.
  return digits
}

// ── Referral code generation ─────────────────────────────────

/**
 * Generate a short, human-readable, URL-safe referral code from a
 * seed string (typically the inviting user's ID or email address).
 *
 * The code is deterministic — the same seed always produces the same
 * code — so the club can attribute referrals to the correct member
 * even if they share the link multiple times.
 *
 * Alphabet: uppercase letters A-Z plus digits 2-9.
 * We deliberately exclude:
 *   O (looks like 0), 0 (looks like O)
 *   I (looks like 1 or l), 1 (looks like I or l), L (looks like 1 or I)
 * This is the same convention as Crockford Base32 — it prevents
 * transcription errors when a member reads the code aloud or re-types
 * it from a printed flyer.
 *
 * @param {string} seed - e.g. user.id or user.email
 * @returns {string} 6-character uppercase alphanumeric code
 */
export function makeRefCode(seed) {
  // Crockford-style alphabet: 32 characters, ambiguous glyphs removed.
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  // Simple deterministic hash: djb2-style, good enough for short codes.
  let h = 5381
  const s = String(seed)
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    h = h >>> 0 // keep unsigned 32-bit
  }
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[h % ALPHABET.length]
    // Shift the hash to derive each character independently.
    h = ((h >>> 5) ^ (h << 3)) >>> 0
  }
  return code
}

// ── Invite URL ───────────────────────────────────────────────

/**
 * Build the public join URL that the invited friend will land on.
 *
 * @param {string} origin  - e.g. window.location.origin
 * @param {string} refCode - from makeRefCode()
 * @returns {string}
 */
export function buildInviteUrl(origin, refCode) {
  return `${origin}/join?ref=${encodeURIComponent(refCode)}`
}

// ── Message copy ─────────────────────────────────────────────

/**
 * Compose the DEFAULT invite message copy.
 * Returns { subject, body } — both are plain text, no HTML, no emojis.
 * The body is short enough to feel like a real personal message.
 *
 * This is a starting point, not the final text: AddFriend.jsx lets the
 * member edit both fields before sending, and passes the result back into
 * composeInvite() as overrides. Keep this copy generic enough to be a good
 * default and personal enough that sending it unedited is not embarrassing.
 *
 * @param {{ clubName: string, senderName: string, inviteUrl: string, friendName?: string }} opts
 * @returns {{ subject: string, body: string }}
 */
export function inviteMessage({ clubName, senderName, inviteUrl, friendName }) {
  const from = senderName || 'One of our members'
  const to = (friendName || '').trim()
  const subject = `Come and run with us at ${clubName}`
  const body = [
    // Greeting uses the friend's name when it's been typed. "Hi Jamie, it's
    // Nelson" is a message from a person; "Hi, it's Nelson" is a broadcast,
    // and the whole point of this page is that it isn't one.
    to
      ? `Hi ${to}, it's ${from} — I run with ${clubName} and I think you'd love it.`
      : `Hi, it's ${from} — I run with ${clubName} and I think you'd love it.`,
    `We're a community running club with chapters across London, Manchester, Birmingham and Bristol. No one gets left behind.`,
    `You can sign up here: ${inviteUrl}`,
  ].join('\n\n')
  return { subject, body }
}

// ── Invite URL composer ──────────────────────────────────────

/**
 * Build the OS-level URL that opens the right app with the invite
 * message pre-filled. Returns null if the inputs are not usable.
 *
 * Scheme rules:
 *   email    -> mailto:{value}?subject={subject}&body={body}
 *   mobile   -> sms:{e164}?&body={body}
 *              (the ?& form works on both iOS and Android;
 *               a bare ?body= is silently dropped by iOS)
 *   whatsapp -> https://wa.me/{e164digits}?text={body}
 *              (wa.me requires no leading +, no spaces — just digits)
 *
 * All query-string values are encodeURIComponent()'d.
 *
 * `subject` and `body` are OPTIONAL overrides. When omitted, the default
 * copy from inviteMessage() is used; when supplied, they are used verbatim.
 * This is what makes the message on AddFriend.jsx editable — the text the
 * member sees in the box is the text that reaches their mail app, rather
 * than a preview of something regenerated behind their back at send time.
 *
 * `??` rather than `||` on purpose: an empty string is a legitimate
 * override (someone deliberately clearing the subject line), and `||` would
 * silently reinstate the default and overrule them.
 *
 * @param {{ method: string, value: string, clubName: string, senderName: string, inviteUrl: string, friendName?: string, subject?: string, body?: string }} opts
 * @returns {{ href: string, actionLabel: string } | null}
 */
export function composeInvite({
  method,
  value,
  clubName,
  senderName,
  inviteUrl,
  friendName,
  subject: subjectOverride,
  body: bodyOverride,
}) {
  if (!method || !value || !value.trim() || !inviteUrl) return null

  const fallback = inviteMessage({ clubName, senderName, inviteUrl, friendName })
  const subject = subjectOverride ?? fallback.subject
  const body = bodyOverride ?? fallback.body

  if (method === 'email') {
    const v = value.trim().toLowerCase()
    if (!v) return null
    // The address goes in the mailto PATH, not a query value, so it must not
    // be encodeURIComponent()'d: that turns the "@" into %40, and per RFC 6068
    // "@" is a delimiter in an addr-spec rather than data. Gmail and Apple Mail
    // decode it anyway — which is why this survives casual testing — but some
    // desktop clients treat the result as malformed and open a blank compose
    // window. Only the query VALUES (subject, body) get encoded.
    const href =
      `mailto:${v}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`
    return { href, actionLabel: 'Open email' }
  }

  if (method === 'mobile') {
    const digits = normaliseUkNumber(value)
    if (!digits) return null
    // Use sms: scheme; ?& is the cross-platform body separator.
    const href = `sms:+${digits}?&body=${encodeURIComponent(body)}`
    return { href, actionLabel: 'Open Messages' }
  }

  if (method === 'whatsapp') {
    const digits = normaliseUkNumber(value)
    if (!digits) return null
    // wa.me uses digits only — no + prefix, no spaces.
    const href = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`
    return { href, actionLabel: 'Open WhatsApp' }
  }

  return null
}
