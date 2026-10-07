// ============================================================
// AddFriend — invite a friend to join Made Running.
//
// The invite is composed CLIENT-SIDE and handed off to the
// user's own installed app via a URL scheme (mailto:, sms:,
// wa.me). Made Running never sends anything automatically.
//
// NOTE: detectContactMethod() is currently a documented stub
// returning valid:false, so channel selection is driven entirely
// by the segmented control below. Once the owner implements
// detectContactMethod, this page can call it on every keystroke
// to auto-detect the channel from what was typed and validate
// the value before enabling the primary action button.
// ============================================================
import { useState, useRef } from 'react'
import { Mail, MessageSquare, Copy, Check, RotateCcw } from 'lucide-react'
import { PageHead } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { tenant } from '../lib/theme'
import {
  CONTACT_METHODS,
  makeRefCode,
  buildInviteUrl,
  inviteMessage,
  composeInvite,
} from '../lib/invites'

// Map a channel value to a Lucide icon component.
function channelIcon(value) {
  if (value === 'email') return Mail
  return MessageSquare // mobile and whatsapp both use a message bubble
}

export default function AddFriend() {
  const { user } = useAuth()
  const clubName = tenant.name

  // Sender identity — prefer display name, fall back to email prefix.
  const senderName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'A Made Running member')

  // Referral code is deterministic from the sender's identity.
  const seed = user?.id || user?.email || senderName
  const refCode = makeRefCode(seed)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = buildInviteUrl(origin, refCode)

  // ── State ─────────────────────────────────────────────────
  const [channel, setChannel] = useState(CONTACT_METHODS[0].value)
  const [friendName, setFriendName] = useState('')
  const [contactValue, setContactValue] = useState('')
  const [copied, setCopied] = useState(false)
  // null = "still following the defaults". See the note where it's read.
  const [draft, setDraft] = useState(null)
  const urlRef = useRef(null)

  // ── Derived ──────────────────────────────────────────────
  const activeMethod = CONTACT_METHODS.find((m) => m.value === channel) || CONTACT_METHODS[0]

  // Determine <input> type and inputMode by channel.
  const inputType = channel === 'email' ? 'email' : 'tel'
  const inputMode = channel === 'email' ? 'email' : 'tel'

  // ── The editable message ─────────────────────────────────
  //
  // `draft` is null until the member types in the message box. That null is
  // load-bearing, not laziness: while it holds, the message REGENERATES as
  // they fill in the form, so typing the friend's name updates the greeting.
  // The moment they edit a word, their version takes over and nothing
  // rewrites it underneath them.
  //
  // The alternative — seed state from the default on mount with useState(fn)
  // — looks simpler and is worse: the box would freeze at whatever the
  // defaults were on first render, so a name typed afterwards would never
  // reach the greeting, and there'd be no way to tell "untouched" from
  // "edited to coincidentally match" when deciding whether to offer Reset.
  const defaults = inviteMessage({ clubName, senderName, inviteUrl, friendName })
  const subject = draft?.subject ?? defaults.subject
  const body = draft?.body ?? defaults.body
  const edited = draft !== null

  // Snapshot whatever is currently on screen, override the one field being
  // typed into. Without the snapshot, the first keystroke in the body would
  // drop the subject back to its default.
  function editMessage(field) {
    return (e) => setDraft({ subject, body, [field]: e.target.value })
  }

  const composed = composeInvite({
    method: channel,
    value: contactValue,
    clubName,
    senderName,
    inviteUrl,
    friendName,
    // What they see is what gets sent.
    subject,
    body,
  })

  // The primary action is enabled when a value is typed.
  // (detectContactMethod is a stub so we do not gate on valid:true.
  //  See module note above for the upgrade path once it's implemented.)
  const canSend = contactValue.trim().length > 0 && composed !== null

  // ── Copy-link handler ────────────────────────────────────
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard API rejected (insecure origin, in-app browser, etc.).
      // Fall back: select the text so the user can copy manually.
      if (urlRef.current) {
        urlRef.current.select()
      }
    }
  }

  return (
    <div className="page">
      {/* ── 1. Page header ────────────────────────────────── */}
      <PageHead
        eyebrow="Community"
        title="Invite a friend"
        sub="Made Running grows by word of mouth — share an invite with someone you run with and they can join the club in under a minute."
      />

      <div className="stack" style={{ gap: 'var(--s6)' }}>

        {/* ── 2. Channel chooser ──────────────────────────── */}
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
            How do you want to reach them?
          </div>
          <div className="segmented" style={{ display: 'flex', flexWrap: 'wrap' }}>
            {CONTACT_METHODS.map((m) => {
              const Icon = channelIcon(m.value)
              return (
                <button
                  key={m.value}
                  type="button"
                  className={channel === m.value ? 'on' : ''}
                  onClick={() => {
                    setChannel(m.value)
                    setContactValue('')
                  }}
                  style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}
                  aria-pressed={channel === m.value}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 3. Form ─────────────────────────────────────── */}
        <div className="card">
          <div className="stack" style={{ gap: 'var(--s4)' }}>

            {/* Optional friend name */}
            <div className="field">
              <label className="eyebrow" htmlFor="friend-name">
                Their name (optional)
              </label>
              <input
                id="friend-name"
                className="input"
                type="text"
                placeholder="e.g. Jamie"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* Contact value */}
            <div className="field">
              <label className="eyebrow" htmlFor="contact-value">
                {activeMethod.label}
                <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>
              </label>
              <input
                id="contact-value"
                className="input"
                type={inputType}
                inputMode={inputMode}
                placeholder={activeMethod.placeholder}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                style={{ minHeight: 44 }}
                autoComplete={channel === 'email' ? 'email' : 'tel'}
              />
              <p
                className="muted"
                style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--s2)' }}
              >
                {activeMethod.hint}
              </p>
            </div>

            {/* ── 4. Disclosure ───────────────────────────── */}
            <div
              className="notice"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: 'var(--s3) var(--s4)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--muted)',
              }}
            >
              When you press the button below, your own{' '}
              {channel === 'email'
                ? 'email app'
                : channel === 'mobile'
                ? 'Messages app'
                : 'WhatsApp'}{' '}
              will open with this message already written out. You choose whether to send it.
              Made Running does not send anything on your behalf and never sees your messages or contacts.
            </div>
          </div>
        </div>

        {/* ── 5. The message — editable ───────────────────── */}
        {/*
          This was a read-only preview, which was the wrong call. An invite
          is a message from one person to someone they know; the club's
          default wording cannot be right for every pair of them, and a
          member who can't change a word either sends something that doesn't
          sound like them or gives up and writes it in WhatsApp instead —
          at which point the referral code never gets attached.
        */}
        <div className="card">
          <div className="spread" style={{ marginBottom: 'var(--s3)', gap: 'var(--s3)' }}>
            <div>
              <div className="eyebrow">Your message</div>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: '4px 0 0' }}>
                Edit it however you like — this is exactly what gets sent.
              </p>
            </div>
            {edited && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setDraft(null)}
                style={{ minHeight: 44, flexShrink: 0 }}
              >
                <RotateCcw size={14} strokeWidth={1.8} />
                Reset
              </button>
            )}
          </div>

          <div className="stack" style={{ gap: 'var(--s4)' }}>
            {/* Subject is email-only: sms: and wa.me have no such field, and
                showing a box that silently does nothing would be a lie. */}
            {channel === 'email' && (
              <div className="field">
                <label className="eyebrow" htmlFor="invite-subject">Subject</label>
                <input
                  id="invite-subject"
                  className="input"
                  type="text"
                  value={subject}
                  onChange={editMessage('subject')}
                  style={{ minHeight: 44 }}
                />
              </div>
            )}

            <div className="field">
              <label className="eyebrow" htmlFor="invite-body">Message</label>
              {/* .textarea, not .input — the design system already has this
                  one, including the >=16px font under 900px that stops iOS
                  Safari zooming the page the instant the field gains focus. */}
              <textarea
                id="invite-body"
                className="textarea"
                value={body}
                onChange={editMessage('body')}
                rows={8}
                style={{ minHeight: 180, lineHeight: 1.65 }}
              />
              <div
                className="spread"
                style={{ marginTop: 'var(--s2)', gap: 'var(--s3)', alignItems: 'baseline' }}
              >
                <p className="faint" style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
                  {/* Keeping the link in is the member's choice, not ours —
                      but they should know what dropping it costs, because
                      without it the club can't attribute the referral. */}
                  {body.includes(inviteUrl)
                    ? 'Your invite link is included.'
                    : '⚠ Your invite link is no longer in the message — your friend won’t be credited to you.'}
                </p>
                {channel !== 'email' && (
                  // Length matters on SMS in a way it doesn't in email: past
                  // 160 characters it splits into multiple billed messages.
                  <span className="faint mono" style={{ fontSize: 'var(--fs-xs)', flexShrink: 0 }}>
                    {body.length} chars
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. Primary action ───────────────────────────── */}
        <div>
          {/*
            Rendered as <a> not <button> so the OS can resolve
            mailto: / sms: / https:// natively. The anchor also
            survives long-press (share sheet) and right-click
            correctly. inline textDecoration:'none' overrides the
            global a:hover { text-decoration: underline } at (0,1,1)
            which would otherwise win over any class selector.
          */}
          {canSend ? (
            <a
              href={composed.href}
              className="btn btn--primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s2)', minHeight: 44, textDecoration: 'none' }}
              rel="noopener noreferrer"
            >
              {composed.actionLabel}
              {friendName.trim() ? ` to ${friendName.trim()}` : ''}
            </a>
          ) : (
            // Aria-disabled anchor that goes nowhere — looks like a button
            // but is inert when the form is incomplete.
            <a
              href="#"
              className="btn btn--primary"
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--s2)',
                minHeight: 44,
                textDecoration: 'none',
                opacity: 0.45,
                cursor: 'not-allowed',
                pointerEvents: 'none',
              }}
              tabIndex={-1}
            >
              Enter {activeMethod.label.toLowerCase()} to continue
            </a>
          )}
        </div>

        {/* ── 7. Share-the-link fallback ───────────────────── */}
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
            Share the link instead
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s3)' }}>
            Copy your personal invite link and paste it wherever you like — a WhatsApp group,
            Instagram story, or text message.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--s2)',
              alignItems: 'stretch',
              flexWrap: 'wrap',
            }}
          >
            {/*
              overflowWrap:anywhere prevents a long URL from widening the
              page on 375px viewports. The ref is used as a manual-copy
              fallback when navigator.clipboard is unavailable.
            */}
            <input
              ref={urlRef}
              className="input mono"
              readOnly
              value={inviteUrl}
              aria-label="Your personal invite link"
              style={{
                flex: '1 1 200px',
                fontSize: 'var(--fs-xs)',
                overflowWrap: 'anywhere',
                minHeight: 44,
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="btn btn--ghost"
              onClick={copyLink}
              style={{ minHeight: 44, flexShrink: 0 }}
              aria-label={copied ? 'Link copied' : 'Copy link'}
            >
              {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.8} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* ── 8. How it works ─────────────────────────────── */}
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s4)' }}>
            How it works
          </div>
          <div className="timeline">
            <div className="tl__item">
              <div className="tl__dot" aria-hidden="true">
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>1</span>
              </div>
              <div className="tl__body">
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
                  Your friend receives the link and visits the Made Running join page.
                </p>
              </div>
            </div>
            <div className="tl__item">
              <div className="tl__dot" aria-hidden="true">
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>2</span>
              </div>
              <div className="tl__body">
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
                  They fill in a short join form — name, chapter, and how they heard about us.
                  No account or password needed.
                </p>
              </div>
            </div>
            <div className="tl__item">
              <div className="tl__dot" aria-hidden="true">
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>3</span>
              </div>
              <div className="tl__body">
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
                  They show up on the Runners list, linked to your invite code, and the club
                  knows you brought them in.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
