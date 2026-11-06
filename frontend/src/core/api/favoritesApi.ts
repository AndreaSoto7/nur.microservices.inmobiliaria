import type { Favorite, Page } from '../models/listing'
import { apiRequest } from './httpClient'

// Favoritos de quien tiene la sesión (contracts/openapi/listing-service.yaml).
export const favoritesApi = {
  list: (params: { page: number; size: number }, signal?: AbortSignal) =>
    apiRequest<Page<Favorite>>(`/api/v1/favorites?page=${params.page}&size=${params.size}`, {
      auth: true,
      signal,
    }),

  /** Responde 201 solo con el header Location, sin body. */
  add: (propertyId: string) =>
    apiRequest<void>('/api/v1/favorites', { method: 'POST', body: { propertyId }, auth: true }),

  remove: (propertyId: string) =>
    apiRequest<void>(`/api/v1/favorites/${encodeURIComponent(propertyId)}`, {
      method: 'DELETE',
      auth: true,
    }),
}
