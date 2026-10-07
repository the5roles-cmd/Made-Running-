import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import AuthSplash from '../auth/AuthSplash'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { safeNext } from '../lib/authNext'
import { REGISTRATION_OPEN } from '../lib/registration'
import { tenant } from '../lib/theme'
import SetupNotice from '../components/SetupNotice'

// A button that reads as a link. It has to be a <button>, not an <a>: these
// switch a panel in place rather than navigating, and an href-less anchor is
// not focusable or keyboard-activatable. Resetting the UA button chrome by
// hand is the cost of that. No text-decoration on hover — the global
// a:hover rule in app.css only targets anchors, so nothing to counteract.
const linkBtn = {
  display: 'inline-block',
  background: 'none',
  border: 0,
  font: 'inherit',
  color: 'var(--accent-ink)',
  cursor: 'pointer',
  textDecoration: 'underline',
  // The text is 21px tall, well under a 44px touch target. Padding grows
  // the hit box and the negative margin takes the growth back out of the
  // layout, so the line looks unchanged while the tappable area doubles.
  // Vertical only — the two of these that sit side by side are separated
  // by a middot with less than 24px of gap, so horizontal bleed would
  // overlap their hit boxes and make the wrong one fire near the middle.
  padding: '12px 0',
  margin: '-12px 0',
}

