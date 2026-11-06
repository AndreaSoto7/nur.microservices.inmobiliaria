import type { Page } from '../models/listing'
import type { CreatedResponse, Inquiry, InquirySummary, SendInquiryRequest } from '../models/visit'
import { apiRequest } from './httpClient'

// Consultas (contracts/openapi/visit-service.yaml). Todo POST exige Idempotency-Key.
export const inquiriesApi = {
  /** Las asignadas al agente del token. No trae el mensaje: se pide al abrir cada una. */
  list: (params: { page: number }, signal?: AbortSignal) =>
    apiRequest<Page<InquirySummary>>(
      `/api/v1/inquiries?page=${params.page}&sort=createdAt%2Cdesc`,
      { auth: true, signal },
    ),

  get: (inquiryId: string, signal?: AbortSignal) =>
    apiRequest<Inquiry>(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}`, {
      auth: true,
      signal,
    }),

  send: (request: SendInquiryRequest, idempotencyKey: string) =>
    apiRequest<CreatedResponse>('/api/v1/inquiries', {
      method: 'POST',
      body: request,
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
