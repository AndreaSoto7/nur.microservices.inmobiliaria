import type { Page } from '../models/listing'
import type { CreatedResponse, RequestVisitRequest, Visit, VisitStatus } from '../models/visit'
import { apiRequest } from './httpClient'

// Visitas (contracts/openapi/visit-service.yaml). Todo POST exige Idempotency-Key.
export const visitsApi = {
  /** Según el rol del token: las propias de un `CLIENT`, las asignadas de un `AGENT`. */
  list: (params: { status?: VisitStatus; page: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page), sort: 'requestedAt,desc' })
    if (params.status) query.set('status', params.status)
    return apiRequest<Page<Visit>>(`/api/v1/visits?${query}`, { auth: true, signal })
  },

  request: (request: RequestVisitRequest, idempotencyKey: string) =>
    apiRequest<CreatedResponse>('/api/v1/visits', {
      method: 'POST',
      body: request,
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  cancel: (visitId: string, reason: string | undefined, idempotencyKey: string) =>
    apiRequest<void>(`/api/v1/visits/${encodeURIComponent(visitId)}/cancel`, {
      method: 'POST',
      body: reason ? { reason } : {},
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
