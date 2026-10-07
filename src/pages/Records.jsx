// Records — list view + add modal.
// Workspace entity list with AI-powered summary enrichment (non-blocking).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'

import Modal from '../components/Modal'
import SetupNotice from '../components/SetupNotice'
import { PageHead, Badge, Empty, Loading } from '../components/ui'
import { ENTITIES, RECORD_STATUSES, statusMeta } from '../lib/constants'
import { useList, useInsert, useUpdate } from '../lib/useData'
import { summarise } from '../lib/api'

export default function Records() {
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────────────────────────────
  const { rows, loading, refresh } = useList('records', {
    order: 'created_at',
    ascending: false,
    select: '*, accounts(name)',
  })
  const { rows: accounts } = useList('accounts', { order: 'name', ascending: true })
  const insert = useInsert('records')
  const update = useUpdate('records')

  // ── Modal state ───────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    status: 'new',
    tags: '',
    account_id: '',
    text_blob: '',
  })

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  function openModal() {
    setForm({ title: '', status: 'new', tags: '', account_id: '', text_blob: '' })
    setOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const tagsArray = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : []

      const newRow = await insert({
        title: form.title.trim(),
        status: form.status,
        tags: tagsArray,
        account_id: form.account_id || null,
        text_blob: form.text_blob || null,
      })

      setOpen(false)
      refresh()

      // Non-blocking AI summary enrichment
      if (newRow && form.text_blob) {
        ;(async () => {
          try {
            const { summary } = await summarise(form.text_blob)
            await update(newRow.id, { ai_summary: summary })
            refresh()
          } catch {
            // 503 or unconfigured — silently skip
          }
        })()
      }
    } catch {
      // insert failed — surface nothing to user; they can retry
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="page">
      <SetupNotice />

      <PageHead
        eyebrow="Community"
        title={ENTITIES.record.plural}
        sub={`Manage and track ${ENTITIES.record.plural.toLowerCase()} and their community lifecycle.`}
      >
        <button className="btn btn--primary" onClick={openModal}>
          <Plus size={16} />
          New {ENTITIES.record.singular}
        </button>
      </PageHead>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty
          icon={FolderKanban}
          title={`No ${ENTITIES.record.plural.toLowerCase()} yet`}
          hint={`Click "New ${ENTITIES.record.singular}" to add your first one.`}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Tags</th>
                <th>{ENTITIES.account.singular}</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/app/records/${r.id}`)}>
                  <td>
                    <span className="display" style={{ fontSize: 'var(--fs-sm)' }}>
                      {r.title}
                    </span>
                  </td>
                  <td>
                    <Badge meta={statusMeta(r.status)} />
                  </td>
                  <td>
                    {r.tags?.length ? (
                      <div className="chiprow">
                        {r.tags.map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>
                    <span className="muted">{r.accounts?.name || '—'}</span>
                  </td>
                  <td>
                    <span className="muted mono" style={{ fontSize: 'var(--fs-xs)' }}>
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Record Modal ─────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`New ${ENTITIES.record.singular}`}
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="btn btn--primary"
              form="record-form"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="record-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="rec-title">Title *</label>
            <input
              id="rec-title"
              name="title"
              className="input"
              placeholder="Record title"
              value={form.title}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="rec-status">Status</label>
            <select
              id="rec-status"
              name="status"
              className="select"
              value={form.status}
              onChange={handleChange}
            >
              {RECORD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rec-tags">Tags (comma-separated)</label>
            <input
              id="rec-tags"
              name="tags"
              className="input"
              placeholder="e.g. priority, Q3, review"
              value={form.tags}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label htmlFor="rec-account">{ENTITIES.account.singular}</label>
            <select
              id="rec-account"
              name="account_id"
              className="select"
              value={form.account_id}
              onChange={handleChange}
            >
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rec-blob">Notes / source text</label>
            <textarea
              id="rec-blob"
              name="text_blob"
              className="textarea"
              placeholder="Paste or type source content. AI will summarise it after saving."
              value={form.text_blob}
              onChange={handleChange}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
