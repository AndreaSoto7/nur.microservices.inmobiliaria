import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type CancelledVisit,
  type PropertyPolicySource,
  type RequestKey,
  type VisitPrincipal,
  type VisitRepository,
} from '../domain/visit.repository.js';
import {
  InvalidVisitResolutionReasonError,
  VisitCancellationTooLateError,
  VisitNotScheduledError,
} from '../domain/visit.js';

export class CancelVisitCommand extends Command<CancelledVisit | undefined> {
  constructor(
    readonly visitId: string,
    readonly source:
      | PropertyPolicySource
      | {
          actor: 'USER';
          principal: VisitPrincipal;
          idempotencyKey: string;
        },
    readonly reason: string | undefined,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(CancelVisitCommand)
export class CancelVisitHandler implements ICommandHandler<CancelVisitCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(
    command: CancelVisitCommand,
  ): Promise<CancelledVisit | undefined> {
    const { source } = command;
    const idempotency =
      source.actor === 'USER'
        ? {
            key: {
              actorId: source.principal.id,
              key: source.idempotencyKey,
              operation: 'cancel-visit',
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
          : await transaction.findParticipantVisit(
              command.visitId,
              source.principal,
            );
      if (!visit) {
        if (source.actor === 'SYSTEM') return;
        throw new VisitProblem('VISIT_NOT_FOUND');
      }
      if (idempotency) {
        const previous = await transaction.findRequest<CancelledVisit>(
          idempotency.key,
        );
        if (previous) {
          if (previous.hash !== idempotency.hash)
            throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
          return previous.response;
        }
      }

      const { id, propertyId, clientId, agentId } = visit;
      const actor =
        source.actor === 'SYSTEM'
          ? 'SYSTEM'
          : clientId === source.principal.id &&
              source.principal.roles.includes('CLIENT')
            ? 'CLIENT'
            : 'AGENT';
      const now = new Date();
      let reason: string | null;
      try {
        reason = visit.cancel(now, command.reason);
      } catch (error) {
        if (error instanceof VisitNotScheduledError)
          throw new VisitProblem('VISIT_NOT_SCHEDULED');
        if (error instanceof VisitCancellationTooLateError)
          throw new VisitProblem('VISIT_CANCELLATION_TOO_LATE');
        if (error instanceof InvalidVisitResolutionReasonError)
          throw new VisitProblem('VALIDATION_ERROR');
        throw error;
      }

      await transaction.saveCancellation(id, actor, reason, now);
      await transaction.enqueue({
        type: 'VisitCancelled',
        aggregateId: id,
        occurredAt: now,
        correlationId: command.correlationId,
        causationId: source.actor === 'SYSTEM' ? source.eventId : undefined,
        payload: { visitId: id, propertyId, clientId, agentId, actor, reason },
      });
      const result: CancelledVisit = { id, status: 'CANCELLED' };
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
