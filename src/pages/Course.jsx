import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import { Empty } from '../components/ui'
import { getProgram } from '../lib/academy'
import { tenant } from '../lib/theme'
import BrandLogo from '../components/BrandLogo'

// ── Lesson video ─────────────────────────────────────────────────────
// Every lesson in academy.js carries a `video` field. Until a lesson is
// actually filmed it is null, and this renders a placeholder frame in
// the same 16:9 box the real player will occupy — so the page does not
// reflow when the videos land, and nobody has to redesign this screen.
//
// The placeholder's play control is deliberately NOT a button. A button
// that does nothing when pressed is worse than no button: it reads as
// broken rather than as pending. It is inert, aria-hidden, and the
// figcaption below carries the actual meaning for everyone.
// The placeholder frame. Kept as CSS rather than inline styles because it
// needs pseudo-elements (the diagonal sheen) and a media query, neither of
// which the style attribute can express.
//
// max-width is 620px on both the placeholder and the real player: the lesson
// body beside it is capped at 66ch, and a 900px-wide video above a 620px-wide
// column reads as two unrelated things stacked rather than one lesson.
const lessonVideoCss = `
.lv { max-width: 620px; }
.lv__frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, #2a2a2e 0%, #151517 55%, #0d0d0f 100%);
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
}
/* A single soft diagonal highlight. Enough to stop the frame reading as a
   dead grey rectangle; not enough to look like it is trying to be artwork. */
.lv__frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 42%);
  pointer-events: none;
}
.lv__mark {
  position: absolute;
  top: var(--s3);
  left: var(--s4);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--fs-sm);
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.38);
}
/* The real wordmark replaces the text mark at the same visual weight: the
   text was white at 38% — the white PNG gets the same treatment so it stays
   a watermark, not a billboard, inside the fake player. */
.lv__mark img { opacity: 0.45; }
.lv__play {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.72);
  background: rgba(255,255,255,0.09);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(2px);
}
.lv__bar {
  position: absolute;
  left: var(--s4);
  right: var(--s4);
  bottom: var(--s4);
  height: 3px;
  border-radius: 999px;
  background: rgba(255,255,255,0.16);
  overflow: hidden;
}
/* Parked at 0%, not animated. A moving bar on a video that does not exist
   suggests something is loading and about to play. Nothing is. */
.lv__bar > span {
  display: block;
  width: 0%;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
}
.lv__player { max-width: 620px; }
@media (max-width: 640px) {
  .lv__play { width: 46px; height: 46px; }
  .lv__mark { top: var(--s2); left: var(--s3); }
}
`

function LessonVideo({ lesson, index }) {
  if (lesson.video) {
    return (
      <video
        className="lv__player"
        src={lesson.video}
        poster={lesson.poster || undefined}
        controls
        // metadata, not auto: a course page holds three of these, and
        // preloading three full videos would cost several MB before the
        // reader has scrolled to the first one.
        preload="metadata"
        style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius)', background: '#000' }}
      />
    )
  }

  return (
    <figure className="lv" style={{ margin: 0 }}>
      <div className="lv__frame">
        <div className="lv__mark" aria-hidden="true">
          {/* Watermark corner of the fake player — small and faded like the
              text mark it replaces (.lv__mark img rule dims it to match). */}
          <BrandLogo on="dark" height={14} alt="">
            {tenant.mark}
          </BrandLogo>
        </div>
        <div className="lv__play" aria-hidden="true">
          <Play size={22} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} />
        </div>
        <div className="lv__bar" aria-hidden="true">
          <span />
        </div>
      </div>
      <figcaption
        className="muted"
        style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s2)', letterSpacing: '0.02em' }}
      >
        Lesson {String(index + 1).padStart(2, '0')} video — coming soon. The full written lesson is
        below.
      </figcaption>
    </figure>
  )
}

export default function Course() {
  const { id } = useParams()
  const program = getProgram(id)

  if (!program) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 'var(--s7) var(--s5)' }}>
          <Empty title="Course not found" hint="This course may have been moved or renamed." />
        </div>
        <div style={{ marginTop: 'var(--s4)' }}>
          <Link
            to="/app/academy"
            className="muted"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--s2)',
              fontSize: 'var(--fs-sm)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} />
            Back to Academy
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <style>{lessonVideoCss}</style>

      {/* Back link */}
      <Link
        to="/app/academy"
        className="muted"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--s2)',
          fontSize: 'var(--fs-sm)',
          textDecoration: 'none',
          marginBottom: 'var(--s5)',
        }}
      >
        <ArrowLeft size={14} />
        Academy
      </Link>

      {/* Course header */}
      <div className="stack" style={{ gap: 'var(--s3)', marginBottom: 'var(--s7)' }}>
        <div className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
          {program.level} · {program.duration}
        </div>
        <h1
          className="display"
          style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.2, margin: 0 }}
        >
          {program.title}
        </h1>
        <p
          className="muted"
          style={{ fontSize: 'var(--fs-md)', lineHeight: 1.7, maxWidth: '62ch', margin: 0 }}
        >
          {program.summary}
        </p>
      </div>

      {/* Lessons */}
      <div className="stack" style={{ gap: 'var(--s5)' }}>
        {program.lessons.map((lesson, i) => (
          <div key={i} className="card" style={{ padding: 'var(--s5) var(--s6)' }}>
            <div className="rowflex" style={{ gap: 'var(--s5)', alignItems: 'flex-start' }}>
              {/* Lesson number */}
              <div
                className="mono"
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--accent-ink)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  paddingTop: '3px',
                  flexShrink: 0,
                  minWidth: '2ch',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>

              {/* Content */}
              <div className="stack" style={{ gap: 'var(--s4)', flex: 1 }}>
                <div
                  className="display"
                  style={{ fontSize: 'var(--fs-lg)', lineHeight: 1.3 }}
                >
                  {lesson.title}
                </div>

                <LessonVideo lesson={lesson} index={i} />

                <div style={{ maxWidth: '66ch' }}>
                  {lesson.body.split('\n\n').map((para, j) => (
                    <p
                      key={j}
                      style={{
                        fontSize: 'var(--fs-base)',
                        lineHeight: 1.75,
                        color: 'var(--ink)',
                        margin: j > 0 ? 'var(--s4) 0 0' : '0',
                      }}
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer nav */}
      <div style={{ marginTop: 'var(--s7)', paddingTop: 'var(--s5)', borderTop: '1px solid var(--line)' }}>
        <Link
          to="/app/academy"
          className="muted"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--s2)',
            fontSize: 'var(--fs-sm)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={14} />
          Back to all courses
        </Link>
      </div>
    </div>
  )
}
