import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash, randomUUID } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitCreation,
  type VisitRepository,
} from '../domain/visit.repository.js';
import { InvalidProposedVisitDateError, Visit } from '../domain/visit.js';

export type VisitRequestInput = {
  propertyId: string;
  proposedAt: string;
  clientNote?: string;
};

export class RequestVisitCommand extends Command<VisitCreation> {
  constructor(
    readonly clientId: string,
    readonly idempotencyKey: string,
    readonly input: VisitRequestInput,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(RequestVisitCommand)
export class RequestVisitHandler implements ICommandHandler<RequestVisitCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: RequestVisitCommand): Promise<VisitCreation> {
    const { propertyId, proposedAt, clientNote } = command.input;
    const hash = createHash('sha256')
      .update(JSON.stringify({ propertyId, proposedAt, clientNote }))
      .digest('hex');
    const key = {
      actorId: command.clientId,
      key: command.idempotencyKey,
      operation: 'request-visit',
    } as const;

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<VisitCreation>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const property = await transaction.findProperty(propertyId);
      if (!property) throw new VisitProblem('PROPERTY_NOT_FOUND');
      if (property.status !== 'PUBLISHED')
        throw new VisitProblem('PROPERTY_UNAVAILABLE');

      let visit: Visit;
      try {
        visit = Visit.request({
          id: randomUUID(),
          propertyId: property.id,
          clientId: command.clientId,
          agentId: property.agentId,
          proposedAt: new Date(proposedAt),
          requestedAt: new Date(),
        });
      } catch (error) {
        if (error instanceof InvalidProposedVisitDateError) {
          throw new VisitProblem('VISIT_INVALID_PROPOSED_DATE');
        }
        throw error;
      }
      await transaction.saveVisit(visit, clientNote);

      const { id, agentId, clientId, requestedAt } = visit;
      const participants = { propertyId: visit.propertyId, clientId, agentId };
      const visitEventId = await transaction.enqueue({
        type: 'VisitRequested',
        aggregateId: id,
        occurredAt: requestedAt,
        correlationId: command.correlationId,
        payload: {
          ...participants,
          visitId: id,
          proposedAt: visit.proposedAt.toISOString(),
        },
      });
      const leadId = await transaction.openLead(visit);
      if (leadId) {
        await transaction.enqueue({
          type: 'LeadOpened',
          aggregateId: leadId,
          occurredAt: requestedAt,
          correlationId: command.correlationId,
          causationId: visitEventId,
          payload: { ...participants, leadId },
        });
      }
      const response = { id };
      await transaction.saveRequest(key, hash, response, 201);
      return response;
    });
  }
}
