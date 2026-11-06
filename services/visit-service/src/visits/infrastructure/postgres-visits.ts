import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { VisitDatabase } from '../../database/visit-database.js';
import type {
  AgentInquirySummary,
  Inquiry,
  InquiryDetails,
} from '../../inquiries/domain/inquiry.js';
import {
  Lead,
  type LeadClosure,
  type LeadFollowUp,
  type LeadFollowUpDetails,
  type LeadStatus,
  type LeadSummary,
} from '../../leads/domain/lead.js';
import type { Page, PageFilter } from '../../shared/page.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import type {
  LeadContact,
  LeadListFilter,
  PropertyPolicySource,
  RequestKey,
  VisitCancellationActor,
  VisitCreation,
  VisitDetails,
  VisitEvent,
  VisitListFilter,
  VisitPrincipal,
  VisitRejectionActor,
  VisitRepository,
  VisitTransaction,
} from '../domain/visit.repository.js';
import { Visit, type VisitSlot, type VisitState } from '../domain/visit.js';

type VisitRow = Omit<
  VisitDetails,
  'scheduledStart' | 'scheduledEnd' | 'resolutionReason' | 'completedAt'
> & {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  resolutionReason: string | null;
  completedAt: Date | null;
};

const visitColumns = `id, property_id AS "propertyId", status,
  proposed_at AS "proposedAt", requested_at AS "requestedAt",
  scheduled_start AS "scheduledStart", scheduled_end AS "scheduledEnd",
  CASE WHEN status = 'COMPLETED' THEN resolved_at END AS "completedAt",
  CASE WHEN status IN ('REJECTED', 'CANCELLED') THEN resolution_reason END AS "resolutionReason"`;

