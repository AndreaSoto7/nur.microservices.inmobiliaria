import type { AppNotification } from '../../core/models/notification'

export interface NotificationLink {
  href: string
  label: string
}

const MY_VISITS: NotificationLink = { href: '/my-visits', label: 'Ver mis visitas' }
const VISIT_REQUESTS: NotificationLink = { href: '/agent/visit-requests', label: 'Ver solicitudes' }

const LINKS_BY_TYPE: Record<string, NotificationLink> = {
  VISIT_SCHEDULED: MY_VISITS,
  VISIT_REJECTED: MY_VISITS,
  VISIT_CANCELLED: MY_VISITS,
  VISIT_REQUESTED: VISIT_REQUESTS,
  VISIT_CANCELLED_BY_CLIENT: VISIT_REQUESTS,
  INQUIRY_RECEIVED: { href: '/agent/inquiries', label: 'Ver consultas' },
}

/**
 * A qué pantalla lleva un aviso. El contrato pide tolerar tipos nuevos: si no se conoce, lleva a la
 * ficha pública de la propiedad, o a ningún lado si no hay propiedad.
 */
export function notificationLink(notification: AppNotification): NotificationLink | null {
  const known = LINKS_BY_TYPE[notification.type]
  if (known) return known
  if (!notification.propertyId) return null
  const owner = notification.type === 'PROPERTY_RESERVED' ? '/agent' : ''
  return { href: `${owner}/properties/${notification.propertyId}`, label: 'Ver propiedad' }
}
