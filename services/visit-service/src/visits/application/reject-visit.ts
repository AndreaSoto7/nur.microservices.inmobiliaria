import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type RejectedVisit,
  type PropertyPolicySource,
  type RequestKey,
  type VisitRepository,
  type VisitPrincipal,
} from '../domain/visit.repository.js';
import {
  InvalidVisitResolutionReasonError,
  VisitNotRequestedError,
} from '../domain/visit.js';

export class RejectVisitCommand extends Command<RejectedVisit | undefined> {
  constructor(
    readonly visitId: string,
    readonly source:
      | PropertyPolicySource
      | {
          actor: 'USER';
          principal: VisitPrincipal;
          idempotencyKey: string;
        },
    readonly reason: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(RejectVisitCommand)
export class RejectVisitHandler implements ICommandHandler<RejectVisitCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(
    command: RejectVisitCommand,
  ): Promise<RejectedVisit | undefined> {
    const { source } = command;
    const idempotency =
      source.actor === 'USER'
        ? {
            key: {
              actorId: source.principal.id,
              key: source.idempotencyKey,
              operation: 'reject-visit',
            } satisfies RequestKey,
            hash: createHash('sha256')
              .update(
                JSON.stringify({
                  visitId: command.visitId,
                  reason: command.reason,
                }),
              )
              .digest('hex'),
          }
        : undefined;

    return this.visits.transaction(async (transaction) => {
      if (idempotency) await transaction.lockRequest(idempotency.key);
      const visit =
        source.actor === 'SYSTEM'
          ? await transaction.findPolicyVisit(command.visitId, source)
          : await transaction.findAssignedVisit(
              command.visitId,
              source.principal.id,
            );
      if (!visit) {
        if (source.actor === 'SYSTEM') return;
        throw new VisitProblem('VISIT_NOT_FOUND');
      }
      if (idempotency) {
        const previous = await transaction.findRequest<RejectedVisit>(
          idempotency.key,
        );
        if (previous) {
          if (previous.hash !== idempotency.hash)
            throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
          return previous.response;
        }
      }

      let reason: string;
      try {
        reason = visit.reject(command.reason);
      } catch (error) {
        if (error instanceof VisitNotRequestedError)
          throw new VisitProblem('VISIT_NOT_REQUESTED');
        if (error instanceof InvalidVisitResolutionReasonError)
          throw new VisitProblem('VALIDATION_ERROR');
        throw error;
      }

      const { id, propertyId, clientId, agentId } = visit;
      const now = new Date();
      const actor = source.actor === 'SYSTEM' ? 'SYSTEM' : 'AGENT';
      await transaction.saveRejection(id, actor, reason, now);
      await transaction.enqueue({
        type: 'VisitRejected',
        aggregateId: id,
        occurredAt: now,
        correlationId: command.correlationId,
        causationId: source.actor === 'SYSTEM' ? source.eventId : undefined,
        payload: {
          visitId: id,
          propertyId,
          clientId,
          agentId,
          actor,
          reason,
        },
      });
      const result: RejectedVisit = { id, status: 'REJECTED' };
      if (idempotency)
        await transaction.saveRequest(
          idempotency.key,
          idempotency.hash,
          result,
          200,
        );
      return result;
    });
  }
}
