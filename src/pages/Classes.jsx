// ============================================================
// CLASSES — flow-chart Step 1a + Step 2.
//
//   Step 1  · A class exists, with a name and a coach.
//   Step 1a · The coach (or an admin) manages THEIR classes here.
//   Step 2  · Each class has ONE shareable link, copied from this screen and
//             pasted into the WhatsApp group.
//
// WHO SEES WHAT — the same table, two different products:
//   admin/owner → every class in the club, and may create/delete
//   coach       → ONLY their own classes, and may edit but not create
//
// The coach narrowing happens in the QUERY (see useManagedClasses), not in
// this component. Nothing on this page filters a club-wide list down for
// display, because that would mean the browser had already been handed every
// other coach's classes.
//
// NO CLASS NAME IS HARD-CODED ANYWHERE IN THIS FILE. Every name, coach name,
// day and time is read from the class row, so renaming a class in the edit
// modal updates the table, the link preview and the share message on the next
// read — which is your dynamic-names rule holding without any extra work.
// ============================================================
import { useMemo, useState } from 'react'
import {
  CalendarClock, Check, Copy, Dumbbell, Link2, Pause, Pencil,
  Plus, RefreshCw, Share2, Users, Venus,
} from 'lucide-react'

import Modal from '../components/Modal'
import SetupNotice from '../components/SetupNotice'
import { PageHead, Empty, Loading } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import {
  classShareMessage, classShareUrl, createClass, dayLabel, fmtPrice,
  fmtTime, fmtWhen, generateSessions, nextSession, scheduledCount, slugify,
  updateClass, useCoachOptions, useManagedClasses, videoEmbed,
  imageSrc, imageFocus,
} from '../lib/classes'

const EMPTY_FORM = {
  name: '',
  coach_name: '',
  coach_id: '',
  description: '',
  location: '',
  capacity: '40',          // your rule: 40 is the default, configurable per class
  price: '',               // pounds in the input, pennies in the database
  recurrence_day: '',
  recurrence_time: '',
  female_only: false,
  is_paused: false,
  pause_note: '',
  video_url: '',           // https only; YouTube/Vimeo get framed, others link
  video_caption: '',
  image_url: '',           // https only; overrides the discipline default band
  image_focus: '',         // object-position; '' means centre
}

// Turn a class ROW back into FORM state. Separate from EMPTY_FORM because the
// database stores pennies and a `time` while the form holds pounds and a
// string — converting in one place stops the edit modal ever showing "1000"
// in a field labelled £.
function formFromClass(c) {
  return {
    name: c.name || '',
    coach_name: c.coach_name || '',
    coach_id: c.coach_id || '',
    description: c.description || '',
    location: c.location || '',
    capacity: String(c.capacity ?? 40),
    price: c.price_pennies ? (c.price_pennies / 100).toFixed(2) : '',
    recurrence_day: c.recurrence_day === null ? '' : String(c.recurrence_day),
    // `time` comes back as '09:30:00'; <input type="time"> wants 'HH:MM'.
    recurrence_time: (c.recurrence_time || '').slice(0, 5),
    female_only: !!c.female_only,
    is_paused: !!c.is_paused,
    pause_note: c.pause_note || '',
    video_url: c.video_url || '',
    video_caption: c.video_caption || '',
    image_url: c.image_url || '',
    // Empty, not 'center'. The database stores null for "never set", and
    // pre-filling the box with 'center' would turn every subsequent save into
    // an explicit choice the coach never made.
    image_focus: c.image_focus || '',
  }
}

// ── Judging a pasted video link, while it is still being typed ────────
// Three outcomes, not two, because "we will refuse to save this" and "we will
// save it but it will not play in the page" are different news and the coach
// can only act on the difference. Collapsing them into one red warning trains
// people to ignore it.
//
// Deliberately tolerant of a half-typed URL: `status: 'typing'` says nothing
// at all. A field that goes red on the 'h' of https and stays red until the
// last character is a field that is red the entire time it is being used, and
// a warning that is always on is a warning nobody reads.
function judgeVideoUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return { status: 'empty' }

  // Shorter than the shortest real link. Almost certainly mid-paste.
  if (v.length < 12 && !/^https:\/\/\S+\.\S/.test(v)) return { status: 'typing' }

  if (!/^https:\/\//i.test(v)) return { status: 'notHttps' }

  const embed = videoEmbed(v)
  // videoEmbed() is the SAME function the public page uses, so this preview
  // cannot disagree with what members will actually get. A separate
  // "does it look like YouTube?" regex here is how a form ends up promising a
  // video that the page then refuses to frame.
  if (embed) return { status: 'ok', provider: embed.provider, src: embed.src }
  return { status: 'notEmbeddable' }
}

