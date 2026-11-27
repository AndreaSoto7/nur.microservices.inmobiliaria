import type { AppNotification } from '../../core/models/notification'
import { notificationLink, type NotificationLink } from './notificationLink'

/** Un título corto para cada tipo: el detalle ya viene en `message`. */
const TITLES: Record<string, string> = {
  WELCOME: '¡Te damos la bienvenida!',
  INQUIRY_RECEIVED: 'Tienes una nueva consulta',
  INQUIRY_REPLIED: 'Respondieron tu consulta',
  VISIT_REQUESTED: 'Nueva solicitud de visita',
  VISIT_TIME_PROPOSED: 'Te propusieron otro horario',
  VISIT_TIME_PROPOSED_BY_CLIENT: 'Un interesado propuso otro horario',
  VISIT_PROPOSAL_ACCEPTED: 'Aceptaron tu horario',
  VISIT_SCHEDULED: 'Tu visita fue confirmada',
  VISIT_REJECTED: 'Rechazaron tu solicitud de visita',
  VISIT_CANCELLED: 'Cancelaron tu visita',
  VISIT_CANCELLED_BY_CLIENT: 'Un interesado canceló su visita',
  VISIT_COMPLETED: 'Tu visita quedó como realizada',
  PROPERTY_RESERVED: 'Tu propiedad quedó reservada',
}

export const notificationTitle = (type: string) => TITLES[type] ?? 'Novedad de tu actividad'

export interface ToastContent {
  /** El aviso más nuevo: si cambia, es otro anuncio. */
  id: string
  title: string
  message: string
  link: NotificationLink
}

/** Los sin leer que todavía no se anunciaron, del más nuevo al más viejo. */
export function unannounced(notifications: AppNotification[], announcedUpTo: string | null) {
  return notifications
    .filter((item) => item.readAt === null && (!announcedUpTo || item.createdAt > announcedUpTo))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Qué decir: el aviso nuevo con su título, o cuántos llegaron si son varios. `count` es cuántos son en
 * total: la consulta trae solo los últimos, y puede haber más.
 */
export function toastFor(fresh: AppNotification[], count = fresh.length): ToastContent | null {
  const [newest] = fresh
  if (!newest) return null
  if (count > 1) {
    return {
      id: newest.id,
      title: `Tienes ${count} avisos nuevos`,
      message: TITLES[newest.type] ?? newest.message,
      link: { href: '/notifications', label: 'Ver avisos' },
    }
  }
  return {
    id: newest.id,
    title: TITLES[newest.type] ?? 'Tienes un nuevo aviso',
    message: newest.message,
    link: notificationLink(newest) ?? { href: '/notifications', label: 'Ver avisos' },
  }
}
