// ============================================================
// /reset-password — the second half of the recovery flow.
//
// Supabase's emailed link points here with the tokens in the URL
// fragment. The client is created with detectSessionInUrl left at its
// default (true), so it consumes that fragment itself and puts a
// recovery session in place before this component ever renders — which
// is why there is no token parsing below. All this screen has to decide
// is whether that session arrived, and then call updateUser.
//
// This route is deliberately PUBLIC, not inside RequireAuth. The session
// only exists once the fragment has been parsed, and RequireAuth would
// race that and bounce the user to /login with the fragment discarded —
// unrecoverably, since these links are single-use.
// ============================================================
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { tenant } from '../lib/theme'

export default function ResetPassword() {
  const { session, loading, updatePassword, supabaseConfigured } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Read the fragment during the first render, before supabase-js has
  // finished with it — on the failure path (expired or already-used link)
  // it leaves an error there instead of a session, and clears it shortly
  // after. Captured in a state initialiser so it is sampled exactly once.
  const [linkError] = useState(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('error')) return ''
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const code = params.get('error_code') || ''
    if (/expired/i.test(code)) return 'That reset link has expired.'
    return params.get('error_description')?.replace(/\+/g, ' ') || 'That reset link is not valid.'
  })

  // Tidy the fragment away once seen. It is single-use and already spent,
  // but leaving it in the address bar invites a copy-paste into a chat.
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const ready = !loading && !!session && !linkError
  const disabled = !supabaseConfigured || busy

  async function handleSubmit(e) {
    e.preventDefault()
    if (disabled) return
    setErrorMsg('')

    if (password.length < 6) {
      setErrorMsg('Choose a password of at least 6 characters.')
      return
    }
    // Checked here rather than left to the two fields disagreeing at the
    // API — Supabase would happily accept a typo'd password and lock them
    // straight back out, with a fresh link the only way in.
    if (password !== confirm) {
      setErrorMsg('Those two passwords do not match.')
      return
    }

    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setDone(true)
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
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* ── Brand lockup — same as /login, so arriving from an email
             feels like the same product rather than a redirect ── */}
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
            {tenant.name}
          </h1>
        </div>

        <div className="card card--raised" style={{ padding: 'var(--s6)' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)', textAlign: 'center' }}>
            Password reset
          </div>

          {/* ── 1. Still resolving the link ── */}
          {loading && !linkError && (
            <p
              className="muted"
              style={{ fontSize: 'var(--fs-sm)', textAlign: 'center', marginInline: 'auto' }}
            >
              Checking your link&hellip;
            </p>
          )}

          {/* ── 2. Link dead or missing ──
               Covers both the explicit error in the fragment and the quieter
               case of someone opening /reset-password with no link at all. */}
          {!loading && !ready && !done && (
            <>
              <p
                style={{
                  fontSize: 'var(--fs-sm)',
                  textAlign: 'center',
                  marginInline: 'auto',
                  color: 'var(--ink)',
                }}
              >
                {linkError || 'This reset link is no longer valid.'}
              </p>
              <p
                className="muted"
                style={{
                  fontSize: 'var(--fs-sm)',
                  textAlign: 'center',
                  marginTop: 'var(--s3)',
                  marginBottom: 'var(--s5)',
                  marginInline: 'auto',
                }}
              >
                Reset links are single-use and expire after an hour. Request a fresh one and it will
                work.
              </p>
              <Link
                to="/login"
                className="btn btn--primary"
                style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
              >
                Back to sign in
              </Link>
            </>
          )}

          {/* ── 3. Done ── */}
          {done && (
            <>
              <div
                className="notice"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                  color: 'var(--accent-ink)',
                  fontSize: 'var(--fs-sm)',
                  marginBottom: 'var(--s4)',
                }}
              >
                Password updated. You are signed in.
              </div>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate('/app')}
                style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
              >
                Continue to the app
              </button>
            </>
          )}

          {/* ── 4. The form ── */}
          {ready && !done && (
            <>
              <p
                className="muted"
                style={{
                  fontSize: 'var(--fs-sm)',
                  textAlign: 'center',
                  marginBottom: 'var(--s5)',
                  marginInline: 'auto',
                }}
              >
                Choose a new password for <strong>{session?.user?.email}</strong>.
              </p>

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
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    disabled={disabled}
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className="input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Type it again"
                    required
                    minLength={6}
                    disabled={disabled}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={disabled}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginTop: 'var(--s2)',
                    minHeight: 44,
                  }}
                >
                  {busy ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
