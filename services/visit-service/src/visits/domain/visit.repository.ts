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
export type VisitCancellationActor = 'CLIENT' | 'AGENT';
export type RequestKey = {
  actorId: string;
  key: string;
  operation:
    'request-visit' | 'schedule-visit' | 'reject-visit' | 'cancel-visit';
};

export type VisitEvent = {
  type:
    | 'VisitRequested'
    | 'VisitScheduled'
    | 'VisitRejected'
    | 'VisitCancelled'
    | 'LeadOpened';
  aggregateId: string;
  occurredAt: Date;
  correlationId: string;
  causationId?: string;
  payload: Record<string, string | null>;
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
  openLead(visit: Visit): Promise<string | undefined>;
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
  findVisible(
    id: string,
    principal: VisitPrincipal,
  ): Promise<VisitDetails | undefined>;
}
