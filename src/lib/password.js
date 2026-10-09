// One number, three screens. The password minimum appears wherever a NEW
// password is chosen — signup (Login.jsx), recovery (ResetPassword.jsx) and
// change-password (Settings.jsx) — and QA (Oct 2026) found it at 6, "weak
// for real auth; bump to 8+". Hoisting it here means the next bump is one
// edit, not a three-file grep.
//
// Two rules the screens must follow:
//
//   1. This minimum applies ONLY to fields that set a new password. The
//      sign-in field gets no client-side minimum at all: members who chose
//      a 6- or 7-character password before this change still have one, and
//      a minLength on the sign-in input would make the browser refuse their
//      perfectly valid credentials. Existing passwords are the server's to
//      judge.
//
//   2. The client check is UX, not security — anyone with DevTools can
//      strip it. The enforcing copy of this number lives in the Supabase
//      dashboard (Authentication → Providers → Email → minimum password
//      length, default 6), which must be raised to match. That is a
//      dashboard setting, not SQL, so it cannot ship from this repo.
export const MIN_PASSWORD_LENGTH = 8

// The shared refusal line, so every screen complains in the same voice.
export const PASSWORD_TOO_SHORT = `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
