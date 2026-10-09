// Privacy — /privacy. The plain-English privacy notice (QA, Oct 2026: the
// site collected names, phones, emergency contacts and payment choices with
// no privacy policy anywhere).
//
// EVERY claim on this page is checked against what the code actually does —
// it describes the three real forms (join, class booking, coach application),
// names Square as the card handler (true: checkout is a Square-hosted page,
// this site never renders a card field), and offers the club's one real
// channel (Instagram) for questions and deletions. It deliberately does NOT
// invent legal apparatus — no ICO registration number, no named DPO, no
// cookie-consent theatre for cookies the site does not set. If the club
// formalises any of that, add it here; never ahead of it being true.
//
// Styled like ManageBooking (light paper, one card column): both are quiet
// "service" pages a member reaches with a task in mind, not marketing.
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { tenant } from '../lib/theme'

const SECTIONS = [
  {
    title: 'What we collect, and where',
    body: [
      'Three forms on this site collect personal details, and each one tells you at the point you fill it in:',
    ],
    items: [
      'Joining the community (/join): your name, and — if you choose to give them — email, phone, your city, and an emergency contact. Stored in the club\u2019s own member system so coaches know who is coming and who to call if something happens on a run.',
      'Booking a class (/book): your name, contact details, who the booking is for, and how you\u2019d like to pay. Used to hold your place and check you in on the day.',
      'Applying to coach: the experience, qualifications and contact details you put in the application, read by the Made Running team to assess your application.',
    ],
  },
  {
    title: 'Payments',
    body: [
      'Card payments are taken by Square on Square\u2019s own secure checkout page. Your card number is typed into Square, not into this site — we never see it and never store it. We keep only the booking it relates to and whether it has been paid.',
    ],
  },
  {
    title: 'What we never do',
    body: [
      'Your details are used to run sessions, classes and check-ins, and to contact you about them. We don\u2019t sell them, we don\u2019t pass them to advertisers, and we don\u2019t sign you up to anything you didn\u2019t ask for.',
    ],
  },
  {
    title: 'Cookies and tracking',
    body: [
      'This site sets no advertising or analytics cookies. Your browser\u2019s local storage is used for small conveniences only — like remembering which door you picked on the start screen — and that data never leaves your device.',
    ],
  },
  {
    title: 'Seeing, fixing or deleting your details',
    body: [
      'Your details are yours. Message the club on Instagram (@made.running) and we\u2019ll show you what we hold, correct it, or delete it — including removing you from the member list entirely. Class bookings can be cancelled any time from the manage-booking link on your confirmation.',
    ],
  },
]

export default function Privacy() {
  return (
    <div className="pv">
      <style>{PV_CSS}</style>

      <header className="pv__bar">
        <Link to="/" className="pv__back">
          <ArrowLeft size={15} aria-hidden="true" />
          Home
        </Link>
        <span className="pv__brand">{tenant.name}</span>
      </header>

      <main className="pv__wrap">
        <p className="pv__eyebrow">Your details</p>
        <h1 className="pv__title">How {tenant.name} looks after your information</h1>
        <p className="pv__lede">
          Short version: we keep what you give us, we use it to run sessions
          and classes, and you can ask for it back or have it deleted any
          time. The longer version is below, in plain English.
        </p>

        {SECTIONS.map((s) => (
          <section className="pv__sec" key={s.title}>
            <h2 className="pv__h2">{s.title}</h2>
            {s.body.map((p) => (
              <p className="pv__p" key={p.slice(0, 32)}>{p}</p>
            ))}
            {s.items && (
              <ul className="pv__list">
                {s.items.map((it) => (
                  <li key={it.slice(0, 32)}>{it}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="pv__fine">
          Questions about any of this? Message{' '}
          <a
            href="https://www.instagram.com/made.running/"
            target="_blank"
            rel="noopener noreferrer"
          >
            @made.running
          </a>{' '}
          and a human will answer.
        </p>
      </main>
    </div>
  )
}

const PV_CSS = `
.pv {
  min-height: 100vh;
  min-height: 100svh;
  background: var(--paper, #efefef);
  color: var(--ink, #1c1c1c);
}
.pv__bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 18px 20px;
  max-width: 680px; margin: 0 auto;
}
.pv__back {
  display: inline-flex; align-items: center; gap: 7px;
  min-height: 44px; padding: 10px 2px;
  font-size: 13px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 66%, transparent);
  text-decoration: none;
}
.pv__back:hover { color: var(--ink); }
.pv__brand {
  font-family: var(--font-display); font-weight: 700;
  font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase;
  /* 72% — the AA-checked value from ManageBooking's identical bar. */
  color: color-mix(in srgb, var(--ink) 72%, transparent);
}

.pv__wrap { max-width: 680px; margin: 0 auto; padding: 16px 20px 90px; }

.pv__eyebrow {
  margin: 0 0 10px;
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 62%, transparent);
}
.pv__title {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(28px, 6vw, 40px); line-height: 1.08;
  letter-spacing: -0.015em;
  margin: 0 0 16px;
  color: var(--ink);
}
.pv__lede {
  margin: 0 0 34px;
  font-size: 16.5px; line-height: 1.62;
  max-width: 58ch;
  color: color-mix(in srgb, var(--ink) 80%, transparent);
}

.pv__sec {
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: 14px;
  padding: 26px 26px 20px;
  margin-bottom: 14px;
}
.pv__h2 {
  font-family: var(--font-display); font-weight: 700;
  font-size: 19px; line-height: 1.2; letter-spacing: -0.005em;
  margin: 0 0 12px;
  color: var(--ink);
}
.pv__p {
  margin: 0 0 12px;
  font-size: 15px; line-height: 1.66;
  max-width: 62ch;
  color: color-mix(in srgb, var(--ink) 78%, transparent);
}
.pv__list {
  margin: 0 0 8px; padding-left: 20px;
  display: grid; gap: 10px;
}
.pv__list li {
  font-size: 14.5px; line-height: 1.62;
  max-width: 60ch;
  color: color-mix(in srgb, var(--ink) 78%, transparent);
}

.pv__fine {
  margin: 28px 0 0;
  font-size: 14px; line-height: 1.6;
  color: color-mix(in srgb, var(--ink) 68%, transparent);
}
.pv__fine a { color: var(--ink); font-weight: 600; }
`
