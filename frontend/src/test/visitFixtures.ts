import type { Page } from '../core/models/listing'
import type { Visit } from '../core/models/visit'
import { PROPERTY_ID } from './listingFixtures'

export const VISIT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

export function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: VISIT_ID,
    propertyId: PROPERTY_ID,
    status: 'REQUESTED',
    proposedAt: '2099-01-15T14:30:00Z',
    requestedAt: '2026-10-16T14:30:00Z',
    ...overrides,
  }
}

export function visitPage(items: Visit[], meta: Partial<Page<Visit>['page']> = {}): Page<Visit> {
  return {
    data: items,
    page: { number: 1, size: 20, totalElements: items.length, totalPages: 1, ...meta },
  }
}
