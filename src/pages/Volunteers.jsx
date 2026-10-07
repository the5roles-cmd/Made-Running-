// ============================================================
// Volunteers — the COMMUNITY role (unpaid/informal: run leader, pacer,
// ambassador, hub coach, media). Distinct from a Collab's
// deal_type='ambassador_agreement' (the paid/contracted relationship).
//
// This page is TWO screens sharing one table, split on role:
//
//   Runner → "Apply to be a volunteer". Applies for THEMSELVES (no runner
//            picker — the app already knows who they are), and sees only
//            their own applications. Showing a member the club's full
//            volunteer roster, mid-application statuses and all, would leak
//            other people's pending decisions.
//   Staff  → the full roster, plus any waiting applications pulled to the
//            top with Approve / Not now. Can still add someone directly,
//            because a run leader who was recruited in person shouldn't
//            have to go and fill in a form to be recorded.
//
// But the ACTION is no longer split on role — see `mode` below. Staff used
// to get one button, "New volunteer", which is an admin verb aimed at
// somebody else; the page opened by asking a coach to process people. Now
// the primary button is "Apply to be a volunteer" for everyone, because a
// coach who wants to pace the Saturday group is a volunteer like anyone
// else, and "Add someone" is the secondary case it actually is.
//
// No migration needed for any of this: `volunteers.status` is a plain
// `text not null default 'active'` with no check constraint, so 'applied'
// and 'declined' are just values it already accepts.
// ============================================================
import { useState } from 'react'
import { Check, HandHeart, HeartHandshake, Plus, X } from 'lucide-react'

import Modal from '../components/Modal'
import SetupNotice from '../components/SetupNotice'
import { PageHead, Empty, Loading } from '../components/ui'
import { VOLUNTEER_TYPES, volunteerTypeLabel, isStaffRole } from '../lib/constants'
import { useAuth } from '../auth/AuthProvider'
import { useMyRunner } from '../lib/useMyRunner'
import { useList, useInsert, useUpdate } from '../lib/useData'

// What staff can set by hand. 'applied' is never in this list — it's a state
// the runner puts themselves into, not one an admin assigns.
const MANUAL_STATUSES = ['active', 'inactive']

// "Declined" is the honest database value, but "Not now" is what the club
// says out loud. Made Running's whole line is "No One Gets Left Behind";
// a screen that stamps REJECTED on someone who offered to help pace a 5k is
// off-brand in a way that costs nothing to fix. The value stays 'declined'
// so it's greppable; only the label softens.
const STATUS_META = {
  applied: { label: 'Applied', tone: 'badge--warn' },
  active: { label: 'Active', tone: 'badge--ok' },
  inactive: { label: 'Inactive', tone: 'badge--neutral' },
  declined: { label: 'Not now', tone: 'badge--neutral' },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Active', tone: 'badge--neutral' }
  return <span className={`badge ${meta.tone}`}>{meta.label}</span>
}

// Aliased rather than called directly at the four badge sites, so a retired
// role (Ambassador, Hub coach) on an existing row still renders as a proper
// label instead of the raw `hub_coach` enum. See constants.js.
const typeLabel = volunteerTypeLabel

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString()
}

