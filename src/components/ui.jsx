// Tiny shared presentational helpers. Keep these dumb + reusable.
import { Inbox } from 'lucide-react'

// Page header with eyebrow + title + optional right-side actions.
export function PageHead({ eyebrow, title, sub, children }) {
  return (
    <div className="page__head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page__title">{title}</h1>
        {sub && <div className="page__sub">{sub}</div>}
      </div>
      {children && <div className="rowflex" style={{ gap: 'var(--s2)' }}>{children}</div>}
    </div>
  )
}

// Status/stage pill. `meta` = { label, tone } from constants.js.
export function Badge({ meta }) {
  if (!meta) return null
  return <span className={`badge badge--${meta.tone}`}>{meta.label}</span>
}

// Empty state.
export function Empty({ icon: Icon = Inbox, title = 'Nothing here yet', hint }) {
  return (
    <div className="empty">
      <Icon className="empty__icon" strokeWidth={1.4} />
      <div className="display" style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>
        {title}
      </div>
      {hint && <p className="muted" style={{ margin: '6px auto 0', fontSize: 'var(--fs-sm)' }}>{hint}</p>}
    </div>
  )
}

// Loading skeleton rows.
export function Loading({ rows = 4 }) {
  return (
    <div className="grid" style={{ gap: 'var(--s3)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 52 }} />
      ))}
    </div>
  )
}

// Initials for avatars.
export const initials = (name = '?') =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
