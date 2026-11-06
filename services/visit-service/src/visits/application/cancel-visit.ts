import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type CancelledVisit,
  type RequestKey,
  type VisitPrincipal,
  type VisitRepository,
} from '../domain/visit.repository.js';
import {
  InvalidVisitResolutionReasonError,
  VisitCancellationTooLateError,
  VisitNotScheduledError,
} from '../domain/visit.js';

export class CancelVisitCommand extends Command<CancelledVisit> {
  constructor(
    readonly visitId: string,
    readonly principal: VisitPrincipal,
    readonly idempotencyKey: string,
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

  async execute(command: CancelVisitCommand): Promise<CancelledVisit> {
    const key: RequestKey = {
      actorId: command.principal.id,
      key: command.idempotencyKey,
      operation: 'cancel-visit',
    };
    const hash = createHash('sha256')
      .update(
        JSON.stringify({ visitId: command.visitId, reason: command.reason }),
      )
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const visit = await transaction.findParticipantVisit(
        command.visitId,
        command.principal,
      );
      if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');

      const previous = await transaction.findRequest<CancelledVisit>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const { id, propertyId, clientId, agentId } = visit;
      const actor =
        clientId === command.principal.id &&
        command.principal.roles.includes('CLIENT')
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
        payload: { visitId: id, propertyId, clientId, agentId, actor, reason },
      });
      const result: CancelledVisit = { id, status: 'CANCELLED' };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