export default function Volunteers() {
  const { effectiveRole } = useAuth()
  const staff = isStaffRole(effectiveRole)

  const { rows, loading, refresh } = useList('volunteers', {
    order: 'started_at',
    ascending: false,
    select: '*, records(title, email)',
  })
  const { rows: runners } = useList('records', { order: 'title', ascending: true })

  // Which record is mine. Called unconditionally because hooks must be —
  // staff pay one extra query they don't read, which is the cheaper half of
  // the trade against branching the whole page into two components.
  const { runner } = useMyRunner()

  const insert = useInsert('volunteers')
  const update = useUpdate('volunteers')

  const [open, setOpen] = useState(false)
  // What the modal is FOR, which is no longer implied by the viewer's role.
  //
  //   'apply' — I am putting myself forward. Anyone can, staff included: a
  //             coach who wants to pace the Saturday group is a volunteer
  //             like anyone else, and making them use the admin form to say
  //             so would be the tool telling them who they're allowed to be.
  //   'add'   — I am recording SOMEONE ELSE, who said yes in person. Staff
  //             only, and secondary — it's the exception, not the front door.
  //
  // Splitting this out from `staff` is the whole change: the form shape now
  // follows the intent, not the account.
  const [mode, setMode] = useState('apply')
  const adding = mode === 'add'
  const [form, setForm] = useState({ runner_id: '', volunteer_type: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState(null)

  // ── Runner's own view of the data ────────────────────────────────────
  const mine = runner ? rows.filter((v) => v.runner_id === runner.id) : []
  // A declined role can be applied for again — people's availability changes,
  // and a permanent lockout from one "not now" would be the wrong rule.
  const held = new Set(mine.filter((v) => v.status !== 'declined').map((v) => v.volunteer_type))
  const openToApply = VOLUNTEER_TYPES.filter((t) => !held.has(t.value))

  // ── Staff's view ─────────────────────────────────────────────────────
  const waiting = rows.filter((v) => v.status === 'applied')
  const roster = rows.filter((v) => v.status !== 'applied')

  function openModal(nextMode = 'apply') {
    setErr(null)
    setMode(nextMode)
    setForm({
      runner_id: '',
      // Applying offers only the roles I don't already hold; adding someone
      // else offers all of them, because I don't know what they hold yet.
      volunteer_type: (nextMode === 'add' ? VOLUNTEER_TYPES[0] : openToApply[0])?.value || 'run_leader',
      status: 'active',
    })
    setOpen(true)
  }

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(null)

    // Applying is always for MYSELF and always lands as 'applied' — including
    // when an owner does it. The status is decided here rather than read from
    // the form, so there is no path, for any role, that submits an
    // application already stamped approved. Recording someone else is the
    // only branch that may set a status, and only staff can reach it.
    const payload = adding
      ? { runner_id: form.runner_id, volunteer_type: form.volunteer_type, status: form.status || 'active' }
      : { runner_id: runner?.id, volunteer_type: form.volunteer_type, status: 'applied' }

    if (!payload.runner_id) {
      setErr(adding ? 'Pick a runner first.' : 'We could not find your runner profile — reload and try again.')
      return
    }

    setSaving(true)
    try {
      await insert({ ...payload, started_at: new Date().toISOString() })
      await refresh()
      setOpen(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Approve stamps started_at fresh: the row was created when they applied,
  // but they started volunteering when they were accepted, and "Started" is
  // the column people read as length of service.
  async function decide(id, status) {
    setBusyId(id)
    setErr(null)
    try {
      await update(id, status === 'active' ? { status, started_at: new Date().toISOString() } : { status })
      await refresh()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const canSubmit = !saving && (adding ? !!form.runner_id : !!runner?.id && !!form.volunteer_type)

  return (
    <div className="page">
      <SetupNotice />

      <PageHead
        eyebrow="Community"
        title="Volunteers"
        // One line for everyone, and it's the runner's. The staff variant used
        // to read "Run leaders, pacers, ambassadors, Hub coaches, and media" —
        // a list of ROLE TYPES, i.e. a description of the database. This one
        // describes what a person would be doing.
        sub="Help run the club — lead a run, pace a group, coach at the Gym."
      >
        {/* The primary action is "apply", for every role. Previously a coach
            landed on a page whose only button was "New volunteer" — an admin
            verb, pointed at someone else — which quietly said the club is a
            thing you administer rather than a thing you're in. Recording
            somebody who already said yes is still here, demoted to a ghost
            button, because it IS the rarer case. */}
        <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          {staff && (
            <button
              className="btn btn--ghost"
              onClick={() => openModal('add')}
              style={{ minHeight: 44 }}
            >
              <Plus size={16} />
              Add someone
            </button>
          )}
          {openToApply.length > 0 && (
            <button
              className="btn btn--primary"
              onClick={() => openModal('apply')}
              style={{ minHeight: 44 }}
            >
              <HandHeart size={16} />
              Apply to be a volunteer
            </button>
          )}
        </div>
      </PageHead>

      {err && (
        <div className="notice" style={{ borderColor: 'var(--danger)', marginBottom: 'var(--s5)' }}>
          <strong>Couldn’t save that.</strong>{' '}
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{err}</span>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : staff ? (
        <>
          {/* ── Applications waiting ─────────────────────────────────── */}
          {waiting.length > 0 && (
            <section style={{ marginBottom: 'var(--s7)' }}>
              <div className="spread" style={{ marginBottom: 'var(--s4)' }}>
                <h2 className="display" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>
                  Applications
                </h2>
                <span className="badge badge--warn">
                  {waiting.length} waiting
                </span>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Runner</th>
                      <th>Applying for</th>
                      <th>Applied</th>
                      <th style={{ textAlign: 'right' }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waiting.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <div className="display" style={{ fontSize: 'var(--fs-sm)' }}>
                            {v.records?.title || '—'}
                          </div>
                          {v.records?.email && (
                            <div className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                              {v.records.email}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="chip">{typeLabel(v.volunteer_type)}</span>
                        </td>
                        <td className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{fmtDate(v.started_at)}</td>
                        <td>
                          <div className="rowflex" style={{ gap: 'var(--s2)', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn--primary btn--sm"
                              style={{ minHeight: 44 }}
                              disabled={busyId === v.id}
                              onClick={() => decide(v.id, 'active')}
                            >
                              <Check size={14} />
                              Approve
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ minHeight: 44 }}
                              disabled={busyId === v.id}
                              onClick={() => decide(v.id, 'declined')}
                            >
                              <X size={14} />
                              Not now
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── The roster ───────────────────────────────────────────── */}
          {roster.length === 0 && waiting.length === 0 ? (
            <div className="card">
              <Empty
                icon={HeartHandshake}
                title="No volunteers yet"
                hint="Apply to be one yourself, or add someone who has already said yes."
              />
            </div>
          ) : (
            roster.length > 0 && (
              <section>
                {waiting.length > 0 && (
                  <h2 className="display" style={{ fontSize: 'var(--fs-lg)', margin: '0 0 var(--s4)' }}>
                    Volunteer team
                  </h2>
                )}
                <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Runner</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <span className="display" style={{ fontSize: 'var(--fs-sm)' }}>
                              {v.records?.title || '—'}
                            </span>
                          </td>
                          <td>
                            <span className="chip">{typeLabel(v.volunteer_type)}</span>
                          </td>
                          <td><StatusBadge status={v.status} /></td>
                          <td className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{fmtDate(v.started_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          )}
        </>
      ) : mine.length === 0 ? (
        <div className="card">
          <Empty
            icon={HeartHandshake}
            title="You’re not a volunteer yet"
            hint="Volunteers lead runs, pace groups, coach at the Hub and cover events. Apply above and a coach will come back to you."
          />
        </div>
      ) : (
        // The runner's own applications only — never the club's roster.
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="display" style={{ fontSize: 'var(--fs-sm)' }}>
                      {typeLabel(v.volunteer_type)}
                    </span>
                  </td>
                  <td><StatusBadge status={v.status} /></td>
                  <td className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{fmtDate(v.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!staff && mine.length > 0 && openToApply.length === 0 && (
        <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s3)' }}>
          You’ve applied for every volunteer role. Speak to a coach if you’d like to change one.
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={adding ? 'Add someone as a volunteer' : 'Apply to be a volunteer'}
        footer={
          <div className="spread">
            <button className="btn btn--ghost" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ minHeight: 44 }}
            >
              {saving ? 'Sending…' : adding ? 'Add volunteer' : 'Send application'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--s4)' }}>
          {adding ? (
            <div className="field">
              <label className="eyebrow" htmlFor="vol-runner">
                Runner <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <select
                id="vol-runner"
                className="select"
                value={form.runner_id}
                onChange={set('runner_id')}
                required
                autoFocus
              >
                <option value="">— Select runner —</option>
                {runners.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
              Applying as <strong>{runner?.title || 'you'}</strong>. A coach will review it and
              get back to you — you’ll see the decision on this page.
            </p>
          )}

          <div className="field">
            <label className="eyebrow" htmlFor="vol-type">
              {adding ? 'Volunteer type' : 'Which role?'}
            </label>
            <select
              id="vol-type"
              className="select"
              value={form.volunteer_type}
              onChange={set('volunteer_type')}
              autoFocus={!adding}
            >
              {(adding ? VOLUNTEER_TYPES : openToApply).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {adding && (
            <div className="field">
              <label className="eyebrow" htmlFor="vol-status">Status</label>
              <select id="vol-status" className="select" value={form.status} onChange={set('status')}>
                {MANUAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          )}

          {err && (
            <p className="muted" style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)' }}>
              {err}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
