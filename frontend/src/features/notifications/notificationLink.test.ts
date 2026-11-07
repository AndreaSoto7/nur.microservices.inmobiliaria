import { describe, expect, it } from 'vitest'
import type { AppNotification } from '../../core/models/notification'
import { notificationLink } from './notificationLink'

const PROPERTY_ID = '3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01'

const notice = (type: string, propertyId: string | null = PROPERTY_ID): AppNotification => ({
  id: 'n1',
  type,
  message: 'Texto',
  propertyId,
  visitId: null,
  createdAt: '2026-10-16T14:30:00Z',
  readAt: null,
})

describe('notificationLink', () => {
  it.each(['VISIT_SCHEDULED', 'VISIT_REJECTED', 'VISIT_CANCELLED', 'VISIT_COMPLETED'])(
    'sends the client to their visits on %s',
    (type) => {
      expect(notificationLink(notice(type))).toEqual({
        href: '/my-visits',
        label: 'Ver mis visitas',
      })
    },
  )

  it.each(['VISIT_REQUESTED', 'VISIT_CANCELLED_BY_CLIENT'])(
    'sends the agent to the visit requests on %s',
    (type) => {
      expect(notificationLink(notice(type))).toEqual({
        href: '/agent/visit-requests',
        label: 'Ver solicitudes',
      })
    },
  )

  it('sends the agent to the inquiries when one arrives', () => {
    expect(notificationLink(notice('INQUIRY_RECEIVED'))).toEqual({
      href: '/agent/inquiries',
      label: 'Ver consultas',
    })
  })

  it('sends the agent to their own property when it gets reserved', () => {
    expect(notificationLink(notice('PROPERTY_RESERVED'))).toEqual({
      href: `/agent/properties/${PROPERTY_ID}`,
      label: 'Ver propiedad',
    })
  })

  it('falls back to the public property on an unknown type', () => {
    expect(notificationLink(notice('NEW_TYPE'))).toEqual({
      href: `/properties/${PROPERTY_ID}`,
      label: 'Ver propiedad',
    })
  })

  it('offers no link on an unknown type without a property', () => {
    expect(notificationLink(notice('NEW_TYPE', null))).toBeNull()
  })

  it('offers no link on a welcome notice', () => {
    expect(notificationLink(notice('WELCOME', null))).toBeNull()
  })
})
