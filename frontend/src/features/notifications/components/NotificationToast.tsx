import { memo } from 'react'
import { Link } from 'react-router'
import { BellIcon, CloseIcon } from '../../../shared/ui/icons'
import type { ToastContent } from '../notificationToast'

interface NotificationToastProps {
  toast: ToastContent
  leaving: boolean
  onClose: () => void
  /** Mientras el puntero o el foco están encima, no se cierra solo. */
  onHold: (holding: boolean) => void
}

/** Dumb: el anuncio de un aviso nuevo, que baja desde arriba. */
export const NotificationToast = memo(function NotificationToast({
  toast,
  leaving,
  onClose,
  onHold,
}: NotificationToastProps) {
  return (
    <div
      className={`toast${leaving ? ' is-leaving' : ''}`}
      role="status"
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
      onFocus={() => onHold(true)}
      onBlur={() => onHold(false)}
    >
      <BellIcon className="toast__icon" />
      <div className="toast__body">
        <p className="toast__title">{toast.title}</p>
        <p className="toast__message">{toast.message}</p>
      </div>
      <Link to={toast.link.href} className="toast__action" onClick={onClose}>
        {toast.link.label}
      </Link>
      <button type="button" className="toast__close" aria-label="Cerrar aviso" onClick={onClose}>
        <CloseIcon className="toast__close-icon" />
      </button>
    </div>
  )
})
