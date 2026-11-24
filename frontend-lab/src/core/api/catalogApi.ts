import type { Page, PropertyDetail, PropertySummary } from '../models/listing'
import { apiRequest } from './httpClient'

// Catálogo público de listing (contracts/openapi/listing-service.yaml): no necesita sesión.
export const catalogApi = {
  /** {@code query} ya viene armado con los nombres del contrato (zone, type, operation, ...). */
  search: (query: string, signal?: AbortSignal) =>
    apiRequest<Page<PropertySummary>>(`/api/v1/catalog/properties?${query}`, { signal }),

  /** Solo responde si la propiedad está PUBLISHED o RESERVED; si no, 404. */
  get: (propertyId: string, signal?: AbortSignal) =>
    apiRequest<PropertyDetail>(`/api/v1/catalog/properties/${encodeURIComponent(propertyId)}`, {
      signal,
    }),
}
