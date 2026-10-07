// Community — the social heart of the club.
// Members post shout-outs, celebrate milestones, ask questions, and read
// club notices. Feed is seeded from src/lib/community.js (see SWAP POINT
// comment there for the real Supabase path when a community_posts table exists).
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useId,
  createContext,
  useContext,
} from 'react'
import {
  Megaphone,
  Trophy,
  HelpCircle,
  Bell,
  Heart,
  MessageCircle,
  Users,
  Inbox,
  AtSign,
  ImagePlus,
  Film,
  X,
  Trash2,
} from 'lucide-react'

import { PageHead, Badge, Empty, Loading, initials } from '../components/ui'
import {
  POST_KINDS,
  fetchCommunityFeed,
  timeAgo,
  feedByKind,
  topContributors,
  mentionableMembers,
  activeMentionQuery,
  matchMentions,
  splitMentions,
  MEDIA_LIMITS,
  acceptMediaFiles,
  canDeletePost,
  releasePostMedia,
  releaseMediaItem,
} from '../lib/community.js'

// ── Kind -> icon map (React-free in community.js; mapped here) ───────────────

const KIND_ICONS = {
  shout_out: Megaphone,
  milestone: Trophy,
  question:  HelpCircle,
  notice:    Bell,
}

function kindMeta(value) {
  return POST_KINDS.find((k) => k.value === value) || POST_KINDS[0]
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }) {
  return (
    <div
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 'var(--radius-full)',
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size < 32 ? 'var(--fs-xs)' : 'var(--fs-sm)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  )
}

// ── Mention rendering ─────────────────────────────────────────────────────────
// The roster travels by context rather than being threaded through PostCard ->
// Comment as a prop. Only two leaf components need it and neither is reachable
// from anywhere else, so prop-drilling it would add an argument to every layer
// in between purely for transport.
//
// Default [] matters: with no roster, splitMentions returns the body as one
// plain segment, so a post still renders correctly — it just renders without
// highlights. A missing roster degrades to plain text, never to a crash.
const RosterContext = createContext([])

function MentionText({ children }) {
  const roster = useContext(RosterContext)
  // Memoised on the body because splitMentions compiles a regex from every
  // name on the roster, and this runs for each post AND each comment on it.
  const names = useMemo(() => roster.map((r) => r.author), [roster])
  const parts = useMemo(() => splitMentions(children, names), [children, names])

  return parts.map((part, i) =>
    part.type === 'mention' ? (
      <strong
        key={i}
        className="mention"
        // A tag is a reference to a person, not an emphasis, so it is marked
        // up as a highlight rather than left to colour alone — the chip has to
        // survive greyscale, low vision and a printout.
        style={{
          color: 'var(--accent)',
          background: 'var(--accent-soft)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.05em 0.3em',
          fontWeight: 600,
          overflowWrap: 'break-word',
        }}
      >
        {part.value}
      </strong>
    ) : (
      <span key={i}>{part.value}</span>
    ),
  )
}

// ── Post media ────────────────────────────────────────────────────────────────

// onRemove is optional. Passing it is what turns a read-only gallery into an
// editable one, so the remove buttons can never appear on another member's
// post — the caller simply does not hand over the callback.
function PostMedia({ media, onRemove }) {
  if (!media?.length) return null
  const single = media.length === 1

  return (
    <div
      style={{
        display: 'grid',
        // Two columns for a set, one for a lone item. Beyond two the grid
        // would make a phone photo the size of a postage stamp at 375px.
        gridTemplateColumns: single ? '1fr' : 'repeat(2, 1fr)',
        gap: 'var(--s2)',
        marginBottom: 'var(--s4)',
      }}
    >
      {media.map((item) => (
        <figure
          key={item.id}
          style={{
            margin: 0,
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'var(--surface-2, rgb(0 0 0 / 0.04))',
            // A fixed ratio reserves the box BEFORE the file decodes, so the
            // post does not jump and shove the rest of the feed down as each
            // image lands. 16:9 alone for a hero-sized item, square in a grid
            // so rows line up regardless of what was uploaded.
            aspectRatio: single ? '16 / 9' : '1 / 1',
          }}
        >
          {item.kind === 'video' ? (
            <video
              src={item.url}
              controls
              // metadata, not auto: enough to draw the first frame and the
              // duration without pulling tens of megabytes for a clip that
              // may never be played.
              preload="metadata"
              // Without this iOS hijacks playback into its fullscreen player,
              // which throws the member out of the feed to watch six seconds.
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img
              src={item.url}
              // The filename is a poor alt text but it is honest, and it is
              // the only description that exists until posts carry a caption
              // field. Better than alt="" on content that carries meaning.
              alt={item.name || 'Attached picture'}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}

          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name || 'this attachment'} from your post`}
              // Same transparent-hit-box trick as the composer previews: a full
              // 44px target for thumbs, but only a 28px disc drawn, so it does
              // not cover the photo it is meant to let you manage.
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 'var(--radius-full)',
                  // Opaque enough to stay legible over a white sky or a bright
                  // race vest — a translucent chip vanishes on light photos.
                  background: 'rgb(0 0 0 / 0.62)',
                  color: '#fff',
                }}
              >
                <X size={15} />
              </span>
            </button>
          )}
        </figure>
      ))}
    </div>
  )
}

// ── Individual comment ────────────────────────────────────────────────────────

function Comment({ comment }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--s2)',
        paddingTop: 'var(--s3)',
        paddingLeft: 'var(--s3)',
        borderLeft: '2px solid var(--line)',
        marginLeft: 'var(--s1)',
      }}
    >
      <Avatar name={comment.author} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="rowflex"
          style={{ gap: 'var(--s2)', alignItems: 'baseline', flexWrap: 'wrap' }}
        >
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
            {comment.author}
          </span>
          <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--ink-2)',
            marginTop: 'var(--s1)',
            overflowWrap: 'break-word',
            maxWidth: 'none',
          }}
        >
          <MentionText>{comment.body}</MentionText>
        </p>
      </div>
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, onDelete, onRemoveMedia }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes || 0)
  // Two-step delete. Not window.confirm(): a native dialog freezes the tab,
  // looks like a browser error in a demo, and cannot be styled or dismissed
  // with Escape consistently. An inline confirm keeps the post visible while
  // you decide, which is the context you need to decide.
  const [confirming, setConfirming] = useState(false)
  const mine = canDeletePost(post)

  function handleLike() {
    if (liked) {
      setLikeCount((n) => n - 1)
    } else {
      setLikeCount((n) => n + 1)
    }
    setLiked((l) => !l)
  }

  const meta = kindMeta(post.kind)
  const KindIcon = KIND_ICONS[post.kind] || Megaphone

  return (
    <div
      className="card"
      style={{ padding: 'var(--s4) var(--s5)', borderLeft: '3px solid var(--line-soft)' }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--s3)',
          alignItems: 'flex-start',
          marginBottom: 'var(--s3)',
        }}
      >
        <Avatar name={post.author} size={40} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="rowflex"
            style={{
              gap: 'var(--s2)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}
            >
              {post.author}
            </span>
            <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              {post.chapter}
            </span>
            <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              &middot;
            </span>
            <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              {timeAgo(post.createdAt)}
            </span>
          </div>

          <div style={{ marginTop: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
            <KindIcon size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <Badge meta={meta} />
          </div>
        </div>
      </div>

      {/* Body */}
      <p
        style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--ink)',
          lineHeight: 1.6,
          overflowWrap: 'break-word',
          maxWidth: 'none',
          marginBottom: 'var(--s4)',
        }}
      >
        <MentionText>{post.body}</MentionText>
      </p>

      <PostMedia
        media={post.media}
        onRemove={mine && onRemoveMedia ? (mediaId) => onRemoveMedia(post.id, mediaId) : undefined}
      />

      {/* Footer: like + comment count */}
      <div
        className="rowflex"
        style={{ gap: 'var(--s3)', alignItems: 'center' }}
      >
        <button
          onClick={handleLike}
          aria-label={liked ? 'Unlike this post' : 'Like this post'}
          aria-pressed={liked}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s1)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--s2) var(--s3)',
            borderRadius: 'var(--radius-sm)',
            minHeight: 44,
            minWidth: 44,
            color: liked ? 'var(--accent)' : 'var(--muted)',
            fontWeight: liked ? 600 : 400,
            fontSize: 'var(--fs-sm)',
            transition: 'color 0.15s ease',
          }}
        >
          <Heart
            size={16}
            fill={liked ? 'currentColor' : 'none'}
            strokeWidth={liked ? 0 : 1.8}
          />
          <span>{likeCount}</span>
        </button>

        {post.comments && post.comments.length > 0 && (
          <div
            className="rowflex"
            style={{
              gap: 'var(--s1)',
              alignItems: 'center',
              color: 'var(--muted)',
              fontSize: 'var(--fs-sm)',
              padding: 'var(--s2) var(--s1)',
            }}
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            <span>{post.comments.length}</span>
          </div>
        )}

        {mine && onDelete && (
          // marginLeft:auto pushes the destructive control to the far edge,
          // away from Like. Adjacent destructive and routine actions is how
          // people delete things they meant to applaud.
          <div
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--s1)' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && confirming) {
                e.stopPropagation()
                setConfirming(false)
              }
            }}
          >
            {confirming ? (
              <>
                <span
                  // polite, not assertive: this interrupts nothing, it just
                  // needs to reach a screen reader before they hit the buttons.
                  aria-live="polite"
                  style={{
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--muted)',
                    marginRight: 'var(--s1)',
                  }}
                >
                  Delete this post?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  style={{
                    minHeight: 44,
                    padding: '0 var(--s3)',
                    background: 'transparent',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--ink)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false)
                    onDelete(post.id)
                  }}
                  style={{
                    minHeight: 44,
                    padding: '0 var(--s3)',
                    background: 'var(--danger, #c0392b)',
                    border: '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Delete your post"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--s1)',
                  minHeight: 44,
                  minWidth: 44,
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--muted)',
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  padding: 'var(--s2) var(--s3)',
                }}
              >
                <Trash2 size={15} strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      {post.comments && post.comments.length > 0 && (
        <div
          className="stack"
          style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}
        >
          {post.comments.map((c, i) => (
            <Comment key={i} comment={c} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Composer card ─────────────────────────────────────────────────────────────

function Composer({ onPost }) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('shout_out')

  // ── Media attachments ────────────────────────────────────────────────────
  // Each entry: { id, kind, url, name, size }. `url` is a blob: URL from
  // URL.createObjectURL — a pointer into the tab's memory, not an upload.
  // See the SWAP POINT in community.js for the Supabase Storage path.
  const [attachments, setAttachments] = useState([])
  const [mediaErrors, setMediaErrors] = useState([])
  const fileRef = useRef(null)

  // Object URLs are not garbage collected. The browser holds the underlying
  // blob alive until revokeObjectURL is called, so a member who attaches four
  // videos, changes their mind and attaches four more has silently pinned
  // ~500MB in a tab that looks empty.
  //
  // But revoking at the wrong moment is the worse bug: once a post is
  // published the FEED owns those URLs, and revoking on clear would blank
  // every picture the member just posted. So ownership transfers on post —
  // handlePost empties `attachments` WITHOUT revoking — and this cleanup only
  // ever sees URLs still sitting unposted in the composer.
  const pendingRef = useRef([])
  useEffect(() => {
    pendingRef.current = attachments
  }, [attachments])
  useEffect(
    () => () => {
      for (const a of pendingRef.current) URL.revokeObjectURL(a.url)
    },
    [],
  )

  function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const { accepted, errors } = acceptMediaFiles(files, attachments.length)
    setMediaErrors(errors)
    if (accepted.length) {
      setAttachments((prev) => [
        ...prev,
        ...accepted.map(({ file, kind: k }) => ({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: k,
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
        })),
      ])
    }
    // Reset the input's value so picking the SAME file twice in a row still
    // fires a change event. Without this, removing a photo and re-adding it
    // does nothing at all and looks like the button is broken.
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      // Safe to revoke here: this one is being discarded, not published, so
      // nothing downstream is holding a reference to it.
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
    setMediaErrors([])
  }

  // ── @mention autocomplete ────────────────────────────────────────────────
  // `mention` holds the live token under the caret: { start, query }, or null
  // when the caret is not inside one. It is recomputed from the textarea on
  // every change and every caret move rather than being tracked incrementally,
  // because the caret can jump anywhere — a click into the middle of an
  // existing tag, an arrow key, a paste — and incremental state would drift
  // out of sync with the text on the first one of those.
  const roster = useContext(RosterContext)
  const taRef = useRef(null)
  const [mention, setMention] = useState(null)
  const [highlight, setHighlight] = useState(0)
  const listboxId = useId()

  const suggestions = useMemo(
    () => (mention ? matchMentions(mention.query, roster) : []),
    [mention, roster],
  )
  const open = suggestions.length > 0

  // The highlighted row must never point past the end of a shrinking list.
  // Typing another letter can cut six matches down to one, and a stale index
  // of 5 would make Enter insert `undefined`.
  useEffect(() => {
    setHighlight(0)
  }, [mention?.query])

  function syncMention(el) {
    if (!el) return
    setMention(activeMentionQuery(el.value, el.selectionStart))
  }

  function insertMention(person) {
    if (!mention) return
    const el = taRef.current
    const before = body.slice(0, mention.start)
    const after = body.slice(mention.start + 1 + mention.query.length)
    // The trailing space is not cosmetic: it pushes the caret out of the
    // token, which closes the dropdown and — because activeMentionQuery
    // allows only one internal space — stops the very next word being eaten
    // into the same mention.
    const tag = `@${person.author} `
    const next = before + tag + after
    setBody(next)
    setMention(null)
    // Restore focus and drop the caret after the tag. Deferred a frame
    // because React has not written `next` into the DOM node yet, so setting
    // selectionStart now would index into the OLD, shorter value.
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = before.length + tag.length
      el.setSelectionRange(caret, caret)
    })
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // Enter is claimed ONLY while the dropdown is open. The rest of the
      // time it must stay a newline — a composer that cannot start a new
      // paragraph is a worse trade than one extra keystroke to dismiss.
      e.preventDefault()
      insertMention(suggestions[highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMention(null)
    }
  }

  function handlePost() {
    const trimmed = body.trim()
    if (!trimmed && !attachments.length) return
    onPost({ body: trimmed, kind, media: attachments })
    setBody('')
    setMention(null)
    // Cleared, NOT revoked — the published post owns these URLs now. See the
    // cleanup effect above.
    setAttachments([])
    setMediaErrors([])
  }

  // A picture on its own is a post. Requiring words to go with it would mean
  // a member who filmed the finish line has to caption it before the club can
  // see it, which is a tax on the most spontaneous thing anyone posts here.
  const canPost = body.trim().length > 0 || attachments.length > 0

  return (
    <div className="card card--raised" style={{ padding: 'var(--s5)' }}>
      <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
        Post to the feed
      </div>

      <div className="stack" style={{ gap: 'var(--s3)' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={taRef}
            className="textarea"
            placeholder="Share something with the club... use @ to tag a member"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              syncMention(e.target)
            }}
            // Caret moves that are not edits: clicking into the text, arrowing
            // through it, selecting. onChange never fires for these, so
            // without them the dropdown would not open when you click back
            // into a half-typed tag.
            onKeyUp={(e) => syncMention(e.currentTarget)}
            onClick={(e) => syncMention(e.currentTarget)}
            // Deferred so the click that picks a name lands before the list
            // unmounts. Closing synchronously on blur cancels the selection.
            onBlur={() => setTimeout(() => setMention(null), 150)}
            onKeyDown={handleKeyDown}
            rows={3}
            style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${listboxId}-${highlight}` : undefined}
          />

          {open && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Tag a member"
              className="card"
              style={{
                position: 'absolute',
                zIndex: 30,
                top: '100%',
                left: 0,
                // Capped rather than full-width: at 375px a full-width
                // dropdown reads as a second page, and a name is short.
                width: 'min(300px, 100%)',
                marginTop: 'var(--s1)',
                padding: 'var(--s1)',
                listStyle: 'none',
                maxHeight: 264,
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg, 0 12px 32px rgb(0 0 0 / 0.14))',
              }}
            >
              {suggestions.map((person, i) => (
                <li
                  key={person.author}
                  id={`${listboxId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  // Pointer, not click: mousedown fires before the textarea's
                  // blur, so preventing its default keeps focus in the
                  // textarea and the caret restore below stays valid.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(person)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--s3)',
                    padding: 'var(--s2) var(--s3)',
                    minHeight: 44,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: i === highlight ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <Avatar name={person.author} size={28} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        color: 'var(--ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {person.author}
                    </span>
                    {person.chapter && (
                      <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                        {person.chapter}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Attachment previews. Rendered above the controls so the member sees
            what they are about to post directly under what they wrote. */}
        {attachments.length > 0 && (
          <ul
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              gap: 'var(--s2)',
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {attachments.map((item) => (
              <li
                key={item.id}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--surface-2, rgb(0 0 0 / 0.06))',
                }}
              >
                {item.kind === 'video' ? (
                  <>
                    <video
                      src={item.url}
                      preload="metadata"
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* A muted still frame is indistinguishable from a photo,
                        so the badge is what tells the member this one moves. */}
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 6,
                        bottom: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgb(0 0 0 / 0.62)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <Film size={11} />
                      Video
                    </span>
                  </>
                ) : (
                  <img
                    src={item.url}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}

                {/* Hit area and visual size are deliberately different. A 28px
                    circle is the right SIZE on a 96px thumbnail — a 44px disc
                    would cover a third of the picture it is meant to let you
                    check. But 28px is below the minimum a thumb can reliably
                    hit, so the button itself is a transparent 44px box pinned
                    to the corner and the visible circle is drawn inside it.
                    Same look, tap target nearly two and a half times the area. */}
                <button
                  type="button"
                  onClick={() => removeAttachment(item.id)}
                  aria-label={`Remove ${item.name}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 44,
                    height: 44,
                    display: 'grid',
                    placeItems: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgb(0 0 0 / 0.62)',
                      color: '#fff',
                    }}
                  >
                    <X size={15} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Rejected files. aria-live so the message reaches a screen reader —
            a silent rejection after a file picker closes is indistinguishable
            from the attach button simply not working. */}
        {mediaErrors.length > 0 && (
          <ul
            role="alert"
            aria-live="polite"
            style={{
              margin: 0,
              paddingLeft: '1.1em',
              color: 'var(--danger, #b42318)',
              fontSize: 'var(--fs-xs)',
              lineHeight: 1.5,
            }}
          >
            {mediaErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s3)',
            flexWrap: 'wrap',
          }}
        >
          <select
            className="select"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={{ flexShrink: 0 }}
            aria-label="Post kind"
          >
            {POST_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>

          {/* The input itself is visually hidden rather than display:none —
              a display:none input is skipped by some assistive tech and
              cannot be focused, so the label association would break. */}
          <input
            ref={fileRef}
            type="file"
            accept={MEDIA_LIMITS.accept}
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
            tabIndex={-1}
            aria-hidden="true"
          />

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => fileRef.current?.click()}
            disabled={attachments.length >= MEDIA_LIMITS.maxFiles}
            style={{ minHeight: 44, flexShrink: 0 }}
          >
            <ImagePlus size={16} />
            Share content
          </button>

          <button
            className="btn btn--primary"
            onClick={handlePost}
            disabled={!canPost}
            style={{ minHeight: 44 }}
          >
            Post
          </button>

          <span
            className="muted"
            style={{
              fontSize: 'var(--fs-xs)',
              display: 'inline-flex',
              // flex-start, not center: this hint wraps to two lines at 375px,
              // and centering pins the icon to the middle of the whole block —
              // visually orphaned from the sentence it introduces. The 3px
              // nudge is optical, not mathematical: it centres the 12px glyph
              // on the FIRST line box rather than on the paragraph.
              alignItems: 'flex-start',
              gap: 'var(--s1)',
            }}
          >
            <AtSign size={12} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
            Type @ to tag a member. Posts are session-only and not saved yet.
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Top contributors sidebar card ─────────────────────────────────────────────

function TopContributors({ posts }) {
  const contributors = topContributors(posts, 5)
  return (
    <div className="card" style={{ padding: 'var(--s4) var(--s5)' }}>
      <div
        className="rowflex"
        style={{
          gap: 'var(--s2)',
          alignItems: 'center',
          marginBottom: 'var(--s4)',
        }}
      >
        <Users size={15} style={{ color: 'var(--muted)' }} />
        <span className="eyebrow">Top contributors</span>
      </div>
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        {contributors.map((c) => (
          <div
            key={c.author}
            className="rowflex"
            style={{ gap: 'var(--s3)', alignItems: 'center' }}
          >
            <Avatar name={c.author} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.author}
              </div>
              <div
                className="muted"
                style={{ fontSize: 'var(--fs-xs)' }}
              >
                {c.chapter} &middot; {c.posts} {c.posts === 1 ? 'post' : 'posts'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Community guidelines card ─────────────────────────────────────────────────

function Guidelines() {
  const rules = [
    'Lift people up. If you would not say it at the start line, do not post it here.',
    'Keep it about running and the club. This is not a place for unrelated promotions or arguments.',
    'Respect every pace. Beginners belong here just as much as sub-20 park runners.',
    'Tag your chapter when it is relevant — it helps the right people find the right conversation.',
  ]
  return (
    <div
      className="card"
      style={{ padding: 'var(--s4) var(--s5)', borderTop: '3px solid var(--accent)' }}
    >
      <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
        Community guidelines
      </div>
      <div className="stack" style={{ gap: 'var(--s3)' }}>
        {rules.map((rule, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 'var(--s3)',
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'var(--fs-xs)',
                color: 'var(--accent)',
                lineHeight: 1.6,
                minWidth: 16,
              }}
            >
              {i + 1}.
            </span>
            <span
              className="muted"
              style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}
            >
              {rule}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Community() {
  const [allPosts, setAllPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeKind, setActiveKind] = useState('all')

  useEffect(() => {
    fetchCommunityFeed().then((data) => {
      setAllPosts(data)
      setLoading(false)
    })
  }, [])

  // Leaving Community throws the session feed away, so every blob it still
  // owns has to go back to the browser on the way out. A ref, not `allPosts`
  // directly: an effect that depended on the posts array would tear down and
  // revoke on EVERY post, deleting the images of the post just published.
  // The cleanup must run once, at unmount, reading whatever the feed held then.
  const postsRef = useRef(allPosts)
  useEffect(() => {
    postsRef.current = allPosts
  }, [allPosts])
  useEffect(
    () => () => {
      for (const p of postsRef.current) releasePostMedia(p)
    },
    [],
  )

  function handleNewPost({ body, kind, media }) {
    const newPost = {
      id: `local-${Date.now()}`,
      author: 'You',
      chapter: 'London',
      kind,
      body,
      // The post takes ownership of the composer's blob URLs — the composer
      // deliberately does not revoke them on clear. See Composer.
      media: media || [],
      createdAt: new Date(),
      likes: 0,
      comments: [],
    }
    setAllPosts((prev) => [newPost, ...prev])
    // If the current filter would hide this post, switch to 'all' so the
    // member can see it immediately rather than having it silently disappear.
    if (activeKind !== 'all' && activeKind !== kind) {
      setActiveKind('all')
    }
  }

  /**
   * Delete a whole post.
   *
   * The revoke happens INSIDE the updater and before the filter, because this
   * is the last moment the post object is reachable. Once it is out of the
   * array nothing points at those blob URLs and the memory is stranded for the
   * life of the tab — createObjectURL is exempt from garbage collection.
   */
  function handleDeletePost(postId) {
    setAllPosts((prev) => {
      const doomed = prev.find((p) => p.id === postId)
      // Re-check ownership at the point of mutation, not just at the point of
      // render. The button is hidden on other people's posts, but "hidden" is
      // a UI state — this is the function that actually destroys data.
      if (!doomed || !canDeletePost(doomed)) return prev
      releasePostMedia(doomed)
      return prev.filter((p) => p.id !== postId)
    })
  }

  /** Remove one picture or video from a post, leaving the post itself. */
  function handleRemoveMedia(postId, mediaId) {
    setAllPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !canDeletePost(p)) return p
        const doomed = (p.media || []).find((m) => m.id === mediaId)
        if (!doomed) return p
        releaseMediaItem(doomed)
        return { ...p, media: p.media.filter((m) => m.id !== mediaId) }
      }),
    )
  }

  const filtered = feedByKind(allPosts, activeKind)

  // Who can be tagged. Built from the WHOLE feed, not the filtered view —
  // narrowing to "Shout-out" is a reading choice and must not quietly shrink
  // the list of people you are allowed to mention.
  //
  // 'You' is dropped because it is a placeholder for the signed-in member (see
  // handleNewPost), not a name. Leaving it in would offer "@You" as a taggable
  // person, and tagging yourself in your own post is noise.
  const roster = useMemo(
    () => mentionableMembers(allPosts).filter((p) => p.author !== 'You'),
    [allPosts],
  )

  return (
    <RosterContext.Provider value={roster}>
    <div className="page">
      <PageHead
        eyebrow="Club"
        title="Community"
        sub="The club noticeboard — members talking to members, celebrating each other, and keeping the crew informed."
      />

      {loading ? (
        <Loading rows={5} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: 'var(--s5)',
          }}
        >
          {/* ── Main column: composer + filter + feed ─────────────────── */}
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                gap: 'var(--s5)',
                alignItems: 'start',
              }}
              className="community-layout"
            >
              {/* Left: feed column */}
              <div className="stack" style={{ gap: 'var(--s5)', minWidth: 0 }}>
                {/* Composer */}
                <Composer onPost={handleNewPost} />

                {/* Filter row */}
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--s2)',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                  role="group"
                  aria-label="Filter posts by kind"
                >
                  {/* All chip */}
                  <button
                    className={`chip${activeKind === 'all' ? ' chip--active' : ''}`}
                    onClick={() => setActiveKind('all')}
                    aria-pressed={activeKind === 'all'}
                    style={{
                      cursor: 'pointer',
                      minHeight: 44,
                      padding: '0 var(--s4)',
                      border: 'none',
                      background: activeKind === 'all' ? 'var(--accent)' : 'var(--surface-2)',
                      color: activeKind === 'all' ? 'var(--accent-ink)' : 'var(--ink)',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: activeKind === 'all' ? 700 : 400,
                      fontSize: 'var(--fs-sm)',
                    }}
                  >
                    All
                    <span
                      className="faint"
                      style={{ marginLeft: 'var(--s1)', fontSize: 'var(--fs-xs)' }}
                    >
                      {activeKind === 'all' ? filtered.length : allPosts.length}
                    </span>
                  </button>

                  {/* Kind chips */}
                  {POST_KINDS.map((k) => {
                    const isActive = activeKind === k.value
                    const count = feedByKind(allPosts, k.value).length
                    return (
                      <button
                        key={k.value}
                        onClick={() => setActiveKind(isActive ? 'all' : k.value)}
                        aria-pressed={isActive}
                        style={{
                          cursor: 'pointer',
                          minHeight: 44,
                          padding: '0 var(--s4)',
                          border: 'none',
                          background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                          color: isActive ? 'var(--accent-ink)' : 'var(--ink)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: isActive ? 700 : 400,
                          fontSize: 'var(--fs-sm)',
                        }}
                      >
                        {k.label}
                        <span
                          className="faint"
                          style={{ marginLeft: 'var(--s1)', fontSize: 'var(--fs-xs)' }}
                        >
                          {isActive ? count : count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Feed */}
                {filtered.length === 0 ? (
                  <div className="card">
                    <Empty
                      icon={Inbox}
                      title="Nothing here yet"
                      hint={
                        activeKind === 'all'
                          ? 'Be the first to post something to the feed.'
                          : `No ${kindMeta(activeKind).label.toLowerCase()} posts yet. Try a different filter.`
                      }
                    />
                  </div>
                ) : (
                  <div className="stack" style={{ gap: 'var(--s4)' }}>
                    {filtered.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onDelete={handleDeletePost}
                        onRemoveMedia={handleRemoveMedia}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right: sidebar */}
              <div
                className="stack community-sidebar"
                style={{ gap: 'var(--s4)', minWidth: 0 }}
              >
                <TopContributors posts={allPosts} />
                <Guidelines />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responsive: stack sidebar below on mobile */}
      <style>{[
        '@media (max-width: 720px) {',
        '  .community-layout {',
        '    grid-template-columns: repeat(1, 1fr) !important;',
        '  }',
        '}',
      ].join(' ')}</style>
    </div>
    </RosterContext.Provider>
  )
}