const VIDEO_PROVIDER_LABEL = { youtube: 'YouTube', vimeo: 'Vimeo' }

// Copy that works when the page is not on HTTPS. navigator.clipboard is
// undefined on plain http (other than localhost), which is exactly where this
// gets demoed over the LAN — so the textarea fallback is not legacy cruft,
// it is the path that runs on 192.168.x.x.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function Classes() {
  const { orgId } = useAuth()
  const { rows, loading, error, missing, refresh, isStaff } = useManagedClasses()
  const coaches = useCoachOptions()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)     // null = creating
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState(null)

  const [copiedId, setCopiedId] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState(null)

  // Grouped by day so the screen reads like the club's printed timetable
  // rather than like a database table. Sunday last: the club's week runs
  // Monday→Sunday even though the STORED values are 0=Sunday (Postgres's
  // convention). This is the only place the two orders differ, and it is a
  // display concern only — the stored value is untouched.
  const byDay = useMemo(() => {
    const order = [1, 2, 3, 4, 5, 6, 0]
    return order
      .map((d) => ({ day: d, items: rows.filter((r) => r.recurrence_day === d) }))
      .filter((g) => g.items.length > 0)
      .concat(
        rows.some((r) => r.recurrence_day === null)
          ? [{ day: null, items: rows.filter((r) => r.recurrence_day === null) }]
          : [],
      )
  }, [rows])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErr(null)
    setOpen(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm(formFromClass(c))
    setFormErr(null)
    setOpen(true)
  }

  function set(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  // Derived on every render rather than held in state, deliberately. A second
  // piece of state mirroring the input can fall out of step with it — set the
  // form from an existing class and the verdict would still describe the
  // previous one until something touched the field. There is nothing to keep
  // in sync if there is nothing stored.
  const videoVerdict = judgeVideoUrl(form.video_url)

  // Two states, not three, and that is the whole difference between this field
  // and the video one above. A video URL has a middle case — valid, saveable,
  // but not playable in the page — because only some hosts can be framed. An
  // image has no such case: any https URL that resolves to an image works, and
  // any that does not simply shows nothing. There is no "it will save but
  // behave unexpectedly" to warn about, so inventing a third verdict here would
  // be symmetry for its own sake.
  //
  // Tolerant while typing for the same reason judgeVideoUrl is: a field that
  // turns red on the 'h' of https is red for the entire time it is in use.
  const imageVerdict = (() => {
    const v = form.image_url.trim()
    if (!v) return 'empty'
    if (imageSrc(v)) return 'ok'
    if (v.length < 12 && !/^https:\/\/\S+\.\S/.test(v)) return 'typing'
    return 'notHttps'
  })()

  async function handleSubmit(e) {
    e?.preventDefault?.()
    if (!form.name.trim()) return
    setSaving(true)
    setFormErr(null)
    try {
      if (editing) await updateClass(editing.id, orgId, form)
      else await createClass(orgId, form)
      // New/changed recurrence means the dated sessions are now stale, so
      // regenerate immediately. A coach should not have to know that a
      // "class" and its "sessions" are two tables.
      await generateSessions(orgId).catch(() => {})
      await refresh()
      setOpen(false)
    } catch (err) {
      setFormErr(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy(c, asMessage) {
    const text = asMessage ? classShareMessage(c) : classShareUrl(c.slug)
    const ok = await copyText(text)
    if (ok) {
      setCopiedId(`${c.id}:${asMessage ? 'msg' : 'url'}`)
      setTimeout(() => setCopiedId(null), 1800)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenMsg(null)
    try {
      const made = await generateSessions(orgId)
      await refresh()
      // Says 0 honestly rather than claiming success. Pressing this twice
      // SHOULD add nothing — the generator is idempotent — and a message
      // saying "8 added" both times would be a lie that hides a bug.
      setGenMsg(made === 0 ? 'Already up to date — nothing to add.' : `Added ${made} new dates.`)
    } catch (err) {
      setGenMsg(err.message)
    } finally {
      setGenerating(false)
      setTimeout(() => setGenMsg(null), 5000)
    }
  }

  const canSubmit = form.name.trim().length > 0 && !saving
  const slugPreview = editing
    ? editing.slug
    : slugify(form.name) +
      (form.recurrence_day !== '' && form.recurrence_time
        ? `-${dayLabel(form.recurrence_day, true).toLowerCase()}-${form.recurrence_time.replace(':', '')}`
        : '')

  return (
    <div className="page">
      <SetupNotice />

      <PageHead
        eyebrow={isStaff ? 'The Gym' : 'My classes'}
        title="Classes"
        sub={
          isStaff
            ? 'Every class in the club. Each one has its own link to share.'
            : 'The classes you coach. Share your link to fill them.'
        }
      >
        <button
          className="btn btn--ghost"
          onClick={handleGenerate}
          disabled={generating}
          style={{ minHeight: 44 }}
          title="Create the next weeks of dated, bookable sessions from each class's weekly slot"
        >
          <RefreshCw size={16} />
          {generating ? 'Generating…' : 'Refresh dates'}
        </button>
        {/* Creating is staff-only, and the button is hidden rather than
            disabled for coaches — the database refuses it anyway
            (classes_insert requires is_org_staff), so showing a button that
            can only fail would be a worse experience than not showing it. */}
        {isStaff && (
          <button className="btn btn--primary" onClick={openCreate} style={{ minHeight: 44 }}>
            <Plus size={16} />
            New class
          </button>
        )}
      </PageHead>

      {genMsg && (
        <div className="card" style={{ padding: 'var(--s3) var(--s4)', marginBottom: 'var(--s4)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{genMsg}</span>
        </div>
      )}

      {missing ? (
        <div className="card">
          <Empty
            icon={Dumbbell}
            title="Class booking isn't installed yet"
            hint="Run supabase-classes.sql then supabase-classes-seed.sql in the Supabase SQL Editor, then reload this page."
          />
        </div>
      ) : loading ? (
        <Loading />
      ) : error ? (
        <div className="card">
          <Empty icon={Dumbbell} title="Couldn't load classes" hint={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty
            icon={Dumbbell}
            title={isStaff ? 'No classes yet' : 'No classes assigned to you yet'}
            hint={
              isStaff
                ? 'Add your first class, then copy its link into the group chat.'
                : 'An admin needs to assign you to a class before it appears here.'
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 'var(--s5)' }}>
          {byDay.map((group) => (
            <section key={String(group.day)}>
              <p className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>
                {group.day === null ? 'No weekly slot set' : `${dayLabel(group.day)}s`}
              </p>

              <div className="stack" style={{ gap: 'var(--s3)' }}>
                {group.items.map((c) => {
                  const next = nextSession(c)
                  const upcoming = scheduledCount(c)
                  return (
                    <article key={c.id} className="card" style={{ padding: 'var(--s4)' }}>
                      <div className="spread" style={{ alignItems: 'flex-start', gap: 'var(--s3)' }}>
                        <div style={{ minWidth: 0 }}>
                          <h3 className="display" style={{ fontSize: 'var(--fs-md)' }}>
                            {/* Read from the row. Rename the class and this
                                changes with no other edit anywhere. */}
                            {c.name}
                          </h3>

                          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                            {fmtTime(c.recurrence_time)}
                            {/* The "with …" line is OMITTED when no coach is
                                named, rather than printing "with null" or
                                inventing one. Dog Business HIIT has no coach
                                on the club's own PDF. */}
                            {c.coach_name ? ` · with ${c.coach_name}` : ''}
                            {c.location ? ` · ${c.location}` : ''}
                          </p>

                          <div className="rowflex" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
                            <span className="chip">
                              <Users size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                              {c.capacity} places
                            </span>
                            <span className="chip">{fmtPrice(c.price_pennies)}</span>
                            {c.female_only && (
                              <span className="chip">
                                <Venus size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                Women only
                              </span>
                            )}
                            {c.is_paused && (
                              <span className="chip">
                                <Pause size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                {/* Paused shows its REASON. A paused class with
                                    no explanation reads as cancelled. */}
                                Paused{c.pause_note ? ` — ${c.pause_note}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <button className="btn btn--ghost btn--sm" onClick={() => openEdit(c)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                      </div>

                      {/* ── Step 2: the link ─────────────────────────── */}
                      <div
                        style={{
                          marginTop: 'var(--s4)',
                          paddingTop: 'var(--s3)',
                          borderTop: '1px solid var(--line, rgba(0,0,0,.08))',
                        }}
                      >
                        <div className="rowflex" style={{ gap: 'var(--s2)', flexWrap: 'wrap', alignItems: 'center' }}>
                          <Link2 size={14} className="faint" />
                          <code
                            className="mono"
                            style={{ fontSize: 'var(--fs-xs)', wordBreak: 'break-all', flex: '1 1 220px' }}
                          >
                            {classShareUrl(c.slug)}
                          </code>

                          <button className="btn btn--ghost btn--sm" onClick={() => handleCopy(c, false)}>
                            {copiedId === `${c.id}:url` ? <Check size={14} /> : <Copy size={14} />}
                            {copiedId === `${c.id}:url` ? 'Copied' : 'Copy link'}
                          </button>

                          {/* The link alone lands in a group chat with no
                              context. This copies the whole message — name,
                              day, time, coach, price, link — all of it read
                              from the class row. */}
                          <button className="btn btn--ghost btn--sm" onClick={() => handleCopy(c, true)}>
                            {copiedId === `${c.id}:msg` ? <Check size={14} /> : <Share2 size={14} />}
                            {copiedId === `${c.id}:msg` ? 'Copied' : 'Copy message'}
                          </button>
                        </div>

                        <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s2)' }}>
                          <CalendarClock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {next
                            ? `Next on ${fmtWhen(next.starts_at)} · ${upcoming} date${upcoming === 1 ? '' : 's'} open`
                            : 'No upcoming dates — press “Refresh dates”.'}
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Create / edit ─────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New class'}
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
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create class'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--s4)' }}>
          <div className="field">
            <label className="eyebrow" htmlFor="cls-name">
              Class name <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              id="cls-name"
              className="input"
              placeholder="Hot Kettlebells"
              value={form.name}
              onChange={set('name')}
              required
              autoFocus
            />
            {/* Spelling out the rename behaviour where the rename happens.
                A coach editing a name deserves to know the link survives —
                otherwise they will avoid fixing a typo for fear of breaking
                what they already sent to the group. */}
            {editing ? (
              <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                Renaming updates this class everywhere it appears. The link
                below keeps working — anything already shared stays valid.
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="eyebrow">Link</label>
            <code className="mono" style={{ fontSize: 'var(--fs-xs)', wordBreak: 'break-all' }}>
              {slugPreview ? classShareUrl(slugPreview) : '—'}
            </code>
            {editing ? (
              <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                Fixed for the life of the class.
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="cls-coachname">Coach shown to members</label>
            <input
              id="cls-coachname"
              className="input"
              placeholder="Jade"
              value={form.coach_name}
              onChange={set('coach_name')}
            />
            <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
              Leave blank to show no coach. Members see “with {form.coach_name.trim() || '…'}”.
            </p>
          </div>

          {/* Reassigning the class to a different login is an ADMIN act: it
              changes who can see that class's bookings. A coach editing their
              own class must not be able to hand it to someone else, or take
              someone else's. */}
          {isStaff && (
            <div className="field">
              <label className="eyebrow" htmlFor="cls-coachid">Coach login (controls who sees the bookings)</label>
              <select id="cls-coachid" className="select" value={form.coach_id} onChange={set('coach_id')}>
                <option value="">— Not linked to a login yet —</option>
                {coaches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.role} · {m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rowflex" style={{ gap: 'var(--s3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="eyebrow" htmlFor="cls-day">Day</label>
              <select id="cls-day" className="select" value={form.recurrence_day} onChange={set('recurrence_day')}>
                <option value="">— None —</option>
                {/* Monday-first for reading; the VALUE is still Postgres's
                    0=Sunday, so nothing is translated on the way to the DB. */}
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>{dayLabel(d)}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="eyebrow" htmlFor="cls-time">Start time</label>
              <input
                id="cls-time"
                type="time"
                className="input"
                value={form.recurrence_time}
                onChange={set('recurrence_time')}
              />
            </div>
          </div>

          <div className="rowflex" style={{ gap: 'var(--s3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="eyebrow" htmlFor="cls-cap">Places</label>
              <input
                id="cls-cap"
                type="number"
                min="1"
                className="input"
                value={form.capacity}
                onChange={set('capacity')}
              />
              <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                A group of 5 uses 5 places.
              </p>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="eyebrow" htmlFor="cls-price">Price (£)</label>
              <input
                id="cls-price"
                className="input"
                placeholder="Leave blank for free"
                value={form.price}
                onChange={set('price')}
              />
            </div>
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="cls-loc">Location</label>
            <input
              id="cls-loc"
              className="input"
              placeholder="MADE Hub"
              value={form.location}
              onChange={set('location')}
            />
          </div>

          <div className="field">
            <label className="eyebrow" htmlFor="cls-desc">Who is it for / what to expect</label>
            <textarea
              id="cls-desc"
              className="input"
              rows={3}
              placeholder="All levels. Bring water and a towel."
              value={form.description}
              onChange={set('description')}
            />
          </div>

          {/* ── Section 2: the class's video clip ──────────────────────────
              The column, the CHECK constraint and the public <iframe> have all
              existed since the classes schema went in — what was missing was
              any way for a coach to fill it, so the feature was reachable only
              by someone writing SQL. This is that missing half.

              The preview below is not decoration. This field is the single
              most dangerous input in the admin surface: its value becomes an
              iframe src on a public page. It is guarded three times over (the
              https CHECK in Postgres, the host allowlist in videoEmbed(), and
              cleanVideoUrl() on the way in), and the consequence of that
              layering is that a coach can paste a URL which saves perfectly
              and then does not play. Showing them the verdict BEFORE they save
              is what stops that being discovered by a member. */}
          <div className="field">
            <label className="eyebrow" htmlFor="cls-video">
              Video link <span className="muted">optional</span>
            </label>
            <input
              id="cls-video"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.video_url}
              onChange={set('video_url')}
              aria-describedby="cls-video-help"
            />
            <p id="cls-video-help" className="cls__videoNote">
              {videoVerdict.status === 'ok' ? (
                <>
                  Plays in the page as a{' '}
                  {VIDEO_PROVIDER_LABEL[videoVerdict.provider] || 'video'} clip.
                </>
              ) : videoVerdict.status === 'notHttps' ? (
                // A hard stop: cleanVideoUrl() will throw on save. Said now,
                // in words, rather than letting Postgres say
                // "violates check constraint classes_video_https" later.
                <span className="cls__videoBad">
                  This needs to start with <code>https://</code> — it won&rsquo;t
                  save as it is. Copy the link from the address bar of the video
                  page.
                </span>
              ) : videoVerdict.status === 'notEmbeddable' ? (
                // NOT an error. It saves, and members get a link they can
                // follow. Worth saying because the coach probably expected a
                // player, and the fix is usually "use the YouTube link instead".
                <span className="cls__videoWarn">
                  This will save, but it won&rsquo;t play inside the page —
                  members will see a &ldquo;Watch the clip&rdquo; link instead.
                  YouTube and Vimeo links play inline.
                </span>
              ) : (
                <>Paste a YouTube or Vimeo link and it plays on the class page.</>
              )}
            </p>
          </div>

          {/* Only once there is something to caption. An empty caption box
              above an empty URL box is two questions where there is no
              subject yet. */}
          {videoVerdict.status === 'ok' && (
            <div className="field">
              <label className="eyebrow" htmlFor="cls-videocap">
                Caption under the video <span className="muted">optional</span>
              </label>
              <input
                id="cls-videocap"
                className="input"
                placeholder="Last week's session"
                value={form.video_caption}
                onChange={set('video_caption')}
              />
            </div>
          )}

          {/* ── The card photo (step 2 artwork) ───────────────────────
              Optional by design, and the wording says so: leaving it blank is
              not an incomplete class, it is the normal case. The timetable
              already has artwork per discipline bundled with the app, so a
              blank field means "use the kettlebells picture", not "no picture".
              A coach who does not know that will paste something rather than
              leave a box empty, which is how twelve classes end up with twelve
              mismatched photos nobody chose. */}
          <div className="field">
            <label className="eyebrow" htmlFor="cls-image">
              Photo for this class <span className="muted">optional</span>
            </label>
            <input
              id="cls-image"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={form.image_url}
              onChange={set('image_url')}
              aria-describedby="cls-image-help"
            />
            <p id="cls-image-help" className="cls__videoNote">
              {imageVerdict === 'notHttps' ? (
                <span className="cls__videoBad">
                  This needs to start with <code>https://</code> — it won&rsquo;t
                  save as it is. Right-click the image, choose &ldquo;Copy image
                  address&rdquo;, and paste that.
                </span>
              ) : imageVerdict === 'ok' ? (
                <>Used instead of the standard picture for this kind of class.</>
              ) : (
                <>
                  Leave blank to use the standard picture for this kind of
                  class. Only add one if this class needs its own.
                </>
              )}
            </p>
          </div>

          {/* Focus only appears once there is an image, because until then it
              is an alignment control for nothing.

              A SELECT, not a text box. The column also accepts percentages
              ('50% 30%') and the constraint allows them, but a coach choosing
              between five words cannot produce a value that needs sanitising,
              cannot typo it, and does not have to be told the syntax. The
              percentage route stays open to anyone editing the row directly. */}
          {imageVerdict === 'ok' && (
            <>
              <div className="field">
                <label className="eyebrow" htmlFor="cls-imagefocus">
                  What to keep in frame
                </label>
                <select
                  id="cls-imagefocus"
                  className="input"
                  value={form.image_focus || 'center'}
                  onChange={set('image_focus')}
                >
                  <option value="center">Middle (default)</option>
                  <option value="top">Top of the photo</option>
                  <option value="bottom">Bottom of the photo</option>
                  <option value="left">Left side</option>
                  <option value="right">Right side</option>
                </select>
              </div>

              {/* The preview is a real timetable card, at the real size, with
                  the real crop AND the real scrim — not a thumbnail of the
                  source file. Two things about this field are impossible to
                  convey in help text and obvious in a picture: which part of
                  the photo survives the crop, and how much darker the card is
                  than the file they are looking at on their desktop. A preview
                  without the scrim would be a preview of something that does
                  not exist, and they would keep uploading photos to fix a
                  darkness that is not the photo's fault. */}
              <div className="field">
                <span className="eyebrow">How it will look on the timetable</span>
                <div className="cls__bandPreview">
                  <img
                    src={imageSrc(form.image_url)}
                    /* Decorative here too: this is a preview of a decorative
                       element, and the label above already names it. */
                    alt=""
                    style={{ objectPosition: imageFocus(form.image_focus) || undefined }}
                  />
                </div>
                <p className="cls__videoNote">
                  A real card, at the real size. The photo fills the whole card
                  and the class name sits on top of it — anything outside this
                  box is cropped off, and the dark wash is added automatically
                  so the text stays readable.
                </p>
              </div>
            </>
          )}

          <label className="rowflex" style={{ gap: 'var(--s2)', fontSize: 'var(--fs-sm)' }}>
            <input type="checkbox" checked={form.female_only} onChange={set('female_only')} />
            Women only
          </label>

          <label className="rowflex" style={{ gap: 'var(--s2)', fontSize: 'var(--fs-sm)' }}>
            <input type="checkbox" checked={form.is_paused} onChange={set('is_paused')} />
            Paused — still listed, but not bookable
          </label>

          {/* Only asked for when it is relevant, and it matters: a paused
              class shows this sentence to members INSTEAD of a booking
              button, so an empty one leaves them guessing. */}
          {form.is_paused && (
            <div className="field">
              <label className="eyebrow" htmlFor="cls-pausenote">Why? (members see this)</label>
              <input
                id="cls-pausenote"
                className="input"
                placeholder="Starting back next week"
                value={form.pause_note}
                onChange={set('pause_note')}
              />
            </div>
          )}

          {formErr && (
            <p className="muted" style={{ color: 'var(--error, #e55)', fontSize: 'var(--fs-sm)' }}>
              {formErr}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