function visitDetails(row: VisitRow): VisitDetails {
  const {
    scheduledStart,
    scheduledEnd,
    resolutionReason,
    completedAt,
    ...details
  } = row;
  return {
    ...details,
    ...(scheduledStart && scheduledEnd ? { scheduledStart, scheduledEnd } : {}),
    ...(resolutionReason !== null ? { resolutionReason } : {}),
    ...(completedAt ? { completedAt } : {}),
  };
}

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
        if (
          cause.code === '23P01' &&
          cause.constraint === 'visits_agent_no_overlap'
        ) {
          throw new VisitProblem('VISIT_SCHEDULE_CONFLICT');
        }
      }
      throw error;
    }
  }

  async listPolicyVisitIds(
    source: PropertyPolicySource,
    status: 'REQUESTED' | 'SCHEDULED',
    after?: string,
  ): Promise<string[]> {
    const database = await this.database.connect();
    const rows = await database.query<{ id: string }[]>(
      `SELECT v.id FROM visits v JOIN property_snapshots p ON p.property_id = v.property_id
        WHERE v.property_id = $1 AND v.status = $2
          AND ($2 <> 'SCHEDULED' OR v.scheduled_start > clock_timestamp())
          AND ($3::uuid IS NULL OR v.id > $3)
          AND p.status = $4 AND p.last_event_at = $5
        ORDER BY v.id LIMIT 100`,
      [
        source.propertyId,
        status,
        after ?? null,
        source.status,
        source.occurredAt,
      ],
    );
    return rows.map(({ id }) => id);
  }

  async listAgentLeads(
    agentId: string,
    filter: LeadListFilter,
  ): Promise<Page<LeadSummary>> {
    type LeadRow = Omit<LeadSummary, 'closedAt' | 'outcome'> & {
      closedAt: Date | null;
      outcome: 'WON' | 'LOST' | null;
    };
    const { data, page } = await this.readPage<LeadRow>(
      'id, property_id AS "propertyId", client_id AS "clientId", status, opened_at AS "openedAt", closed_at AS "closedAt", outcome',
      `FROM leads WHERE agent_id = $1 AND ($2::uuid IS NULL OR property_id = $2)
        AND ($3::varchar IS NULL OR status = $3)`,
      'opened_at',
      [agentId, filter.propertyId ?? null, filter.status ?? null],
      filter,
    );
    return {
      data: data.map(({ closedAt, outcome, ...lead }) => ({
        ...lead,
        ...(closedAt && outcome ? { closedAt, outcome } : {}),
      })),
      page,
    };
  }

  async findLeadFollowUp(
    leadId: string,
    followUpId: string,
    agentId: string,
  ): Promise<LeadFollowUpDetails | undefined> {
    const database = await this.database.connect();
    const [followUp] = await database.query<LeadFollowUpDetails[]>(
      `SELECT f.id, f.lead_id AS "leadId", f.note, f.created_at AS "createdAt"
        FROM lead_follow_ups f JOIN leads l ON l.id = f.lead_id
        WHERE f.lead_id = $1 AND f.id = $2 AND l.agent_id = $3`,
      [leadId, followUpId, agentId],
    );
    return followUp;
  }

  listAgentInquiries(
    agentId: string,
    filter: PageFilter,
  ): Promise<Page<AgentInquirySummary>> {
    return this.readPage<AgentInquirySummary>(
      'id, property_id AS "propertyId", contact_name AS "contactName", created_at AS "createdAt"',
      'FROM inquiries WHERE agent_id = $1 AND ($2::uuid IS NULL OR property_id = $2)',
      'created_at',
      [agentId, filter.propertyId ?? null],
      filter,
    );
  }

  async listVisits(
    owner: { id: string; role: 'AGENT' | 'CLIENT' },
    filter: VisitListFilter,
  ): Promise<Page<VisitDetails>> {
    const ownerColumn = owner.role === 'AGENT' ? 'agent_id' : 'client_id';
    const { data, page } = await this.readPage<VisitRow>(
      visitColumns,
      `FROM visits WHERE ${ownerColumn} = $1
        AND ($2::uuid IS NULL OR property_id = $2)
        AND ($3::varchar IS NULL OR status = $3)`,
      'requested_at',
      [owner.id, filter.propertyId ?? null, filter.status ?? null],
      filter,
    );
    return { data: data.map(visitDetails), page };
  }

  private async readPage<T>(
    columns: string,
    from: string,
    orderColumn: 'created_at' | 'requested_at' | 'opened_at',
    parameters: (string | null)[],
    filter: PageFilter,
  ): Promise<Page<T>> {
    const database = await this.database.connect();
    const order = filter.sort === 'asc' ? 'ASC' : 'DESC';
    const { page: number, size } = filter;
    // The count and page use the same snapshot, even if new rows arrive between reads.
    return database.transaction('REPEATABLE READ', async (manager) => {
      const [{ total }] = await manager.query<{ total: string }[]>(
        `SELECT count(*) AS total ${from}`,
        parameters,
      );
      const totalElements = Number(total);
      const offset = (number - 1) * size;
      const data =
        offset >= totalElements
          ? []
          : await manager.query<T[]>(
              `SELECT ${columns} ${from} ORDER BY ${orderColumn} ${order}, id ${order}
          LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
              [...parameters, size, offset],
            );
      return {
        data,
        page: {
          number,
          size,
          totalElements,
          totalPages: Math.ceil(totalElements / size),
        },
      };
    });
  }

  async findVisibleInquiry(
    id: string,
    principal: VisitPrincipal,
  ): Promise<InquiryDetails | undefined> {
    const database = await this.database.connect();
    const [inquiry] = await database.query<
      (Omit<InquiryDetails, 'contactPhone'> & { contactPhone: string | null })[]
    >(
      `SELECT id, property_id AS "propertyId", contact_name AS "contactName",
              contact_email AS "contactEmail", contact_phone AS "contactPhone", message,
              created_at AS "createdAt"
         FROM inquiries WHERE id = $1
           AND (($3 AND client_id = $2) OR ($4 AND agent_id = $2))`,
      [
        id,
        principal.id,
        principal.roles.includes('CLIENT'),
        principal.roles.includes('AGENT'),
      ],
    );
    if (!inquiry) return;
    const { contactPhone, ...details } = inquiry;
    return contactPhone === null ? details : { ...details, contactPhone };
  }

  async findVisible(
    id: string,
    principal: VisitPrincipal,
  ): Promise<VisitDetails | undefined> {
    const database = await this.database.connect();
    const [visit] = await database.query<VisitRow[]>(
      `SELECT ${visitColumns} FROM visits WHERE id = $1
         AND (($3 AND client_id = $2) OR ($4 AND agent_id = $2))`,
      [
        id,
        principal.id,
        principal.roles.includes('CLIENT'),
        principal.roles.includes('AGENT'),
      ],
    );
    return visit ? visitDetails(visit) : undefined;
  }
}

class PostgresVisitTransaction implements VisitTransaction {
  constructor(private readonly manager: EntityManager) {}

  async lockRequest(key: RequestKey): Promise<void> {
    // Serialize replays before checking the record, including when it does not exist yet.
    await this.manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`${key.actorId}:${key.operation}:${key.key}`],
    );
  }

  async findRequest<T extends VisitCreation>(key: RequestKey) {
    const [record] = await this.manager.query<{ hash: string; response: T }[]>(
      `SELECT request_hash AS hash, response_body AS response FROM idempotency_records
        WHERE client_id = $1 AND operation = $2 AND idempotency_key = $3
          AND expires_at > clock_timestamp()`,
      [key.actorId, key.operation, key.key],
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

  async saveInquiry(inquiry: Inquiry): Promise<void> {
    await this.manager.query(
      `INSERT INTO inquiries
        (id, property_id, client_id, agent_id, contact_name, contact_email, contact_phone, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        inquiry.id,
        inquiry.propertyId,
        inquiry.clientId,
        inquiry.agentId,
        inquiry.contactName,
        inquiry.contactEmail,
        inquiry.contactPhone ?? null,
        inquiry.message,
        inquiry.createdAt,
      ],
    );
  }

  async findAssignedLead(
    id: string,
    agentId: string,
  ): Promise<Lead | undefined> {
    const [row] = await this.manager.query<
      { id: string; propertyId: string; clientId: string; status: LeadStatus }[]
    >(
      `SELECT id, property_id AS "propertyId", client_id AS "clientId", status
        FROM leads WHERE id = $1 AND agent_id = $2 FOR UPDATE`,
      [id, agentId],
    );
    return row
      ? new Lead(row.id, row.propertyId, row.clientId, agentId, row.status)
      : undefined;
  }

  async saveLeadClosure(id: string, closure: LeadClosure): Promise<void> {
    await this.manager.query(
      `UPDATE leads SET status = 'CLOSED', outcome = $2, close_note = $3,
        closed_at = $4, version = version + 1 WHERE id = $1`,
      [id, closure.outcome, closure.note ?? null, closure.closedAt],
    );
  }

  async saveLeadFollowUp(followUp: LeadFollowUp): Promise<void> {
    await this.manager.query(
      `INSERT INTO lead_follow_ups (id, lead_id, agent_id, note, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [
        followUp.id,
        followUp.leadId,
        followUp.agentId,
        followUp.note,
        followUp.createdAt,
      ],
    );
    await this.manager.query(
      'UPDATE leads SET version = version + 1 WHERE id = $1',
      [followUp.leadId],
    );
  }

  async openLead(contact: LeadContact): Promise<string | undefined> {
    const [lead] = await this.manager.query<{ id: string }[]>(
      `INSERT INTO leads (id, property_id, client_id, agent_id, status, opened_at)
       VALUES ($1,$2,$3,$4,'OPEN',$5)
       ON CONFLICT (client_id, property_id) WHERE status = 'OPEN' DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        contact.propertyId,
        contact.clientId,
        contact.agentId,
        contact.openedAt,
      ],
    );
    return lead?.id;
  }

  async enqueue(event: VisitEvent): Promise<string> {
    const eventId = randomUUID();
    const aggregateType =
      event.type === 'LeadOpened' ||
      event.type === 'LeadFollowUpRegistered' ||
      event.type === 'LeadClosed'
        ? 'Lead'
        : event.type === 'InquiryReceived'
          ? 'Inquiry'
          : 'Visit';
    const topic = 'visit.' + aggregateType.toLowerCase() + '.events';
    const envelope = {
      eventId,
      eventType: event.type,
      eventVersion: 1,
      occurredAt: event.occurredAt.toISOString(),
      producer: 'visit-service',
      aggregateType,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload,
    };
    await this.manager.query(
      'INSERT INTO outbox (id, topic, aggregate_id, envelope) VALUES ($1,$2,$3,$4)',
      [eventId, topic, event.aggregateId, envelope],
    );
    return eventId;
  }

  async lockAgentSchedule(agentId: string): Promise<void> {
    await this.manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      ['visit-agent-schedule:' + agentId],
    );
  }

  findAssignedVisit(id: string, agentId: string): Promise<Visit | undefined> {
    return this.findParticipantVisit(id, { id: agentId, roles: ['AGENT'] });
  }

  async findParticipantVisit(
    id: string,
    principal: VisitPrincipal,
  ): Promise<Visit | undefined> {
    const [row] = await this.manager.query<VisitState[]>(
      `SELECT id, property_id AS "propertyId", client_id AS "clientId", agent_id AS "agentId",
              status, proposed_at AS "proposedAt", requested_at AS "requestedAt",
              scheduled_start AS "scheduledStart", scheduled_end AS "scheduledEnd"
         FROM visits WHERE id = $1
           AND (($3 AND client_id = $2) OR ($4 AND agent_id = $2)) FOR UPDATE`,
      [
        id,
        principal.id,
        principal.roles.includes('CLIENT'),
        principal.roles.includes('AGENT'),
      ],
    );
    return row ? Visit.restore(row) : undefined;
  }

  async findPolicyVisit(
    id: string,
    source: PropertyPolicySource,
  ): Promise<Visit | undefined> {
    const [snapshot] = await this.manager.query<{ property_id: string }[]>(
      `SELECT property_id FROM property_snapshots
        WHERE property_id = $1 AND status = $2 AND last_event_at = $3 FOR SHARE`,
      [source.propertyId, source.status, source.occurredAt],
    );
    if (!snapshot) return;
    const [row] = await this.manager.query<VisitState[]>(
      `SELECT id, property_id AS "propertyId", client_id AS "clientId", agent_id AS "agentId",
              status, proposed_at AS "proposedAt", requested_at AS "requestedAt",
              scheduled_start AS "scheduledStart", scheduled_end AS "scheduledEnd"
        FROM visits WHERE id = $1 AND property_id = $2 FOR UPDATE`,
      [id, source.propertyId],
    );
    return row ? Visit.restore(row) : undefined;
  }

  async saveSchedule(id: string, slot: VisitSlot, now: Date): Promise<void> {
    await this.manager.query(
      `UPDATE visits SET status = 'SCHEDULED', scheduled_start = $2, scheduled_end = $3,
          updated_at = $4, version = version + 1 WHERE id = $1`,
      [id, slot.start, slot.end, now],
    );
  }

  async saveRejection(
    id: string,
    actor: VisitRejectionActor,
    reason: string,
    now: Date,
  ): Promise<void> {
    await this.manager.query(
      `UPDATE visits SET status = 'REJECTED', resolution_reason = $2, resolved_by = $3,
          resolved_at = $4, updated_at = $4, version = version + 1 WHERE id = $1`,
      [id, reason, actor, now],
    );
  }

  async saveCancellation(
    id: string,
    actor: VisitCancellationActor,
    reason: string | null,
    now: Date,
  ): Promise<void> {
    await this.manager.query(
      `UPDATE visits SET status = 'CANCELLED', resolution_reason = $2, resolved_by = $3,
          resolved_at = $4, updated_at = $4, version = version + 1 WHERE id = $1`,
      [id, reason, actor, now],
    );
  }

  async saveCompletion(id: string, completedAt: Date): Promise<void> {
    await this.manager.query(
      `UPDATE visits SET status = 'COMPLETED', resolved_by = 'AGENT',
          resolved_at = $2, updated_at = $2, version = version + 1 WHERE id = $1`,
      [id, completedAt],
    );
  }

  async saveRequest(
    key: RequestKey,
    hash: string,
    response: VisitCreation,
    status: 200 | 201,
    location?: string,
  ): Promise<void> {
    await this.manager.query(
      `INSERT INTO idempotency_records
         (client_id, operation, idempotency_key, request_hash, response_status, response_body,
          response_headers, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,clock_timestamp() + interval '24 hours')
       ON CONFLICT (client_id, operation, idempotency_key) DO UPDATE
       SET request_hash = EXCLUDED.request_hash, response_status = EXCLUDED.response_status,
           response_body = EXCLUDED.response_body, response_headers = EXCLUDED.response_headers,
           expires_at = EXCLUDED.expires_at`,
      [
        key.actorId,
        key.operation,
        key.key,
        hash,
        status,
        response,
        status === 201
          ? {
              Location:
                location ??
                '/api/v1/' +
                  (key.operation === 'send-inquiry'
                    ? 'inquiries/'
                    : 'visits/') +
                  response.id,
            }
          : {},
      ],
    );
  }
}
