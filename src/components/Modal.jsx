// Accessible modal dialog. Esc to close, backdrop click to close,
// focus moved into the panel on open. Used by every "Add / Edit" form.
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null)

  // Keep the latest onClose in a ref so the Esc listener always calls the
  // current handler WITHOUT making onClose an effect dependency. Callers pass
  // a fresh onClose fn every render (e.g. () => setOpen(false)); if it were a
  // dependency, this effect would re-run on every keystroke and steal focus
  // from the field — dropping every character after the first.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    // Move focus into the dialog for accessibility, but never fight a field
    // that already autoFocused itself — only grab focus if nothing inside
    // the panel currently holds it.
    const panel = ref.current
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus()
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <div className="modal__scrim" onMouseDown={onClose} role="presentation">
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3 style={{ fontSize: 'var(--fs-lg)' }}>{title}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}
