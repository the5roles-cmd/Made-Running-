// RecordDetail — single-record view: AI summary, waiver/emergency contact,
// attendance history, Shopify purchase history, linked deals, activity timeline.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bot,
  MessageSquare,
  Plus,
  HeartHandshake,
  ShieldCheck,
  ClipboardCheck,
  ShoppingBag,
} from 'lucide-react'

import Modal from '../components/Modal'
import { PageHead, Badge, Empty, Loading } from '../components/ui'
import { stageMeta, statusMeta, ENTITIES, volunteerTypeLabel } from '../lib/constants'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useRow, useList, useInsert, useUpdate } from '../lib/useData'
import { summarise } from '../lib/api'
import { fetchShopifyOrders } from '../lib/shopify'
import { useAuth } from '../auth/AuthProvider'

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString()
}

export default function RecordDetail() {
  const { id } = useParams()
  const { orgId } = useAuth()

  // ── Primary record ─────────────────────────────────────────────
  const { row, loading, refresh } = useRow('records', id, '*, accounts(name)')

  // ── Linked deals ───────────────────────────────────────────────
  const { rows: deals, loading: dealsLoading } = useList('deals', {
    order: 'created_at',
    ascending: false,
    select: '*, accounts(name)',
  })
  const linkedDeals = deals.filter((d) => d.record_id === id)

  // ── Activities ─────────────────────────────────────────────────
  const { rows: activities, refresh: refreshActivities } = useList('activities', {
    order: 'occurred_at',
    ascending: false,
    select: '*',
  })
  const recordActivities = activities.filter((a) => a.record_id === id)

  // ── Update helpers ─────────────────────────────────────────────
  const update = useUpdate('records')
  const insertActivity = useInsert('activities')

  // ── Local state ────────────────────────────────────────────────
  const [summarising, setSummarising] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  // ── Volunteer badge (one extra small query) ─────────────────────
  const [volunteer, setVolunteer] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadVolunteer() {
      if (!supabaseConfigured || !orgId || !id) return
      const { data } = await supabase
        .from('volunteers')
        .select('*')
        .eq('runner_id', id)
        .eq('org_id', orgId)
        .maybeSingle()
      if (!cancelled) setVolunteer(data || null)
    }
    loadVolunteer()
    return () => { cancelled = true }
  }, [id, orgId])

  // ── Attendance history ───────────────────────────────────────────
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadAttendance() {
      if (!supabaseConfigured || !orgId || !id) {
        setAttendanceLoading(false)
        return
      }
      setAttendanceLoading(true)
      const { data } = await supabase
        .from('attendance')
        .select('*, sessions(title, starts_at)')
        .eq('runner_id', id)
        .eq('org_id', orgId)
        .order('attended_at', { ascending: false })
      if (!cancelled) {
        setAttendanceHistory(data || [])
        setAttendanceLoading(false)
      }
    }
    loadAttendance()
    return () => { cancelled = true }
  }, [id, orgId])

  // ── Shopify purchase history ─────────────────────────────────────
  const [shopifyOrders, setShopifyOrders] = useState([])
  const [shopifyLoading, setShopifyLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      setShopifyLoading(true)
      const orders = await fetchShopifyOrders(orgId, id)
      if (!cancelled) {
        setShopifyOrders(orders || [])
        setShopifyLoading(false)
      }
    }
    if (orgId && id) loadOrders()
    else setShopifyLoading(false)
    return () => { cancelled = true }
  }, [orgId, id])

  // ── Waiver / emergency-contact edit modal ────────────────────────
  const [waiverOpen, setWaiverOpen] = useState(false)
  const [waiverForm, setWaiverForm] = useState({})
  const [waiverSaving, setWaiverSaving] = useState(false)
  const [waiverErr, setWaiverErr] = useState(null)

  function openWaiverEdit() {
    if (!row) return
    setWaiverForm({
      emergency_contact_name: row.emergency_contact_name || '',
      emergency_contact_phone: row.emergency_contact_phone || '',
      waiver_signed_at: row.waiver_signed_at ? row.waiver_signed_at.slice(0, 10) : '',
    })
    setWaiverErr(null)
    setWaiverOpen(true)
  }

  function setWaiverField(field) {
    return (e) => setWaiverForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleWaiverSave(e) {
    e.preventDefault()
    setWaiverSaving(true)
    setWaiverErr(null)
    try {
      await update(id, {
        emergency_contact_name: waiverForm.emergency_contact_name || null,
        emergency_contact_phone: waiverForm.emergency_contact_phone || null,
        waiver_signed_at: waiverForm.waiver_signed_at
          ? new Date(waiverForm.waiver_signed_at).toISOString()
          : null,
      })
      await refresh()
      setWaiverOpen(false)
    } catch (err) {
      setWaiverErr(err.message)
    } finally {
      setWaiverSaving(false)
    }
  }

  // ── AI summary ─────────────────────────────────────────────────
  async function handleGenerateSummary() {
    if (!row) return
    setSummarising(true)
    setSummaryError('')
    try {
      const text = row.text_blob || row.title || ''
      const { summary } = await summarise(text)
      await update(id, { ai_summary: summary })
      refresh()
    } catch (err) {
      const msg = err?.message || ''
      setSummaryError(
        msg.includes('503') || msg.includes('failed')
          ? 'Assistant not configured'
          : 'Could not generate summary',
      )
    } finally {
      setSummarising(false)
    }
  }

  // ── Add note ───────────────────────────────────────────────────
  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteBody.trim()) return
    setSavingNote(true)
    try {
      await insertActivity({
        kind: 'note',
        body: noteBody.trim(),
        record_id: id,
        account_id: row?.account_id || null,
        occurred_at: new Date().toISOString(),
      })
      setNoteBody('')
      setAddingNote(false)
      refreshActivities()
    } catch {
      // silent fail
    } finally {
      setSavingNote(false)
    }
  }

  // ── Guards ─────────────────────────────────────────────────────
  if (loading) return <div className="page"><Loading /></div>
  if (!row) {
    return (
      <div className="page">
        <Link to="/app/records" className="btn btn--ghost btn--sm" style={{ marginBottom: 'var(--s4)' }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <Empty title="Record not found" />
      </div>
    )
  }

  const statusM = statusMeta(row.status)
  const created = row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* Back nav */}
      <Link
        to="/app/records"
        className="btn btn--ghost btn--sm"
        style={{ marginBottom: 'var(--s4)', display: 'inline-flex' }}
      >
        <ArrowLeft size={14} /> Back to {ENTITIES.record.plural}
      </Link>

      {/* Header */}
      <PageHead eyebrow="Community" title={row.title}>
        <Badge meta={statusM} />
      </PageHead>

      {/* Meta row */}
      <div className="rowflex" style={{ gap: 'var(--s4)', marginBottom: 'var(--s5)', flexWrap: 'wrap' }}>
        {row.tags?.length > 0 && (
          <div className="chiprow">
            {row.tags.map((tag) => (
              <span key={tag} className="chip">{tag}</span>
            ))}
          </div>
        )}
        {row.accounts?.name && (
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {ENTITIES.account.singular}:{' '}
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{row.accounts.name}</span>
          </span>
        )}
        {volunteer && (
          <span className="chip">
            <HeartHandshake size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Volunteer · {volunteerTypeLabel(volunteer.volunteer_type)}
          </span>
        )}
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Created {created}</span>
      </div>

      {/* Body */}
      <div className="stack">

        {/* AI Summary card */}
        <div className="card">
          <div className="spread" style={{ marginBottom: 'var(--s3)' }}>
            <div className="rowflex" style={{ gap: 'var(--s2)' }}>
              <Bot size={16} style={{ color: 'var(--accent-ink)' }} />
              <span className="display" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                AI Summary
              </span>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleGenerateSummary}
              disabled={summarising}
            >
              {summarising ? 'Generating…' : 'Generate summary'}
            </button>
          </div>
          {summaryError ? (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{summaryError}</p>
          ) : row.ai_summary ? (
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.65 }}>{row.ai_summary}</p>
          ) : (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              No summary yet — click "Generate summary" to create one.
            </p>
          )}
        </div>

        {/* Source text card */}
        {row.text_blob && (
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>Source</div>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {row.text_blob}
            </p>
          </div>
        )}

        {/* Waiver / emergency contact card */}
        <div className="card">
          <div className="spread" style={{ marginBottom: 'var(--s3)' }}>
            <div className="rowflex" style={{ gap: 'var(--s2)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent-ink)' }} />
              <span className="display" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                Waiver &amp; emergency contact
              </span>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={openWaiverEdit}>
              Edit
            </button>
          </div>
          <div className="grid grid--2" style={{ gap: 'var(--s3)' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Emergency contact</div>
              <p style={{ fontSize: 'var(--fs-sm)' }}>
                {row.emergency_contact_name || '—'}
                {row.emergency_contact_phone && (
                  <span className="muted"> · {row.emergency_contact_phone}</span>
                )}
              </p>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Waiver signed</div>
              <p style={{ fontSize: 'var(--fs-sm)' }}>
                {row.waiver_signed_at ? fmtDate(row.waiver_signed_at) : (
                  <span className="muted">Not signed</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Attendance history card */}
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>Attendance</div>
          {attendanceLoading ? (
            <Loading rows={2} />
          ) : attendanceHistory.length === 0 ? (
            <Empty
              icon={ClipboardCheck}
              title="No attendance yet"
              hint="Sessions this runner checks into will appear here."
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {attendanceHistory.map((a) => (
                <div
                  key={a.id}
                  className="rowflex spread"
                  style={{ padding: 'var(--s2) 0', borderBottom: '1px solid var(--line-soft)' }}
                >
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                    {a.sessions?.title || 'Session'}
                  </span>
                  <span className="mono faint" style={{ fontSize: 'var(--fs-xs)' }}>
                    {fmtDate(a.attended_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shopify purchase history card */}
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
            <ShoppingBag size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Purchase history
          </div>
          <div className="rowflex" style={{ gap: 'var(--s6)', marginBottom: 'var(--s4)' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Lifetime spend</div>
              <div className="display mono" style={{ fontSize: 'var(--fs-md)' }}>
                £{Number(row.lifetime_spend || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Last order</div>
              <div className="display" style={{ fontSize: 'var(--fs-md)' }}>
                {row.last_order_at ? fmtDate(row.last_order_at) : '—'}
              </div>
            </div>
          </div>
          {shopifyLoading ? (
            <Loading rows={2} />
          ) : shopifyOrders.length === 0 ? (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>No Shopify orders on file.</p>
          ) : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {shopifyOrders.map((o) => (
                <div
                  key={o.id}
                  className="rowflex spread"
                  style={{ padding: 'var(--s2) 0', borderBottom: '1px solid var(--line-soft)' }}
                >
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                    {o.order_number}
                    {o.items && <span className="muted"> · {o.items}</span>}
                  </span>
                  <div className="rowflex" style={{ gap: 'var(--s3)' }}>
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      £{Number(o.total || 0).toLocaleString()}
                    </span>
                    <span className="mono faint" style={{ fontSize: 'var(--fs-xs)' }}>
                      {fmtDate(o.ordered_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked deals card */}
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
            Linked {ENTITIES.deal.plural}
          </div>
          {dealsLoading ? (
            <Loading rows={2} />
          ) : linkedDeals.length === 0 ? (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>No deals linked to this record.</p>
          ) : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {linkedDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="rowflex spread"
                  style={{
                    padding: 'var(--s2) 0',
                    borderBottom: '1px solid var(--line-soft)',
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{deal.title}</span>
                  <div className="rowflex" style={{ gap: 'var(--s3)' }}>
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      £{Number(deal.value || 0).toLocaleString()}
                    </span>
                    <Badge meta={stageMeta(deal.stage)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity timeline card */}
        <div className="card">
          <div className="spread" style={{ marginBottom: 'var(--s4)' }}>
            <div className="eyebrow">Activity</div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setAddingNote((v) => !v)}
            >
              <Plus size={14} /> Add note
            </button>
          </div>

          {/* Add-note inline form */}
          {addingNote && (
            <form onSubmit={handleAddNote} style={{ marginBottom: 'var(--s4)' }}>
              <div className="field">
                <label htmlFor="note-body">Note</label>
                <textarea
                  id="note-body"
                  className="textarea"
                  placeholder="Write a note…"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="rowflex" style={{ gap: 'var(--s2)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => { setAddingNote(false); setNoteBody('') }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={savingNote}>
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </form>
          )}

          {/* Timeline items */}
          {recordActivities.length === 0 ? (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>No activity yet.</p>
          ) : (
            <div className="timeline">
              {recordActivities.map((act) => (
                <div key={act.id} className="tl__item">
                  <div className="tl__dot">
                    <MessageSquare size={13} />
                  </div>
                  <div className="tl__body">
                    <div className="spread">
                      <span
                        className="display"
                        style={{ fontSize: 'var(--fs-xs)', textTransform: 'capitalize', color: 'var(--muted)' }}
                      >
                        {act.kind?.replace('_', ' ') || 'note'}
                      </span>
                      <span className="mono faint" style={{ fontSize: 'var(--fs-xs)' }}>
                        {act.occurred_at
                          ? new Date(act.occurred_at).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>{act.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Waiver / emergency contact edit modal */}
      <Modal
        open={waiverOpen}
        onClose={() => setWaiverOpen(false)}
        title="Edit waiver &amp; emergency contact"
        footer={
          <div className="spread">
            <button className="btn btn--ghost" onClick={() => setWaiverOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleWaiverSave}
              disabled={waiverSaving}
              style={{ minHeight: 44 }}
            >
              {waiverSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleWaiverSave} className="stack" style={{ gap: 'var(--s4)' }}>
          <div className="field">
            <label className="eyebrow" htmlFor="waiver-name">Emergency contact name</label>
            <input
              id="waiver-name"
              className="input"
              value={waiverForm.emergency_contact_name || ''}
              onChange={setWaiverField('emergency_contact_name')}
              autoFocus
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="waiver-phone">Emergency contact phone</label>
            <input
              id="waiver-phone"
              className="input"
              value={waiverForm.emergency_contact_phone || ''}
              onChange={setWaiverField('emergency_contact_phone')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="waiver-signed">Waiver signed on</label>
            <input
              id="waiver-signed"
              type="date"
              className="input"
              value={waiverForm.waiver_signed_at || ''}
              onChange={setWaiverField('waiver_signed_at')}
            />
          </div>

          {waiverErr && (
            <p className="muted" style={{ color: 'var(--error, #e55)', fontSize: 'var(--fs-sm)' }}>
              {waiverErr}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
