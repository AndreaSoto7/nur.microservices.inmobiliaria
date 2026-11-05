import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { VisitDatabase } from '../../database/visit-database.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import type {
  RequestKey,
  VisitCreation,
  VisitDetails,
  VisitEvent,
  VisitPrincipal,
  VisitRepository,
  VisitTransaction,
} from '../domain/visit.repository.js';
import type { Visit } from '../domain/visit.js';

const operation = 'request-visit';

@Injectable()
export class PostgresVisits implements VisitRepository {
  constructor(private readonly database: VisitDatabase) {}

  async transaction<T>(
    work: (transaction: VisitTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.database.connect();
    try {
      return await database.transaction((manager) =>
        work(new PostgresVisitTransaction(manager)),
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const cause = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          cause.code === '23505' &&
          cause.constraint === 'visits_one_pending_uq'
        ) {
          throw new VisitProblem('VISIT_ALREADY_REQUESTED');
        }
      }
      throw error;
    }
  }

  async findVisible(
    id: string,
    principal: VisitPrincipal,
  ): Promise<VisitDetails | undefined> {
    const database = await this.database.connect();
    const [visit] = await database.query<VisitDetails[]>(
      `SELECT id, property_id AS "propertyId", status,
              proposed_at AS "proposedAt", requested_at AS "requestedAt"
         FROM visits WHERE id = $1
           AND (($3 AND client_id = $2) OR ($4 AND agent_id = $2))`,
      [
        id,
        principal.id,
        principal.roles.includes('CLIENT'),
        principal.roles.includes('AGENT'),
      ],
    );
    return visit;
  }
}

class PostgresVisitTransaction implements VisitTransaction {
  constructor(private readonly manager: EntityManager) {}

  async lockRequest(key: RequestKey): Promise<void> {
    // Serialize replays before checking the record, including when it does not exist yet.
    await this.manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`${key.clientId}:${operation}:${key.key}`],
    );
  }

  async findRequest(key: RequestKey) {
    const [record] = await this.manager.query<
      { hash: string; response: VisitCreation }[]
    >(
      `SELECT request_hash AS hash, response_body AS response FROM idempotency_records
        WHERE client_id = $1 AND operation = $2 AND idempotency_key = $3
          AND expires_at > clock_timestamp()`,
      [key.clientId, operation, key.key],
    );
    return record;
  }

  async findProperty(id: string) {
    const [property] = await this.manager.query<
      { id: string; agentId: string; status: string }[]
    >(
      `SELECT property_id AS id, agent_id AS "agentId", status
         FROM property_snapshots WHERE property_id = $1 FOR SHARE`,
      [id],
    );
    return property;
  }

  async saveVisit(visit: Visit, note: string | undefined): Promise<void> {
    await this.manager.query(
      `INSERT INTO visits
        (id, property_id, client_id, agent_id, status, proposed_at, client_note, requested_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [
        visit.id,
        visit.propertyId,
        visit.clientId,
        visit.agentId,
        visit.status,
        visit.proposedAt,
        note ?? null,
        visit.requestedAt,
      ],
    );
  }

  async openLead(visit: Visit): Promise<string | undefined> {
    const [lead] = await this.manager.query<{ id: string }[]>(
      `INSERT INTO leads (id, property_id, client_id, agent_id, status, opened_at)
       VALUES ($1,$2,$3,$4,'OPEN',$5)
       ON CONFLICT (client_id, property_id) WHERE status = 'OPEN' DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        visit.propertyId,
        visit.clientId,
        visit.agentId,
        visit.requestedAt,
      ],
    );
    return lead?.id;
  }

  async enqueue(event: VisitEvent): Promise<string> {
    const eventId = randomUUID();
    const isVisit = event.type === 'VisitRequested';
    const envelope = {
      eventId,
      eventType: event.type,
      eventVersion: 1,
      occurredAt: event.occurredAt.toISOString(),
      producer: 'visit-service',
      aggregateType: isVisit ? 'Visit' : 'Lead',
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload,
    };
    await this.manager.query(
      'INSERT INTO outbox (id, topic, aggregate_id, envelope) VALUES ($1,$2,$3,$4)',
      [
        eventId,
        isVisit ? 'visit.visit.events' : 'visit.lead.events',
        event.aggregateId,
        envelope,
      ],
    );
    return eventId;
  }

  async saveRequest(
    key: RequestKey,
    hash: string,
    response: VisitCreation,
  ): Promise<void> {
    await this.manager.query(
      `INSERT INTO idempotency_records
         (client_id, operation, idempotency_key, request_hash, response_status, response_body,
          response_headers, expires_at)
       VALUES ($1,$2,$3,$4,201,$5,$6,clock_timestamp() + interval '24 hours')
       ON CONFLICT (client_id, operation, idempotency_key) DO UPDATE
       SET request_hash = EXCLUDED.request_hash, response_status = EXCLUDED.response_status,
           response_body = EXCLUDED.response_body, response_headers = EXCLUDED.response_headers,
           expires_at = EXCLUDED.expires_at`,
      [
        key.clientId,
        operation,
        key.key,
        hash,
        response,
        { Location: '/api/v1/visits/' + response.id },
      ],
    );
  }
}
