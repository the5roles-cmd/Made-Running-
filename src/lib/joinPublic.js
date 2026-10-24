import { LOCAL_ONLY } from './localOnly'

// ── Does the public site ask people to join? ─────────────────────────────────
//
// Not the same question as CRM_PUBLIC, though they were flipped on the same
// day. That flag decides whether the site offers the WORKSPACE (/login, /app).
// This one decides whether it offers CLUB MEMBERSHIP — the /join form, which
// writes a `records` row through register_runner and never creates an account.
//
// With JOIN_PUBLIC false, every button that said "Get started" or "Join the
// Community" is gone, at the club's instruction (Oct 2026):
//
//   the sticky nav   → the "Get started" CTA. With CRM_PUBLIC also false the
//                      actions row has no children left, so the whole <nav>
//                      stops rendering rather than shipping an empty
//                      navigation landmark for a screen reader to announce.
//   the hero         → the big "Join the Community" button, and the
//                      .tp-hero__ctas row that held nothing else.
//   the quick grid   → the join card. The grid is length-driven now, so three
//                      doors lay out as three columns instead of leaving a
//                      fourth empty.
//   the footer panel → the closing "Join the Community" button. The panel
//                      keeps its heading and paragraph and becomes a sign-off
//                      rather than a pitch.
//   /start, /book    → the same card and the same cross-link, so the phrase
//                      does not survive one hop off the landing page.
//
// What is LEFT for a visitor: the timetable (/book), the coaches page, the
// coach application, the film, the kit, the privacy page. The site still says
// everything about the club; it just stops asking for your details.
//
// ⚠️  THE FORM IS STILL THERE AND STILL WORKS.
// Exactly like CRM_PUBLIC, this hides doors, it does not brick them. /join
// stays routable, register_runner is untouched, and anyone the club sends the
// URL to — in a group chat, on Instagram, on a flyer — fills in the same form
// and lands in the same table. That is the point: the club regains control of
// WHO is asked, instead of the open internet filling the members table.
//
// ⚠️  IT IS NOT A SECURITY BOUNDARY.
// register_runner is a SECURITY DEFINER function that anyone with the public
// anon key can still call directly, as it must be for a no-account form to
// work at all. Hiding the buttons does not change that, and was never meant
// to — what guards the data is RLS plus the function's own validation.
//
// ── One thing outside this flag's reach ─────────────────────────────────────
// public/sitemap.xml listed /join, and a sitemap is a request to a crawler to
// index and rank a page. Hiding every button while still asking Google to
// feature the form would have left it the top result for "join made running" —
// a louder door than the one we took down. The entry was removed by hand, so
// if you flip this true you must put it back; XML cannot read a JS constant.
//
// ── Asking locally, silent on the website (Oct 2026) ────────────────────────
// Everything above describes the PUBLIC site and still does. The ask had to
// stay somewhere runnable, so this follows LOCAL_ONLY: on a dev server all
// four buttons are back, the card is back in the grid and the grid widens to
// hold it; in every build Vercel serves, none of it is in the bundle.
//
// The sitemap is the one piece that cannot follow a flag — see the paragraph
// above. Static XML has no idea which machine is serving it, and a dev server
// is not what Google reads, so /join simply stays out of it. That is correct
// for the only reader that matters.
//
// To ask the PUBLIC for members again, make this `true` outright — the four
// buttons come back and both grids size themselves from the array — and then
// restore the sitemap entry by hand.
export const JOIN_PUBLIC = LOCAL_ONLY
