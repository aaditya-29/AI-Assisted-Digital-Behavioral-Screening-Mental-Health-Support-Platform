import './Modal.css'

export default function Modal({
  open,
  title,
  message,
  children,
  onClose,
  primaryAction,
  secondaryAction,
  showClose = true,
  className = ''
}) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel ${className}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          {showClose && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
          )}
        </div>

        <div className="modal-body">
          {message && <p className="modal-message">{message}</p>}
          {children}
        </div>

        {(secondaryAction || primaryAction) && (
          <div className="modal-footer">
            {secondaryAction && (
              <button
                className={`btn btn-secondary ${secondaryAction.className || ''}`}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </button>
            )}
            {primaryAction && (
              <button
                className={`btn btn-primary ${primaryAction.className || ''}`}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}