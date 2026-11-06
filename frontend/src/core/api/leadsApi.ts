import type { Page } from '../models/listing'
import type { CreatedResponse, Lead, LeadOutcome, LeadStatus } from '../models/visit'
import { apiRequest } from './httpClient'

const leadPath = (leadId: string) => `/api/v1/leads/${encodeURIComponent(leadId)}`

// Oportunidades del agente (contracts/openapi/visit-service.yaml). Todo POST exige Idempotency-Key.
export const leadsApi = {
  list: (params: { status?: LeadStatus; page: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page), sort: 'openedAt,desc' })
    if (params.status) query.set('status', params.status)
    return apiRequest<Page<Lead>>(`/api/v1/leads?${query}`, { auth: true, signal })
  },

  addFollowUp: (leadId: string, note: string, idempotencyKey: string) =>
    apiRequest<CreatedResponse>(`${leadPath(leadId)}/follow-ups`, {
      method: 'POST',
      body: { note },
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  close: (
    leadId: string,
    params: { outcome: LeadOutcome; note?: string },
    idempotencyKey: string,
  ) =>
    apiRequest<void>(`${leadPath(leadId)}/close`, {
      method: 'POST',
      body: params,
      auth: true,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
