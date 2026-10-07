// Settings — Profile, Workspace, Security, Sign out.
// Route: /app/settings (registered in App.jsx).
// Reads: useAuth() for user/orgs/role/signOut/updatePassword.
// Writes: supabase.auth.updateUser for profile fields and password.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Building2, KeyRound, LogOut, Check } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase, supabaseConfigured, friendlyError } from '../lib/supabase'
import { PageHead } from '../components/ui'

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card" style={{ marginBottom: 'var(--s5)' }}>
      <div
        className="rowflex"
        style={{
          gap: 'var(--s3)',
          alignItems: 'center',
          marginBottom: 'var(--s5)',
          paddingBottom: 'var(--s4)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span
          className="avatar"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <h2 className="display" style={{ fontSize: 'var(--fs-md)', margin: 0, color: 'var(--ink)' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function Field({ id, label, children }) {
  return (
    <div className="field" style={{ marginBottom: 'var(--s4)' }}>
      <label className="eyebrow" htmlFor={id} style={{ display: 'block', marginBottom: 'var(--s2)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ user }) {
  const meta = user?.user_metadata || {}
  const [fullName, setFullName] = useState(meta.full_name || '')
  const [phone, setPhone] = useState(meta.phone || '')
  const [location, setLocation] = useState(meta.location || '')
  const [business, setBusiness] = useState(meta.business_name || '')
  const [website, setWebsite] = useState(meta.website || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!supabaseConfigured || saving) return
    setSaving(true)
    setSaved(false)
    setErr(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          business_name: business.trim(),
          website: website.trim(),
        },
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setErr(friendlyError(e, 'Could not save profile.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section icon={User} title="Profile">
      {/* Email — read-only. Changing auth email triggers a confirmation
          flow that requires working transactional mail. That is not set up
          yet, so we show it clearly rather than shipping a button that
          silently does nothing. */}
      <Field id="settings-email" label="Email address">
        <input
          id="settings-email"
          className="input"
          type="email"
          value={user?.email || ''}
          disabled
          readOnly
          style={{ opacity: 0.6, cursor: 'not-allowed' }}
        />
        <p
          className="muted"
          style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s2)', marginInline: 'auto' }}
        >
          Email changes require confirmation via transactional mail, which is not yet
          enabled. Contact your administrator to update your address.
        </p>
      </Field>

      <form onSubmit={handleSave} className="stack" style={{ gap: 0 }}>
        <Field id="settings-name" label="Name">
          <input
            id="settings-name"
            className="input"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Hermen Dange"
            autoComplete="name"
            disabled={!supabaseConfigured}
          />
        </Field>

        <Field id="settings-phone" label="Telephone number">
          <input
            id="settings-phone"
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0161 123 4567"
            autoComplete="tel"
            disabled={!supabaseConfigured}
          />
        </Field>

        <Field id="settings-location" label="Location">
          <input
            id="settings-location"
            className="input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Manchester, UK"
            autoComplete="address-level2"
            disabled={!supabaseConfigured}
          />
        </Field>

        <Field id="settings-business" label="Crew / business name">
          <input
            id="settings-business"
            className="input"
            type="text"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="e.g. Made Running"
            autoComplete="organization"
            disabled={!supabaseConfigured}
          />
        </Field>

        <Field id="settings-website" label="Website URL">
          <input
            id="settings-website"
            className="input"
            type="text"
            inputMode="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="e.g. maderunning.com"
            autoComplete="url"
            disabled={!supabaseConfigured}
          />
        </Field>

        {err && (
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
            {err}
          </div>
        )}

        <div className="rowflex" style={{ gap: 'var(--s3)', marginTop: 'var(--s2)' }}>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!supabaseConfigured || saving}
            style={{ minHeight: 44 }}
          >
            {saved ? (
              <span className="rowflex" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
                <Check size={16} />
                Saved
              </span>
            ) : saving ? (
              'Saving…'
            ) : (
              'Save profile'
            )}
          </button>
        </div>
      </form>
    </Section>
  )
}

// ── Workspace section ─────────────────────────────────────────────────────────

function WorkspaceSection({ orgs, orgId, role }) {
  const activeOrg = orgs?.find((o) => o.id === orgId)

  return (
    <Section icon={Building2} title="Workspace">
      <div className="grid grid--2" style={{ gap: 'var(--s4)' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>
            Workspace name
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginInline: 'auto' }}>
            {activeOrg?.name || '—'}
          </p>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>
            Your role
          </div>
          <div>
            <span className="chip">{role || 'member'}</span>
          </div>
        </div>
      </div>
      <p
        className="muted"
        style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s4)', marginInline: 'auto' }}
      >
        Workspace settings (renaming, adding members, billing) are managed by an administrator.
      </p>
    </Section>
  )
}

// ── Security section ──────────────────────────────────────────────────────────

function SecuritySection({ updatePassword }) {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  async function handleChange(e) {
    e.preventDefault()
    setErr(null)

    if (newPw.length < 6) {
      setErr('Password must be at least 6 characters.')
      return
    }
    // Guard against typos before calling the API — Supabase will accept any
    // two different strings and lock the user out immediately.
    if (newPw !== confirmPw) {
      setErr('Passwords do not match. Please re-enter both fields.')
      return
    }

    if (!supabaseConfigured || saving) return
    setSaving(true)
    try {
      const { error } = await updatePassword(newPw)
      if (error) throw error
      setSaved(true)
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => setSaved(false), 4000)
    } catch (e) {
      setErr(friendlyError(e, 'Could not update password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section icon={KeyRound} title="Security">
      {/* Forgot-password cross-link — for the "I don't know my current
          password" case. The full flow already lives at /login. */}
      <p
        className="muted"
        style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s5)', marginInline: 'auto' }}
      >
        Don&rsquo;t know your current password?{' '}
        <Link to="/login" style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }}>
          Use the Forgot password flow
        </Link>{' '}
        on the sign-in page to reset it via email.
      </p>

      <form onSubmit={handleChange} className="stack" style={{ gap: 0 }}>
        <Field id="settings-newpw" label="New password">
          <input
            id="settings-newpw"
            className="input"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            autoComplete="new-password"
            disabled={!supabaseConfigured}
          />
        </Field>

        <Field id="settings-confirmpw" label="Confirm new password">
          <input
            id="settings-confirmpw"
            className="input"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Repeat the password above"
            autoComplete="new-password"
            disabled={!supabaseConfigured}
          />
        </Field>

        {err && (
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
            {err}
          </div>
        )}

        {saved && (
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
            Password updated successfully.
          </div>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={!supabaseConfigured || saving || !newPw || !confirmPw}
          style={{ minHeight: 44 }}
        >
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Section>
  )
}

// ── Sign-out section ──────────────────────────────────────────────────────────

function SignOutSection({ signOut }) {
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    await signOut()
    // AuthProvider clears the session; RequireAuth redirects to /login.
  }

  return (
    <Section icon={LogOut} title="Sign out">
      <p
        className="muted"
        style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s5)', marginInline: 'auto' }}
      >
        You will be returned to the sign-in page. Any unsaved changes on other screens will be lost.
      </p>
      <button
        className="btn"
        onClick={handleSignOut}
        disabled={busy}
        style={{
          minHeight: 44,
          borderColor: 'var(--danger)',
          color: 'var(--danger)',
        }}
      >
        <LogOut size={16} />
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </Section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, orgs, orgId, role, signOut, updatePassword } = useAuth()

  return (
    <div className="page">
      <PageHead
        eyebrow="Account"
        title="Settings"
        sub="Manage your profile, workspace and security."
      />

      <ProfileSection user={user} />
      <WorkspaceSection orgs={orgs} orgId={orgId} role={role} />
      <SecuritySection updatePassword={updatePassword} />
      <SignOutSection signOut={signOut} />
    </div>
  )
}
