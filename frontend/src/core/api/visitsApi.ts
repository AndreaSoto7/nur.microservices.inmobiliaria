import type { CreatedResponse, RequestVisitRequest } from '../models/visit'
import { apiRequest } from './httpClient'

// Visitas (contracts/openapi/visit-service.yaml). Todo POST exige Idempotency-Key.
export const visitsApi = {
  request: (request: RequestVisitRequest, idempotencyKey: string) =>
    apiRequest<CreatedResponse>('/api/v1/visits', {
      method: 'POST',
      body: request,
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
