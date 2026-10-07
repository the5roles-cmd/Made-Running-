// SessionDetail — single session view (works for both weekly runs and Hub
// sessions, since they share the `sessions` table — Sessions.jsx and Hub.jsx
// both route here). Header + edit modal, a "check in a runner" panel, and
// the attendance list for this session.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, MapPin, Users, UserCheck } from 'lucide-react'

import Modal from '../components/Modal'
import SetupNotice from '../components/SetupNotice'
import { Empty, Loading } from '../components/ui'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useRow, useList, useUpdate, useInsert } from '../lib/useData'
import { useAuth } from '../auth/AuthProvider'

function fmtWhen(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtTime(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SessionDetail() {
  const { id } = useParams()
  const { orgId, user } = useAuth()
  const { row, loading, refresh } = useRow('sessions', id, '*, chapters(name)')
  const { rows: chapters } = useList('chapters', { order: 'name', ascending: true })
  const { rows: runners } = useList('records', { order: 'title', ascending: true })
  const update = useUpdate('sessions')
  const insertAttendance = useInsert('attendance')

  // Attendance list for this session
  const [attendance, setAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(true)

  async function loadAttendance() {
    if (!supabaseConfigured || !orgId || !id) {
      setAttendanceLoading(false)
      return
    }
    setAttendanceLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, records(title)')
      .eq('session_id', id)
      .eq('org_id', orgId)
      .order('attended_at', { ascending: false })
    setAttendance(data || [])
    setAttendanceLoading(false)
  }

  useEffect(() => {
    loadAttendance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId])

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [editErr, setEditErr] = useState(null)

  function openEdit() {
    if (!row) return
    const local = row.starts_at
      ? new Date(row.starts_at).toISOString().slice(0, 16)
      : ''
    setEditForm({
      title: row.title || '',
      chapter_id: row.chapter_id || '',
      starts_at: local,
      location: row.location || '',
      capacity: row.capacity ?? '',
      recurring: !!row.recurring,
    })
    setEditErr(null)
    setEditOpen(true)
  }

  function setEdit(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setEditForm((f) => ({ ...f, [field]: val }))
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editForm.title?.trim()) return
    setSaving(true)
    setEditErr(null)
    try {
      await update(id, {
        title: editForm.title.trim(),
        chapter_id: editForm.chapter_id || null,
        starts_at: editForm.starts_at ? new Date(editForm.starts_at).toISOString() : null,
        location: editForm.location || null,
        capacity: editForm.capacity === '' ? null : Number(editForm.capacity),
        recurring: !!editForm.recurring,
      })
      await refresh()
      setEditOpen(false)
    } catch (e) {
      setEditErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Check-in panel — searchable, excludes already checked-in runners
  const [search, setSearch] = useState('')
  const [checkingIn, setCheckingIn] = useState(null) // holds runner_id while in-flight
  const [checkInErr, setCheckInErr] = useState(null)

  const checkedInIds = new Set(attendance.map((a) => a.runner_id))

  const filteredRunners = runners.filter((r) => {
    if (checkedInIds.has(r.id)) return false
    if (!search.trim()) return true
    return r.title?.toLowerCase().includes(search.toLowerCase())
  })

  async function handleCheckIn(runnerId) {
    setCheckingIn(runnerId)
    setCheckInErr(null)
    try {
      await insertAttendance({
        session_id: id,
        runner_id: runnerId,
        attended_at: new Date().toISOString(),
        checked_in_by: user?.id || null,
      })
      await loadAttendance()
    } catch (e) {
      setCheckInErr(e.message)
    } finally {
      setCheckingIn(null)
    }
  }

  if (loading) return <div className="page"><Loading /></div>

  if (!row) {
    return (
      <div className="page">
        <SetupNotice />
        <Link to="/app/sessions" className="btn btn--ghost btn--sm" style={{ marginBottom: 'var(--s4)' }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <Empty icon={CalendarDays} title="Session not found" hint="It may have been removed or the link is incorrect." />
      </div>
    )
  }

  const canEdit = editForm.title?.trim()?.length > 0 && !saving

  return (
    <div className="page">
      <SetupNotice />

      <Link
        to="/app/sessions"
        className="rowflex muted"
        style={{ gap: 'var(--s2)', textDecoration: 'none', fontSize: 'var(--fs-sm)', display: 'inline-flex', marginBottom: 'var(--s4)' }}
      >
        <ArrowLeft size={14} />
        Sessions
      </Link>

      {/* Header */}
      <div className="card card--raised" style={{ marginBottom: 'var(--s5)', padding: 'var(--s5)' }}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 'var(--s4)' }}>
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h1 className="display" style={{ fontSize: 'var(--fs-xl)', margin: 0 }}>{row.title}</h1>
            <div className="rowflex muted" style={{ gap: 'var(--s4)', flexWrap: 'wrap', fontSize: 'var(--fs-sm)' }}>
              <span className="rowflex" style={{ gap: 'var(--s1)' }}>
                <CalendarDays size={13} />
                {fmtWhen(row.starts_at)}
              </span>
              {row.location && (
                <span className="rowflex" style={{ gap: 'var(--s1)' }}>
                  <MapPin size={13} />
                  {row.location}
                </span>
              )}
              {row.chapters?.name && (
                <span>Chapter: <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{row.chapters.name}</span></span>
              )}
              <span className="rowflex" style={{ gap: 'var(--s1)' }}>
                <Users size={13} />
                Capacity: {row.capacity ?? '∞'}
              </span>
              {row.recurring && <span className="chip">Weekly</span>}
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={openEdit} style={{ minHeight: 44 }}>
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid--2" style={{ gap: 'var(--s5)', alignItems: 'start' }}>
        {/* LEFT — Attendance list */}
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          <div className="spread">
            <h2 className="display" style={{ fontSize: 'var(--fs-md)', margin: 0 }}>Checked in</h2>
            <span className="chip">
              {attendance.length}
              {row.capacity ? ` / ${row.capacity}` : ''}
            </span>
          </div>
          {attendanceLoading ? (
            <Loading rows={3} />
          ) : attendance.length === 0 ? (
            <div className="card">
              <Empty icon={UserCheck} title="No check-ins yet" hint="Check in a runner on the right to start the list." />
            </div>
          ) : (
            <div className="card">
              <ul className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {attendance.map((a) => (
                  <li key={a.id} className="tl__item">
                    <div className="tl__dot">
                      <UserCheck size={13} />
                    </div>
                    <div className="tl__body">
                      <div className="spread">
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                          {a.records?.title || 'Unknown runner'}
                        </span>
                        <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>
                          {fmtTime(a.attended_at)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT — Check-in panel */}
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-md)', margin: 0 }}>Check in a runner</h2>
          <div className="card" style={{ padding: 'var(--s4)' }}>
            <input
              className="input"
              placeholder="Search runners…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!supabaseConfigured}
              style={{ marginBottom: 'var(--s3)' }}
            />
            {checkInErr && (
              <p className="muted" style={{ color: 'var(--error, #e55)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--s3)' }}>
                {checkInErr}
              </p>
            )}
            {filteredRunners.length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {search.trim() ? 'No runners match your search.' : 'All runners already checked in.'}
              </p>
            ) : (
              <div className="stack" style={{ gap: 'var(--s2)', maxHeight: 320, overflowY: 'auto' }}>
                {filteredRunners.map((r) => (
                  <div key={r.id} className="spread rowflex" style={{ padding: 'var(--s2) 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{r.title}</span>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => handleCheckIn(r.id)}
                      disabled={!supabaseConfigured || checkingIn === r.id}
                      style={{ minHeight: 44, flexShrink: 0 }}
                    >
                      <UserCheck size={14} />
                      {checkingIn === r.id ? '…' : 'Check in'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit session"
        footer={
          <div className="spread">
            <button className="btn btn--ghost" onClick={() => setEditOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn btn--primary" onClick={handleUpdate} disabled={!canEdit} style={{ minHeight: 44 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleUpdate} className="stack" style={{ gap: 'var(--s4)' }}>
          <div className="field">
            <label className="eyebrow" htmlFor="edit-sess-title">
              Title <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              id="edit-sess-title"
              className="input"
              value={editForm.title || ''}
              onChange={setEdit('title')}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="edit-sess-chapter">Chapter</label>
            <select id="edit-sess-chapter" className="select" value={editForm.chapter_id || ''} onChange={setEdit('chapter_id')}>
              <option value="">— None —</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="edit-sess-starts">When</label>
            <input
              id="edit-sess-starts"
              type="datetime-local"
              className="input"
              value={editForm.starts_at || ''}
              onChange={setEdit('starts_at')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="edit-sess-location">Location</label>
            <input
              id="edit-sess-location"
              className="input"
              value={editForm.location || ''}
              onChange={setEdit('location')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="edit-sess-capacity">Capacity</label>
            <input
              id="edit-sess-capacity"
              type="number"
              min="0"
              className="input"
              value={editForm.capacity ?? ''}
              onChange={setEdit('capacity')}
            />
          </div>

          <label className="rowflex" style={{ gap: 'var(--s2)', fontSize: 'var(--fs-sm)' }}>
            <input type="checkbox" checked={!!editForm.recurring} onChange={setEdit('recurring')} />
            Recurring weekly
          </label>

          {editErr && (
            <p className="muted" style={{ color: 'var(--error, #e55)', fontSize: 'var(--fs-sm)' }}>
              {editErr}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
