import type {
  Inquiry,
  InquiryDetails,
} from '../../inquiries/domain/inquiry.js';
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
export type VisitCancellationActor = 'CLIENT' | 'AGENT';
export type RequestKey = {
  actorId: string;
  key: string;
  operation:
    | 'request-visit'
    | 'schedule-visit'
    | 'reject-visit'
    | 'cancel-visit'
    | 'complete-visit'
    | 'send-inquiry';
};

export type VisitEvent = {
  type:
    | 'InquiryReceived'
    | 'VisitRequested'
    | 'VisitScheduled'
    | 'VisitRejected'
    | 'VisitCancelled'
    | 'VisitCompleted'
    | 'LeadOpened';
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
  openLead(contact: LeadContact): Promise<string | undefined>;
  enqueue(event: VisitEvent): Promise<string>;
  lockAgentSchedule(agentId: string): Promise<void>;
  findAssignedVisit(id: string, agentId: string): Promise<Visit | undefined>;
  findParticipantVisit(
    id: string,
    principal: VisitPrincipal,
  ): Promise<Visit | undefined>;
  saveCancellation(
    id: string,
    actor: VisitCancellationActor,
    reason: string | null,
    now: Date,
  ): Promise<void>;
  saveSchedule(id: string, slot: VisitSlot, now: Date): Promise<void>;
  saveRejection(id: string, reason: string, now: Date): Promise<void>;
  saveCompletion(id: string, completedAt: Date): Promise<void>;
  saveRequest(
    key: RequestKey,
    hash: string,
    response: VisitCreation,
    status: 200 | 201,
  ): Promise<void>;
}

export interface VisitRepository {
  transaction<T>(
    work: (transaction: VisitTransaction) => Promise<T>,
  ): Promise<T>;
  findVisibleInquiry(
    id: string,
    principal: VisitPrincipal,
  ): Promise<InquiryDetails | undefined>;
  findVisible(
    id: string,
    principal: VisitPrincipal,
  ): Promise<VisitDetails | undefined>;
}
