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

export default function JoinRunner() {
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
              Thanks, {fullName.trim().split(' ')[0]} — we&rsquo;ve got your details. Keep an eye on our
              Instagram and WhatsApp for the next session near you. No one gets left behind.
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
                  hold my details above for the purpose of running sessions and check-ins.
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