export default function Login() {
  // Deliberately does NOT pull `orgs`. Reading it here captures the signed-out
  // value for the lifetime of the submit handler; use refreshOrgs()'s return
  // value instead, which is fetched after the session exists.
  const { signIn, signUp, requestPasswordReset, refreshOrgs, user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Where to land once this page is finished with you. Set by whichever door
  // sent you here — a hero card on the landing page, or RequireAuth bouncing
  // a cold deep link. safeNext refuses anything that is not a bare path, so
  // this cannot be pointed at another origin.
  const dest = safeNext(searchParams.get('next'))

  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  // Set once the reset email has been requested. Shown for ANY address,
  // including ones with no account — see requestPasswordReset in
  // AuthProvider for why that is deliberate rather than sloppy.
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Sign-up profile — all mandatory
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [business, setBusiness] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const disabled = !supabaseConfigured || busy

  // Switch tabs without carrying an error or a stale "check your inbox"
  // banner across — both are about the panel you just left.
  //
  // The signup guard lives here rather than only on the tab that calls it,
  // because 'forgot' also routes back through go('signin') and any future
  // caller gets the same protection for free. Falling back to 'signin'
  // instead of ignoring the call means the page can never end up rendering
  // a mode whose UI has been removed.
  const go = (next) => {
    setMode(next === 'signup' && !REGISTRATION_OPEN ? 'signin' : next)
    setErrorMsg('')
    setResetSent(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (disabled) return
    setErrorMsg('')

    // ── Forgot password ────────────────────────────────────────────
    // Deliberately no branch on whether the account exists: Supabase
    // returns success for unknown addresses so the form cannot be used
    // to discover who has an account. The confirmation below is worded
    // as a conditional ("if that email is registered") so it stays
    // honest while giving nothing away.
    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Enter the email address you signed up with.')
        return
      }
      setBusy(true)
      const { error } = await requestPasswordReset(email)
      setBusy(false)
      // Rate limiting is the one real failure worth surfacing — staying
      // silent there would leave someone tapping a dead button.
      if (error && /rate|limit|seconds/i.test(error.message)) {
        setErrorMsg(error.message)
        return
      }
      setResetSent(true)
      return
    }

    // Registration closed: refuse before any network call. The tab that sets
    // this mode is not rendered, so reaching here means the state was forced
    // some other way — React DevTools, a stale bundle held in a background
    // tab across a deploy, or a future code path that forgets the rule. The
    // check costs nothing and keeps the client honest with the server, which
    // is where the real refusal lives (see lib/registration.js).
    if (mode === 'signup' && !REGISTRATION_OPEN) {
      setErrorMsg('New accounts are not open. Ask the club to set one up for you.')
      return
    }

    if (mode === 'signup') {
      const missing =
        !fullName.trim() ||
        !phone.trim() ||
        !location.trim() ||
        !business.trim()
      if (missing) {
        setErrorMsg('Please fill in every field — they are all required.')
        return
      }
    }
    setBusy(true)

    try {
      const { data, error } =
        mode === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password, {
              full_name: fullName.trim(),
              phone: phone.trim(),
              location: location.trim(),
              business_name: business.trim(),
            })

      if (error) {
        // Supabase returns the identical "Invalid login credentials" for
        // "no such user" and "wrong password" — anti-enumeration, and worth
        // keeping. But on its own it strands someone who has simply never
        // signed up, so point at the ways out rather than give a diagnosis.
        //
        // Which ways out exist depends on the flag: sending someone to
        // "Create account" when that tab is gone is a dead end, and it also
        // leaks that the address has no account — the exact thing the
        // identical-error design is protecting.
        setErrorMsg(
          /invalid login credentials/i.test(error.message)
            ? REGISTRATION_OPEN
              ? 'That email and password did not match. Try Forgot password, or Create account if you have not signed up yet.'
              : 'That email and password did not match. Try Forgot password, or ask the club if you need an account.'
            : error.message,
        )
        setBusy(false)
        return
      }

      if (data?.user) {
        // Ask the server what this account actually belongs to. The `orgs`
        // from context is the value captured when this handler was created —
        // i.e. while still signed out, so always []. Branching on it meant
        // EVERY sign-in believed the user had no workspace and called
        // create_org, quietly minting a duplicate "My workspace" per login.
        // Those extras are what the dashboard kept landing on, empty.
        const list = await refreshOrgs()

        // Only a genuine signup may create a workspace, and only when the
        // account really has none. Signing in never creates anything.
        if (mode === 'signup' && list.length === 0) {
          const { error: orgError } = await supabase.rpc('create_org', {
            p_name: business.trim() || 'My workspace',
            p_industry: tenant.industry,
          })
          if (orgError) {
            // Surface this rather than silently landing the user on an
            // empty, org-less /app — that used to look identical to a
            // fresh empty workspace but actually meant zero data access.
            setErrorMsg(`Couldn't set up your workspace: ${orgError.message}`)
            setBusy(false)
            return
          }
          await refreshOrgs()
        }
      }

      // Only now is orgId settled, so /app renders against a real workspace on
      // its first paint instead of needing a manual refresh.
      navigate(dest, { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  // ── Already signed in? Then there is nothing to ask ──────────────────
  // This is what lets every door on the landing page point at /login without
  // nagging a returning member: with a live session they pass straight
  // through to their destination and never see a form.
  //
  // Waiting on `loading` is the load-bearing half. `user` is null while the
  // stored session is still being read back, so rendering immediately would
  // show a signed-in visitor a login form for a frame and then snatch it
  // away — worse than the splash, because a fast typist can start filling in
  // a form that is about to vanish.
  //
  // Both checks sit behind supabaseConfigured so an unconfigured build still
  // reaches the form and its <SetupNotice> rather than hanging on a splash.
  // These are after every hook call, so the hook order stays stable.
  if (supabaseConfigured && loading) return <AuthSplash />
  if (supabaseConfigured && user) return <Navigate to={dest} replace />

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
            {tenant.name}
          </h1>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', textAlign: 'center' }}>
            {tenant.tagline}
          </p>
        </div>

        {/* ── Setup notice ─────────────────────────────── */}
        <SetupNotice />

        {/* Gated, not hardcoded: this line's whole job is to tell you which
            controls exist below it, so it has to move with the flag. Pointing
            newcomers at a Create account tab that isn't rendered — or staying
            silent about one that is — is the worst of both worlds.
            The closed wording avoids "you cannot", which reads as a
            rejection; accounts being issued rather than self-served is a
            policy, not a fault of the person reading it. */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--s5)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {REGISTRATION_OPEN
              ? 'New here? Use Create account below. Already a member? Sign in.'
              : 'Accounts are set up by the club. Sign in with the details you were given, or ask a coach if you need access.'}
          </span>
        </div>

        {/* ── Demo shortcut when Supabase not configured ── */}
        {!supabaseConfigured && (
          <div style={{ textAlign: 'center', marginBottom: 'var(--s6)' }}>
            <Link to="/app" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
              Explore the demo
            </Link>
          </div>
        )}

        {/* ── Auth card ────────────────────────────────── */}
        <div className="card card--raised" style={{ padding: 'var(--s6)' }}>
          {/* Was "Coaches & Staff", which described the page accurately when
              only the coach card pointed here. All five doors do now, so a
              runner arriving from "I am a Runner" would have been told this
              form was not for them. */}
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)', textAlign: 'center' }}>
            Runners, coaches &amp; staff
          </div>
          {/* Segmented toggle — hidden in 'forgot' mode, where neither tab
              is truthfully "on" and a lit segment would misdescribe the
              panel below it. The back link inside that panel is the way out.

              Also hidden entirely when registration is closed: a two-tab
              switch with one tab left is not a switch, it is a heading that
              looks clickable. The eyebrow above and the submit button below
              both say "sign in", so nothing is lost by removing it.

              The signup fields further down stay in the file on purpose —
              they are gated on this flag, not deleted, so flipping
              REGISTRATION_OPEN back to true restores the whole path. */}
          {mode !== 'forgot' && REGISTRATION_OPEN && (
            <div
              className="segmented"
              style={{ width: '100%', marginBottom: 'var(--s6)', justifyContent: 'stretch' }}
            >
              <button
                type="button"
                className={mode === 'signin' ? 'on' : ''}
                style={{ flex: 1, minHeight: 44 }}
                onClick={() => go('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'on' : ''}
                style={{ flex: 1, minHeight: 44 }}
                onClick={() => go('signup')}
              >
                Create account
              </button>
            </div>
          )}

          {/* Forgot-password heading */}
          {mode === 'forgot' && (
            <div style={{ marginBottom: 'var(--s5)' }}>
              <h2
                className="display"
                style={{
                  fontSize: 'var(--fs-lg)',
                  margin: '0 0 var(--s2)',
                  color: 'var(--ink)',
                  textAlign: 'center',
                }}
              >
                Reset your password
              </h2>
              {/* Drops away once sent — it instructs you to do a thing you
                  have just done, directly above the confirmation saying so.
                  margin-inline auto is load-bearing: app.css sets a global
                  p { max-width: 66ch }, so without it this box is narrower
                  than the card and text-align centres inside the short box,
                  landing the copy left of the card's axis. */}
              {!resetSent && (
                <p
                  className="muted"
                  style={{
                    fontSize: 'var(--fs-sm)',
                    textAlign: 'center',
                    marginInline: 'auto',
                  }}
                >
                  Enter the email you signed up with and we&rsquo;ll send you a link to set a new
                  one.
                </p>
              )}
            </div>
          )}

          {/* Error */}
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

          {/* Sent confirmation. Worded conditionally on purpose — we do not
              know whether that address has an account, and saying so would
              turn this form into an account-lookup tool. */}
          {mode === 'forgot' && resetSent && (
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
                If <strong>{email.trim()}</strong> is registered, a reset link is on its way. It
                expires in an hour &mdash; check your spam folder if it has not arrived.
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => go('signin')}
                style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
              >
                Back to sign in
              </button>
              {/* The last thing shown after a reset email goes out. With
                  registration closed there is no "one" to create, so the
                  whole prompt goes rather than being reworded into a
                  suggestion the page cannot act on. */}
              {REGISTRATION_OPEN && (
                <p
                  className="muted"
                  style={{
                    fontSize: 'var(--fs-sm)',
                    textAlign: 'center',
                    marginTop: 'var(--s4)',
                    marginInline: 'auto',
                  }}
                >
                  No account yet?{' '}
                  <button
                    type="button"
                    onClick={() => go('signup')}
                    style={linkBtn}
                  >
                    Create one
                  </button>
                </p>
              )}
            </>
          )}

          {!(mode === 'forgot' && resetSent) && (
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div className="field">
                  <label htmlFor="signup-name">Name</label>
                  <input
                    id="signup-name"
                    type="text"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Hermen Dange"
                    required
                    disabled={disabled}
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-phone">Telephone number</label>
                  <input
                    id="signup-phone"
                    type="tel"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0161 123 4567"
                    required
                    disabled={disabled}
                    autoComplete="tel"
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-location">Location</label>
                  <input
                    id="signup-location"
                    type="text"
                    className="input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Manchester, UK"
                    required
                    disabled={disabled}
                    autoComplete="address-level2"
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-business">Name of your crew / business</label>
                  <input
                    id="signup-business"
                    type="text"
                    className="input"
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                    placeholder="e.g. Made Running"
                    required
                    disabled={disabled}
                    autoComplete="organization"
                  />
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@maderunning.com"
                required
                disabled={disabled}
                autoComplete="email"
              />
            </div>

            {/* No password field in 'forgot' mode — the whole point is that
                they do not have it. Leaving it mounted but hidden would keep
                its required attribute in play and block submit silently. */}
            {mode !== 'forgot' && (
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Choose a password (≥ 6 chars)' : '••••••••'}
                  required
                  minLength={6}
                  disabled={disabled}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={disabled}
              style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--s2)', minHeight: 44 }}
            >
              {busy
                ? 'Please wait…'
                : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
            </button>

            {/* Forgot-password entry point. Sits under the button rather than
                beside the password label, where it would read as a hint about
                what to type rather than a way out. */}
            {mode === 'signin' && (
              <p
                className="muted"
                style={{
                  fontSize: 'var(--fs-sm)',
                  textAlign: 'center',
                  marginTop: 'var(--s4)',
                  marginInline: 'auto',
                }}
              >
                <button type="button" onClick={() => go('forgot')} style={linkBtn}>
                  Forgot password?
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p
                className="muted"
                style={{
                  fontSize: 'var(--fs-sm)',
                  textAlign: 'center',
                  marginTop: 'var(--s4)',
                  marginInline: 'auto',
                }}
              >
                <button type="button" onClick={() => go('signin')} style={linkBtn}>
                  Back to sign in
                </button>
                <span style={{ margin: '0 var(--s2)', opacity: 0.5 }}>&middot;</span>
                <button type="button" onClick={() => go('signup')} style={linkBtn}>
                  Create an account
                </button>
              </p>
            )}
          </form>
          )}
        </div>

        {/* ── Back to landing ──────────────────────────── */}
        <p
          className="muted"
          style={{ textAlign: 'center', marginTop: 'var(--s5)', fontSize: 'var(--fs-sm)' }}
        >
          {/* inline-block + padding, not a height: an <a> is inline by default,
              so this was rendering an 18px-tall hit area — well under the 44px
              touch minimum. Padding is what grows an inline box; the wrapping
              <p> still does the centring. */}
          <Link
            to="/"
            style={{ color: 'var(--accent-ink)', display: 'inline-block', padding: '13px 12px' }}
          >
            &larr; Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
