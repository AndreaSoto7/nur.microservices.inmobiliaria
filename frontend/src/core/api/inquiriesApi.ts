import type { CreatedResponse, SendInquiryRequest } from '../models/visit'
import { apiRequest } from './httpClient'

// Consultas (contracts/openapi/visit-service.yaml). Todo POST exige Idempotency-Key.
export const inquiriesApi = {
  send: (request: SendInquiryRequest, idempotencyKey: string) =>
    apiRequest<CreatedResponse>('/api/v1/inquiries', {
      method: 'POST',
      body: request,
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
