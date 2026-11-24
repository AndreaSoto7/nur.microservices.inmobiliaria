import type { Page } from '../models/listing'
import type { CreatedResponse, Inquiry, InquirySummary, SendInquiryRequest } from '../models/visit'
import { apiRequest } from './httpClient'

// Consultas (contracts/openapi/visit-service.yaml). Todo POST exige Idempotency-Key.
export const inquiriesApi = {
  /**
   * Las del token: un agente ve las asignadas; un cliente, las que envió. No trae el mensaje ni la
   * respuesta: se piden al abrir cada una.
   */
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

  reply: (inquiryId: string, message: string, idempotencyKey: string) =>
    apiRequest<CreatedResponse>(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}/reply`, {
      method: 'POST',
      body: { message },
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  send: (request: SendInquiryRequest, idempotencyKey: string) =>
    apiRequest<CreatedResponse>('/api/v1/inquiries', {
      method: 'POST',
      body: request,
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
