import { describe, expect, it } from 'vitest'
import type { AppNotification } from '../../core/models/notification'
import { toastFor, unannounced } from './notificationToast'

const notice = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 'aviso',
  type: 'INQUIRY_RECEIVED',
  message: 'Recibiste una nueva consulta.',
  propertyId: null,
  visitId: null,
  createdAt: '2026-11-24T15:00:00Z',
  readAt: null,
  ...overrides,
})

describe('unannounced', () => {
  it('keeps the unread ones newer than the last announced, newest first', () => {
    const old = notice({ id: 'viejo', createdAt: '2026-11-24T14:00:00Z' })
    const read = notice({ id: 'leido', readAt: '2026-11-24T15:05:00Z' })
    const newer = notice({ id: 'nuevo', createdAt: '2026-11-24T16:00:00Z' })
    const fresh = unannounced([old, read, notice(), newer], '2026-11-24T14:30:00Z')
    expect(fresh.map((item) => item.id)).toEqual(['nuevo', 'aviso'])
  })

  it('announces every unread one the first time', () => {
    expect(unannounced([notice()], null)).toHaveLength(1)
  })
})

describe('toastFor', () => {
  it('names the kind of notification and links to its screen', () => {
    expect(toastFor([notice()])).toEqual({
      id: 'aviso',
      title: 'Tienes una nueva consulta',
      message: 'Recibiste una nueva consulta.',
      link: { href: '/agent/inquiries', label: 'Ver consultas' },
    })
  })

  it('counts them when several arrived together', () => {
    const toast = toastFor([notice({ type: 'VISIT_REQUESTED' }), notice()])
    expect(toast?.title).toBe('Tienes 2 avisos nuevos')
    expect(toast?.message).toBe('Nueva solicitud de visita')
    expect(toast?.link.href).toBe('/notifications')
  })

  it('uses the total when more arrived than the query brings', () => {
    expect(toastFor([notice(), notice({ id: 'otro' })], 9)?.title).toBe('Tienes 9 avisos nuevos')
  })

  it('falls back to a generic title for a type it does not know yet', () => {
    expect(toastFor([notice({ type: 'NEW_TYPE' })])?.title).toBe('Tienes un nuevo aviso')
  })
})
