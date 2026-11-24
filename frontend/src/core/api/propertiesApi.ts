import type {
  CreatePropertyRequest,
  EditPropertyRequest,
  IdResponse,
  Page,
  PropertyDetail,
  PropertyStatus,
  PropertySummary,
  PropertyTransition,
  UpdateFeaturesRequest,
} from '../models/listing'
import { apiBlob, apiRequest } from './httpClient'

const propertyPath = (propertyId: string) => `/api/v1/properties/${encodeURIComponent(propertyId)}`

// Propiedades del agente (contracts/openapi/listing-service.yaml): el servicio verifica que sean suyas.
export const propertiesApi = {
  list: (params: { status?: PropertyStatus; page: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page), sort: 'updatedAt,desc' })
    if (params.status) query.set('status', params.status)
    return apiRequest<Page<PropertySummary>>(`/api/v1/properties?${query}`, { auth: true, signal })
  },

  get: (propertyId: string, signal?: AbortSignal) =>
    apiRequest<PropertyDetail>(propertyPath(propertyId), { auth: true, signal }),

  create: (request: CreatePropertyRequest) =>
    apiRequest<IdResponse>('/api/v1/properties', { method: 'POST', body: request, auth: true }),

  update: (propertyId: string, request: EditPropertyRequest) =>
    apiRequest<void>(propertyPath(propertyId), { method: 'PUT', body: request, auth: true }),

  updateFeatures: (propertyId: string, request: UpdateFeaturesRequest) =>
    apiRequest<void>(`${propertyPath(propertyId)}/features`, {
      method: 'PUT',
      body: request,
      auth: true,
    }),

  uploadImages: (propertyId: string, files: File[]) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    return apiRequest<{ imageIds: string[] }>(`${propertyPath(propertyId)}/images`, {
      method: 'POST',
      body: form,
      auth: true,
    })
  },

  removeImage: (propertyId: string, imageId: string) =>
    apiRequest<void>(`${propertyPath(propertyId)}/images/${encodeURIComponent(imageId)}`, {
      method: 'DELETE',
      auth: true,
    }),

  /** Mueve una foto a otra posición de la galería; la 0 es la portada. */
  moveImage: (propertyId: string, imageId: string, position: number) =>
    apiRequest<void>(`${propertyPath(propertyId)}/images/${encodeURIComponent(imageId)}`, {
      method: 'PATCH',
      body: { position },
      auth: true,
    }),

  /** Una foto de un borrador o de una propiedad pausada: solo la ve su agente, con su token. */
  imageBlob: (imageUrl: string, signal?: AbortSignal) => apiBlob(imageUrl, { auth: true, signal }),

  transition: (propertyId: string, transition: PropertyTransition) =>
    apiRequest<void>(`${propertyPath(propertyId)}/${transition}`, { method: 'POST', auth: true }),
}
