// ChatPanel — slide-over assistant panel.
// Stays mounted at all times so conversation persists while navigating.
import { X } from 'lucide-react'
import { tenant } from '../lib/theme'
import ChatThread from './ChatThread'

export default function ChatPanel({ open, onClose }) {
  return (
    <aside className={`chatpanel ${open ? 'open' : ''}`} aria-label="Assistant panel">
      <div className="chatpanel__head">
        <div>
          <div className="display" style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>
            Assistant
          </div>
          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
            {tenant.name}
          </div>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onClose}
          aria-label="Close assistant"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <X size={18} />
        </button>
      </div>

      <ChatThread />
    </aside>
  )
}
