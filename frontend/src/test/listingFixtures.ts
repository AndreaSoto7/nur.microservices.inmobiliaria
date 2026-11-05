import type { Page, PropertyDetail, PropertySummary } from '../core/models/listing'

export const PROPERTY_ID = '3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01'

export function summary(overrides: Partial<PropertySummary> = {}): PropertySummary {
  return {
    id: PROPERTY_ID,
    title: 'Casa con jardín en Equipetrol',
    propertyType: 'HOUSE',
    operationType: 'SALE',
    status: 'PUBLISHED',
    price: { amount: 1285000, currency: 'BOB' },
    zone: 'Equipetrol',
    bedrooms: 3,
    bathrooms: 2,
    areaM2: 240.5,
    features: ['GARAGE', 'GARDEN'],
    coverImageUrl: `/api/v1/properties/${PROPERTY_ID}/images/5a1f0c2e-7b3d-4e6f-9a10-1b2c3d4e5f60`,
    publishedAt: '2026-10-16T14:30:00Z',
    updatedAt: '2026-10-16T14:30:00Z',
    ...overrides,
  }
}

export function page(
  data: PropertySummary[],
  meta: Partial<Page<PropertySummary>['page']> = {},
): Page<PropertySummary> {
  return {
    data,
    page: { number: 1, size: 12, totalElements: data.length, totalPages: 1, ...meta },
  }
}

export function detail(overrides: Partial<PropertyDetail> = {}): PropertyDetail {
  return {
    id: PROPERTY_ID,
    agentId: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    title: 'Casa con jardín en Equipetrol',
    description: 'Casa de dos plantas con jardín y garaje para dos autos.',
    propertyType: 'HOUSE',
    operationType: 'SALE',
    status: 'PUBLISHED',
    price: { amount: 1285000, currency: 'BOB' },
    location: { zone: 'Equipetrol', address: 'Calle 7 Oeste #120' },
    bedrooms: 3,
    bathrooms: 2,
    areaM2: 240.5,
    features: ['GARAGE', 'GARDEN'],
    images: [
      { id: 'img-2', position: 1, url: `/api/v1/properties/${PROPERTY_ID}/images/img-2` },
      { id: 'img-1', position: 0, url: `/api/v1/properties/${PROPERTY_ID}/images/img-1` },
    ],
    publishedAt: '2026-10-16T14:30:00Z',
    createdAt: '2026-10-16T14:00:00Z',
    updatedAt: '2026-10-16T14:30:00Z',
    ...overrides,
  }
}
