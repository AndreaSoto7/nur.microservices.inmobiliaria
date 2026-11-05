import type { Visit } from './visit.js';

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');

export type VisitPrincipal = { id: string; roles: readonly string[] };

export type VisitDetails = {
  id: string;
  propertyId: string;
  status: 'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  proposedAt: Date;
  requestedAt: Date;
};

export type VisitCreation = { id: string };
export type RequestKey = { clientId: string; key: string };

export type VisitEvent = {
  type: 'VisitRequested' | 'LeadOpened';
  aggregateId: string;
  occurredAt: Date;
  correlationId: string;
  causationId?: string;
  payload: Record<string, string>;
};

export interface VisitTransaction {
  lockRequest(key: RequestKey): Promise<void>;
  findRequest(
    key: RequestKey,
  ): Promise<{ hash: string; response: VisitCreation } | undefined>;
  findProperty(
    id: string,
  ): Promise<{ id: string; agentId: string; status: string } | undefined>;
  saveVisit(visit: Visit, note: string | undefined): Promise<void>;
  openLead(visit: Visit): Promise<string | undefined>;
  enqueue(event: VisitEvent): Promise<string>;
  saveRequest(
    key: RequestKey,
    hash: string,
    response: VisitCreation,
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
