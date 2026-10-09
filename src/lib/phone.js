// Shape-check for a phone field. "abc" was accepted and stored as a phone
// number (QA, Oct 2026) — a coach trying to ring that member on race morning
// gets nothing. Deliberately locale-agnostic: this club runs in three
// countries, so "looks like a UK mobile" would reject real members. Strip the
// characters people legitimately type (spaces, dots, dashes, brackets), then
// require 7–15 digits with an optional +: the E.164 length envelope.
//
// Empty passes — whether the field may BE empty is the caller's rule, not
// this function's. JoinRunner leaves it optional; BookGym requires a phone
// only when no email was given (a booking with neither contact cannot be
// told about a cancellation — QA, Oct 2026).
//
// Born in JoinRunner.jsx; hoisted here the day BookGym became the second
// call site, so the two forms cannot drift apart on what "a phone number"
// means.
export function phoneLooksValid(value) {
  const v = (value || '').trim()
  if (!v) return true
  const bare = v.replace(/[\s().-]/g, '')
  return /^\+?\d{7,15}$/.test(bare)
}
