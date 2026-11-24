// Reflejo de contracts/openapi/visit-service.yaml. No agregues campos que no estén ahí.

export const VISIT_STATUSES = [
  'REQUESTED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const
export type VisitStatus = (typeof VISIT_STATUSES)[number]

/** Cómo contactar al interesado: lo último que dejó al consultar o pedir una visita. Solo trae lo conocido. */
export interface ClientContact {
  name?: string
  email?: string
  phone?: string
}

/** Quién propuso el horario pendiente: el interesado al pedir la visita, o el agente al sugerir otro. */
export type VisitProposer = 'CLIENT' | 'AGENT'

export interface Visit {
  id: string
  propertyId: string
  /** El interesado: el agente lo usa para encontrar su oportunidad. */
  clientId?: string
  client?: ClientContact
  proposedBy?: VisitProposer
  propertyTitle?: string
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
  /** Opcional, para que el agente pueda llamar. */
  contactPhone?: string
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
  /** Solo si el agente ya respondió. */
  repliedAt?: string
}

export interface Inquiry extends InquirySummary {
  contactEmail: string
  contactPhone?: string
  message: string
  /** La respuesta del agente (una por consulta). */
  reply?: string
}

export const LEAD_STATUSES = ['OPEN', 'CLOSED'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export type LeadOutcome = 'WON' | 'LOST'

/** Nota de seguimiento de una oportunidad (solo la ve su agente). */
export interface LeadFollowUp {
  id: string
  leadId: string
  note: string
  createdAt: string
}

export interface Lead {
  id: string
  propertyId: string
  clientId: string
  client?: ClientContact
  status: LeadStatus
  openedAt: string
  closedAt?: string
  outcome?: LeadOutcome
}
