import type { Page, PropertyStatus, PropertySummary, PropertyTransition } from '../models/listing'
import { apiRequest } from './httpClient'

const propertyPath = (propertyId: string) => `/api/v1/properties/${encodeURIComponent(propertyId)}`

// Propiedades del agente (contracts/openapi/listing-service.yaml): el servicio verifica que sean suyas.
export const propertiesApi = {
  list: (params: { status?: PropertyStatus; page: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page), sort: 'updatedAt,desc' })
    if (params.status) query.set('status', params.status)
    return apiRequest<Page<PropertySummary>>(`/api/v1/properties?${query}`, { auth: true, signal })
  },

  transition: (propertyId: string, transition: PropertyTransition) =>
    apiRequest<void>(`${propertyPath(propertyId)}/${transition}`, { method: 'POST', auth: true }),
}
