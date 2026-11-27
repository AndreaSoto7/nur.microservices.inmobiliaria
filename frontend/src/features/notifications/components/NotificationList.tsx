import { memo } from 'react'
import { Link } from 'react-router'
import type { AppNotification } from '../../../core/models/notification'
import { formatDateTime } from '../../../shared/format/date'
import { Button } from '../../../shared/ui/Button'
import { BellIcon, TrashIcon } from '../../../shared/ui/icons'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import type { NotificationLink } from '../notificationLink'
import { notificationTitle } from '../notificationToast'

interface NotificationListProps {
  notifications: AppNotification[]
  /** A dónde lleva cada aviso, si lleva a algún lado: lo decide el container. */
  linkFor: (notification: AppNotification) => NotificationLink | null
  busyId: string | null
  onMarkRead: (notificationId: string) => void
  onRemove: (notificationId: string) => void
}

export const NotificationList = memo(function NotificationList({
  notifications,
  linkFor,
  busyId,
  onMarkRead,
  onRemove,
}: NotificationListProps) {
  return (
    <ul className="row-list">
      {notifications.map((notification) => {
        const link = linkFor(notification)
        const unread = notification.readAt === null
        return (
          <li
            key={notification.id}
            className={`card row-card notification-row${unread ? ' is-unread' : ''}`}
          >
            <div className="row-card__head">
              <BellIcon className="notification-row__icon" />
              <div className="notification-row__content">
                <h2 className="notification-row__title">{notificationTitle(notification.type)}</h2>
                <p className={unread ? 'row-card__title' : undefined}>{notification.message}</p>
                <p className="row-card__meta">{formatDateTime(notification.createdAt)}</p>
              </div>
              {unread && <StatusBadge label="Sin leer" tone="warning" />}
            </div>
            <div className="action-bar">
              {link && (
                <Link to={link.href} className="button button--secondary">
                  {link.label}
                </Link>
              )}
              {unread && (
                <Button
                  variant="secondary"
                  disabled={busyId === notification.id}
                  aria-label={`Marcar como leído: ${notification.message}`}
                  onClick={() => onMarkRead(notification.id)}
                >
                  Marcar como leído
                </Button>
              )}
              <Button
                variant="secondary"
                className="icon-button"
                disabled={busyId === notification.id}
                aria-label={`Borrar aviso: ${notification.message}`}
                title="Borrar aviso"
                onClick={() => onRemove(notification.id)}
              >
                <TrashIcon className="icon-button__icon" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
})
