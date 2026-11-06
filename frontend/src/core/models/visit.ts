// Reflejo de contracts/openapi/visit-service.yaml. No agregues campos que no estén ahí.

export const VISIT_STATUSES = [
  'REQUESTED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const
export type VisitStatus = (typeof VISIT_STATUSES)[number]

export interface Visit {
  id: string
  propertyId: string
  status: VisitStatus
  proposedAt: string
  requestedAt: string
  scheduledStart?: string
  scheduledEnd?: string
  completedAt?: string
  resolutionReason?: string
}

export interface RequestVisitRequest {
  propertyId: string
  /** UTC, con Z al final. */
  proposedAt: string
  clientNote?: string
}

export interface SendInquiryRequest {
  propertyId: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  message: string
}

export interface CreatedResponse {
  id: string
}

export interface InquirySummary {
  id: string
  propertyId: string
  contactName: string
  createdAt: string
}

export interface Inquiry extends InquirySummary {
  contactEmail: string
  contactPhone?: string
  message: string
}

export const LEAD_STATUSES = ['OPEN', 'CLOSED'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export type LeadOutcome = 'WON' | 'LOST'

export interface Lead {
  id: string
  propertyId: string
  clientId: string
  status: LeadStatus
  openedAt: string
  closedAt?: string
  outcome?: LeadOutcome
}
