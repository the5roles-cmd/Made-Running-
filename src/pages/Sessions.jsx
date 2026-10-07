// Sessions — the weekly-run list (Module A · Community).
// `sessions` table filtered client-side to type === 'run' (RUN_SESSION_TYPES).
// Hub workshops/training/networking live on the same table but render on
// Gym.jsx instead — see RUN_SESSION_TYPES / GYM_TIMETABLE_TYPES in constants.js.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, Repeat } from 'lucide-react'

import Modal from '../components/Modal'
import SetupNotice from '../components/SetupNotice'
import { PageHead, Empty, Loading } from '../components/ui'
import { RUN_SESSION_TYPES } from '../lib/constants'
import { useList, useInsert } from '../lib/useData'

const EMPTY_FORM = {
  title: '',
  chapter_id: '',
  starts_at: '',
  location: '',
  capacity: '',
  recurring: false,
}

function fmtWhen(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Sessions() {
  const navigate = useNavigate()
  const { rows, loading, refresh } = useList('sessions', {
    order: 'starts_at',
    ascending: true,
    select: '*, chapters(name)',
  })
  const { rows: chapters } = useList('chapters', { order: 'name', ascending: true })
  const insert = useInsert('sessions')

  const runType = RUN_SESSION_TYPES[0]?.value || 'run'
  const sessions = rows.filter((s) => s.type === runType)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  function openModal() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function set(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await insert({
        title: form.title.trim(),
        type: runType,
        chapter_id: form.chapter_id || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        location: form.location || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        recurring: !!form.recurring,
      })
      await refresh()
      setOpen(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = form.title.trim().length > 0 && !saving

  return (
    <div className="page">
      <SetupNotice />

      <PageHead eyebrow="Community" title="Sessions" sub="Weekly runs across every chapter.">
        <button className="btn btn--primary" onClick={openModal} style={{ minHeight: 44 }}>
          <Plus size={16} />
          New session
        </button>
      </PageHead>

      {loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <div className="card">
          <Empty
            icon={CalendarDays}
            title="No sessions yet"
            hint="Add your first weekly run to start tracking attendance."
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Chapter</th>
                <th>When</th>
                <th>Location</th>
                <th>Capacity</th>
                <th>Recurring</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="clickable"
                  onClick={() => navigate(`/app/sessions/${s.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className="display" style={{ fontSize: 'var(--fs-sm)' }}>{s.title}</span>
                  </td>
                  <td className="muted">{s.chapters?.name || '—'}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{fmtWhen(s.starts_at)}</td>
                  <td className="muted">{s.location || '—'}</td>
                  <td className="mono">{s.capacity ?? '∞'}</td>
                  <td>
                    {s.recurring ? (
                      <span className="chip">
                        <Repeat size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Weekly
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New session"
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
              {saving ? 'Saving…' : 'Create session'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--s4)' }}>
          <div className="field">
            <label className="eyebrow" htmlFor="sess-title">
              Title <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              id="sess-title"
              className="input"
              placeholder="Tuesday evening run"
              value={form.title}
              onChange={set('title')}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="sess-chapter">Chapter</label>
            <select id="sess-chapter" className="select" value={form.chapter_id} onChange={set('chapter_id')}>
              <option value="">— None —</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="sess-starts">When</label>
            <input
              id="sess-starts"
              type="datetime-local"
              className="input"
              value={form.starts_at}
              onChange={set('starts_at')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="sess-location">Location</label>
            <input
              id="sess-location"
              className="input"
              placeholder="Piccadilly Gardens"
              value={form.location}
              onChange={set('location')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="sess-capacity">Capacity</label>
            <input
              id="sess-capacity"
              type="number"
              min="0"
              className="input"
              placeholder="Leave blank for uncapped"
              value={form.capacity}
              onChange={set('capacity')}
            />
          </div>

          <label className="rowflex" style={{ gap: 'var(--s2)', fontSize: 'var(--fs-sm)' }}>
            <input type="checkbox" checked={form.recurring} onChange={set('recurring')} />
            Recurring weekly
          </label>

          {err && (
            <p className="muted" style={{ color: 'var(--error, #e55)', fontSize: 'var(--fs-sm)' }}>
              {err}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
