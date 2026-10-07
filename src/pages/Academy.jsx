import { Link } from 'react-router-dom'
import { Salad, HeartPulse, Rocket } from 'lucide-react'
import { PageHead } from '../components/ui'
import { PROGRAMS } from '../lib/academy'

// Resolve a lucide icon name string to a component. Falls back to Rocket
// (icon convention: no star/sparkle glyphs anywhere in this app).
//
// Explicit map rather than `import * as Icons` — see the long note in
// Sidebar.jsx. A namespace import here pulls all ~1,500 lucide icons into the
// bundle, and because every chunk is modulepreloaded from index.html that cost
// lands on the public landing page. Add a course icon to PROGRAMS? Add it here.
const ICONS = { Salad, HeartPulse, Rocket }

function DynIcon({ name, ...props }) {
  const Icon = ICONS[name] || Rocket
  return <Icon {...props} />
}

export default function Academy() {
  return (
    <div className="page">
      <PageHead
        eyebrow="Intelligence"
        title="Academy"
        sub="Community courses on fuelling, mental health, and building something of your own."
      />

      <div className="grid grid--2">
        {PROGRAMS.map((prog) => (
          <Link
            key={prog.id}
            to={`/app/academy/${prog.id}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div
              className="card card--raised"
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--s4)',
                padding: 'var(--s5)',
                transition: 'transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = ''
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DynIcon name={prog.icon} size={22} color="var(--accent-ink)" strokeWidth={1.8} />
              </div>

              {/* Title + summary */}
              <div className="stack" style={{ gap: 'var(--s2)', flex: 1 }}>
                <div className="display" style={{ fontSize: 'var(--fs-md)', lineHeight: 1.35 }}>
                  {prog.title}
                </div>
                <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6, margin: 0 }}>
                  {prog.summary}
                </p>
              </div>

              {/* Meta chips */}
              <div className="chiprow">
                <span className="chip">{prog.level}</span>
                <span className="chip">{prog.duration}</span>
                <span className="chip">
                  {prog.lessons.length} lesson{prog.lessons.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
