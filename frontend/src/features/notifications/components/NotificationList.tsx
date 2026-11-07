import { memo } from 'react'
import { Link } from 'react-router'
import type { AppNotification } from '../../../core/models/notification'
import { formatDateTime } from '../../../shared/format/date'
import { Button } from '../../../shared/ui/Button'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import type { NotificationLink } from '../notificationLink'

interface NotificationListProps {
  notifications: AppNotification[]
  /** A dónde lleva cada aviso, si lleva a algún lado: lo decide el container. */
  linkFor: (notification: AppNotification) => NotificationLink | null
  markingId: string | null
  onMarkRead: (notificationId: string) => void
}

export const NotificationList = memo(function NotificationList({
  notifications,
  linkFor,
  markingId,
  onMarkRead,
}: NotificationListProps) {
  return (
    <ul className="row-list">
      {notifications.map((notification) => {
        const link = linkFor(notification)
        const unread = notification.readAt === null
        return (
          <li key={notification.id} className="card row-card">
            <div className="row-card__head">
              <div>
                <p className={unread ? 'row-card__title' : undefined}>{notification.message}</p>
                <p className="row-card__meta">{formatDateTime(notification.createdAt)}</p>
              </div>
              {unread && <StatusBadge label="Sin leer" tone="warning" />}
            </div>
            {(link || unread) && (
              <div className="action-bar">
                {link && (
                  <Link to={link.href} className="button button--secondary">
                    {link.label}
                  </Link>
                )}
                {unread && (
                  <Button
                    variant="secondary"
                    disabled={markingId === notification.id}
                    aria-label={`Marcar como leído: ${notification.message}`}
                    onClick={() => onMarkRead(notification.id)}
                  >
                    Marcar como leído
                  </Button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
})
