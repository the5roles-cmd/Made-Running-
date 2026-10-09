// JoinRunner — the public, no-login RUNNER path (see supabase-setup.sql,
// "TWO SIGNUP PATHS"). Distinct from Login.jsx (the Made Running STAFF
// path, which creates a Supabase Auth account + a workspace). Anyone who
// fills this in lands directly in `records` as a new Runner for staff to
// see on the Runners list — no auth.users row, no membership, no CRM
// access, ever. Reuses the tenant key as the org lookup slug so this
// deployment always resolves to the one org it serves.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { tenant } from '../lib/theme'
import usePageTitle from '../lib/usePageTitle'
import BrandLogo from '../components/BrandLogo'

// Parse and sanitise the ?ref= query param from the invite URL.
// Stored as a tags entry (e.g. "ref:ABC123") rather than a new column because
// it needs no schema migration — the records table already has tags text[],
// and a schema change would have to be applied to the live Supabase project by
// hand right before the client demo tomorrow.
function parseRefCode() {
  const raw = new URLSearchParams(window.location.search).get('ref') ?? ''
  const sanitised = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return sanitised || null
}

// Shape-check for an OPTIONAL phone field. "abc" was accepted and stored as
// a phone number (QA, Oct 2026) — a coach trying to ring that member on race
// morning gets nothing. Deliberately locale-agnostic: this club runs in three
// countries, so "looks like a UK mobile" would reject real members. Strip the
// characters people legitimately type (spaces, dots, dashes, brackets), then
// require 7–15 digits with an optional +: the E.164 length envelope. Empty is
// fine — the field is optional and a fake number is worse than none.
function phoneLooksValid(value) {
  const v = value.trim()
  if (!v) return true
  const bare = v.replace(/[\s().-]/g, '')
  return /^\+?\d{7,15}$/.test(bare)
}

