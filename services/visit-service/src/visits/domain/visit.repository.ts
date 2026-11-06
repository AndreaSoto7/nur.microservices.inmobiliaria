import type {
  AgentInquirySummary,
  Inquiry,
  InquiryDetails,
} from '../../inquiries/domain/inquiry.js';
import type {
  Lead,
  LeadClosure,
  LeadFollowUp,
  LeadFollowUpDetails,
  LeadStatus,
  LeadSummary,
} from '../../leads/domain/lead.js';
import type { Page, PageFilter } from '../../shared/page.js';
import type { Visit, VisitSlot, VisitStatus } from './visit.js';

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');

export type VisitPrincipal = { id: string; roles: readonly string[] };

export type VisitDetails = {
  id: string;
  propertyId: string;
  status: VisitStatus;
  proposedAt: Date;
  requestedAt: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  resolutionReason?: string;
  completedAt?: Date;
};

export type LeadListFilter = PageFilter & { status?: LeadStatus };
export type VisitListFilter = PageFilter & { status?: VisitStatus };

export type VisitCreation = { id: string };
export type ScheduledVisit = {
  id: string;
  status: 'SCHEDULED';
  scheduledStart: string;
  scheduledEnd: string;
};
export type RejectedVisit = { id: string; status: 'REJECTED' };
export type CancelledVisit = { id: string; status: 'CANCELLED' };
export type CompletedVisit = { id: string; status: 'COMPLETED' };
export type VisitCancellationActor = 'CLIENT' | 'AGENT' | 'SYSTEM';
export type VisitRejectionActor = 'AGENT' | 'SYSTEM';
export type PropertyPolicySource = {
  actor: 'SYSTEM';
  eventId: string;
  propertyId: string;
  status: 'RESERVED' | 'SOLD' | 'RENTED';
  occurredAt: string;
};
export type RequestKey = {
  actorId: string;
  key: string;
  operation:
    | 'request-visit'
    | 'schedule-visit'
    | 'reject-visit'
    | 'cancel-visit'
    | 'complete-visit'
    | 'send-inquiry'
    | 'register-lead-follow-up'
    | 'close-lead';
};

export type VisitEvent = {
  type:
    | 'InquiryReceived'
    | 'VisitRequested'
    | 'VisitScheduled'
    | 'VisitRejected'
    | 'VisitCancelled'
    | 'VisitCompleted'
    | 'LeadOpened'
    | 'LeadFollowUpRegistered'
    | 'LeadClosed';
  aggregateId: string;
  occurredAt: Date;
  correlationId: string;
  causationId?: string;
  payload: Record<string, string | null>;
};

export type LeadContact = {
  propertyId: string;
  clientId: string;
  agentId: string;
  openedAt: Date;
};

export interface VisitTransaction {
  lockRequest(key: RequestKey): Promise<void>;
  findRequest<T extends VisitCreation>(
    key: RequestKey,
  ): Promise<{ hash: string; response: T } | undefined>;
  findProperty(
    id: string,
  ): Promise<{ id: string; agentId: string; status: string } | undefined>;
  saveVisit(visit: Visit, note: string | undefined): Promise<void>;
  saveInquiry(inquiry: Inquiry): Promise<void>;
  findAssignedLead(id: string, agentId: string): Promise<Lead | undefined>;
  saveLeadClosure(id: string, closure: LeadClosure): Promise<void>;
  saveLeadFollowUp(followUp: LeadFollowUp): Promise<void>;
  openLead(contact: LeadContact): Promise<string | undefined>;
  enqueue(event: VisitEvent): Promise<string>;
  lockAgentSchedule(agentId: string): Promise<void>;
  findAssignedVisit(id: string, agentId: string): Promise<Visit | undefined>;
  findParticipantVisit(
    id: string,
    principal: VisitPrincipal,
  ): Promise<Visit | undefined>;
  findPolicyVisit(
    id: string,
    source: PropertyPolicySource,
  ): Promise<Visit | undefined>;
  saveCancellation(
    id: string,
    actor: VisitCancellationActor,
    reason: string | null,
    now: Date,
  ): Promise<void>;
  saveSchedule(id: string, slot: VisitSlot, now: Date): Promise<void>;
  saveRejection(
    id: string,
    actor: VisitRejectionActor,
    reason: string,
    now: Date,
  ): Promise<void>;
  saveCompletion(id: string, completedAt: Date): Promise<void>;
  saveRequest(
    key: RequestKey,
    hash: string,
    response: VisitCreation,
    status: 200 | 201,
    location?: string,
  ): Promise<void>;
}

export interface VisitRepository {
  transaction<T>(
    work: (transaction: VisitTransaction) => Promise<T>,
  ): Promise<T>;
  listPolicyVisitIds(
    source: PropertyPolicySource,
    status: 'REQUESTED' | 'SCHEDULED',
    after?: string,
  ): Promise<string[]>;
  listAgentLeads(
    agentId: string,
    filter: LeadListFilter,
  ): Promise<Page<LeadSummary>>;
  findLeadFollowUp(
    leadId: string,
    followUpId: string,
    agentId: string,
  ): Promise<LeadFollowUpDetails | undefined>;
  listAgentInquiries(
    agentId: string,
    filter: PageFilter,
  ): Promise<Page<AgentInquirySummary>>;
  listVisits(
    owner: { id: string; role: 'AGENT' | 'CLIENT' },
    filter: VisitListFilter,
  ): Promise<Page<VisitDetails>>;
  findVisibleInquiry(
    id: string,
    principal: VisitPrincipal,
  ): Promise<InquiryDetails | undefined>;
  findVisible(
    id: string,
    principal: VisitPrincipal,
  ): Promise<VisitDetails | undefined>;
}
