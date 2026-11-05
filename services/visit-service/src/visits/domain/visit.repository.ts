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
};

export type VisitCreation = { id: string };
export type ScheduledVisit = {
  id: string;
  status: 'SCHEDULED';
  scheduledStart: string;
  scheduledEnd: string;
};
export type RequestKey = {
  actorId: string;
  key: string;
  operation: 'request-visit' | 'schedule-visit';
};

export type VisitEvent = {
  type: 'VisitRequested' | 'VisitScheduled' | 'LeadOpened';
  aggregateId: string;
  occurredAt: Date;
  correlationId: string;
  causationId?: string;
  payload: Record<string, string>;
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
  saveSchedule(id: string, slot: VisitSlot, now: Date): Promise<void>;
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