export default function JoinRunner() {
  usePageTitle('Join the community')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [waiverAccepted, setWaiverAccepted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  // Lazy init so the URL parse runs once, not on every render.
  const [refCode] = useState(() => parseRefCode())

  const disabled = !supabaseConfigured || busy

  async function handleSubmit(e) {
    e.preventDefault()
    if (disabled) return
    setErrorMsg('')

    if (!fullName.trim()) {
      setErrorMsg('Please tell us your name.')
      return
    }
    if (!waiverAccepted) {
      setErrorMsg('Please confirm the waiver below to register.')
      return
    }
    if (!phoneLooksValid(phone)) {
      setErrorMsg('That phone number doesn\u2019t look right — digits only, e.g. 0161 123 4567. Or leave it blank.')
      return
    }
    if (!phoneLooksValid(emergencyPhone)) {
      // Checked separately so the message can say WHICH field: on a phone
      // screen the two inputs are a full scroll apart.
      setErrorMsg('The emergency contact phone number doesn\u2019t look right — digits only, or leave it blank.')
      return
    }

    setBusy(true)
    const args = {
      p_slug: tenant.key,
      p_full_name: fullName.trim(),
      p_email: email.trim() || null,
      p_phone: phone.trim() || null,
      p_location: location.trim() || null,
      p_emergency_contact_name: emergencyName.trim() || null,
      p_emergency_contact_phone: emergencyPhone.trim() || null,
      p_waiver_accepted: waiverAccepted,
    }

    const { data: newRecordId, error } = await supabase.rpc('register_runner', args)

    // Referral attribution must go through a privileged function, never a
    // direct table write.
    //
    // register_runner is `security definer`, and that is the only reason an
    // anonymous visitor can write to `records` at all: the function bypasses
    // RLS, so the caller never touches the table itself. A plain
    // `.update({ tags })` from the anon role therefore matches no policy — and
    // RLS *filters* rather than errors, so Supabase returns zero rows changed
    // with error === null. That reads as success while persisting nothing,
    // which is precisely how a referral feature rots for months unnoticed.
    //
    // attach_referral (see supabase-referral.sql) is the security-definer
    // counterpart. It is deliberately a SEPARATE function rather than a new
    // parameter on register_runner: adding an optional 9th argument would
    // create a second overload that still matches the original 8-argument
    // call, and Postgres would reject the ambiguity with "function is not
    // unique" — breaking signup for everyone.
    //
    // The code is stored as a `ref:CODE` entry in the existing tags text[],
    // so no table migration is required. Until the SQL is applied PostgREST
    // returns PGRST202 (unknown function); we swallow it, because signing up
    // must never fail merely because attribution is unavailable.
    if (!error && refCode && newRecordId) {
      const { error: refErr } = await supabase.rpc('attach_referral', {
        p_record_id: newRecordId,
        p_ref_code: refCode,
      })
      if (refErr && import.meta.env.DEV) {
        console.warn(
          `[join] referral "${refCode}" not recorded (${refErr.code || 'error'}: ${refErr.message}). Apply supabase-referral.sql.`,
        )
      }
    }

    if (error) {
      setErrorMsg(error.message)
      setBusy(false)
      return
    }
    setDone(true)
    setBusy(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--s5)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* ── Brand lockup ─────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--s3)',
            marginBottom: 'var(--s7)',
          }}
        >
          {/* Unlike /login, the h1 here says "Join {name}" — real words, not
              just the brand — so it stays as text and the logo above it is
              purely decorative (alt=""): the heading already names the club. */}
          <BrandLogo on="light" height={36} alt="">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--accent)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--fs-lg)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
              }}
            >
              {tenant.mark}
            </div>
          </BrandLogo>
          <h1
            className="display"
            style={{
              fontSize: 'var(--fs-xl)',
              letterSpacing: '-0.015em',
              color: 'var(--ink)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Join {tenant.name}
          </h1>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', textAlign: 'center' }}>
            {tenant.tagline} Register below — no account or password needed.
          </p>
          {refCode && (
            <div
              style={{
                display: 'inline-flex',
                alignSelf: 'center',
                alignItems: 'center',
                gap: 'var(--s1)',
                background: 'var(--accent-soft)',
                color: 'var(--accent-ink)',
                borderRadius: 'var(--radius)',
                padding: '2px var(--s3)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
              }}
            >
              Invited by a club member — welcome!
            </div>
          )}
        </div>

        {done ? (
          <div className="card card--raised" style={{ padding: 'var(--s6)', textAlign: 'center' }}>
            <div className="display" style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--s2)' }}>
              You&rsquo;re in.
            </div>
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              {/* Instagram is linked because it is the one channel with a real
                  URL in this codebase. The old copy also name-dropped WhatsApp
                  with nothing to tap (QA, Oct 2026) — mentioning a channel we
                  cannot link is a promise with no door. When the club supplies
                  a real group-invite URL, add it HERE first. */}
              Thanks, {fullName.trim().split(' ')[0]} — we&rsquo;ve got your details. Follow{' '}
              <a
                href="https://www.instagram.com/made.running/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-ink)', fontWeight: 600 }}
              >
                @made.running on Instagram
              </a>{' '}
              for the next session near you — session times and group-chat invites are
              posted there. No one gets left behind.
            </p>
          </div>
        ) : (
          <div className="card card--raised" style={{ padding: 'var(--s6)' }}>
            {errorMsg && (
              <div
                className="notice"
                style={{
                  background: 'var(--danger-bg)',
                  borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                  color: 'var(--danger)',
                  fontSize: 'var(--fs-sm)',
                  marginBottom: 'var(--s4)',
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="join-name">Full name</label>
                <input
                  id="join-name"
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Amara Okoye"
                  required
                  disabled={disabled}
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label htmlFor="join-email">Email</label>
                <input
                  id="join-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={disabled}
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label htmlFor="join-phone">Phone</label>
                <input
                  id="join-phone"
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0161 123 4567"
                  disabled={disabled}
                  autoComplete="tel"
                />
              </div>
              <div className="field">
                <label htmlFor="join-location">Which chapter / city?</label>
                <input
                  id="join-location"
                  type="text"
                  className="input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Manchester"
                  disabled={disabled}
                  autoComplete="address-level2"
                />
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--line)',
                  marginTop: 'var(--s4)',
                  paddingTop: 'var(--s4)',
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
                  Emergency contact
                </div>
                <div className="field">
                  <label htmlFor="join-ec-name">Name</label>
                  <input
                    id="join-ec-name"
                    type="text"
                    className="input"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="e.g. Priya Okoye"
                    disabled={disabled}
                  />
                </div>
                <div className="field">
                  <label htmlFor="join-ec-phone">Phone</label>
                  <input
                    id="join-ec-phone"
                    type="tel"
                    className="input"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="e.g. 0161 987 6543"
                    disabled={disabled}
                  />
                </div>
              </div>

              <label
                className="rowflex"
                style={{
                  gap: 'var(--s2)',
                  alignItems: 'flex-start',
                  marginTop: 'var(--s4)',
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={waiverAccepted}
                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                  disabled={disabled}
                  style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                  required
                />
                <span className="muted">
                  I confirm I&rsquo;m taking part at my own risk and I&rsquo;m happy for {tenant.name} to
                  hold my details above for the purpose of running sessions and check-ins.{' '}
                  {/* target=_blank so a half-completed form is not lost to a
                      same-tab navigation — this is the one link on the page
                      someone taps MID-form. */}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    How we look after your details
                  </a>
                </span>
              </label>

              <button
                type="submit"
                className="btn btn--primary"
                disabled={disabled}
                style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--s4)', minHeight: 44 }}
              >
                {busy ? 'Please wait…' : 'Register'}
              </button>
            </form>
          </div>
        )}

        {/* ── Staff cross-link + back to home ──────────── */}
        <p
          className="muted"
          style={{ textAlign: 'center', marginTop: 'var(--s5)', fontSize: 'var(--fs-sm)' }}
        >
          Made Running staff?{' '}
          <Link to="/login" style={{ color: 'var(--accent-ink)' }}>
            Sign in here
          </Link>
          {' · '}
          <Link to="/" style={{ color: 'var(--accent-ink)' }}>
            &larr; Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
