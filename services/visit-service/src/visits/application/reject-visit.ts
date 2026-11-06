import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type RejectedVisit,
  type RequestKey,
  type VisitRepository,
} from '../domain/visit.repository.js';
import {
  InvalidVisitRejectionReasonError,
  VisitNotRequestedError,
} from '../domain/visit.js';

export class RejectVisitCommand extends Command<RejectedVisit> {
  constructor(
    readonly visitId: string,
    readonly agentId: string,
    readonly idempotencyKey: string,
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

  async execute(command: RejectVisitCommand): Promise<RejectedVisit> {
    const key: RequestKey = {
      actorId: command.agentId,
      key: command.idempotencyKey,
      operation: 'reject-visit',
    };
    const hash = createHash('sha256')
      .update(
        JSON.stringify({ visitId: command.visitId, reason: command.reason }),
      )
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<RejectedVisit>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const visit = await transaction.findAssignedVisit(
        command.visitId,
        command.agentId,
      );
      if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');
      let reason: string;
      try {
        reason = visit.reject(command.reason);
      } catch (error) {
        if (error instanceof VisitNotRequestedError)
          throw new VisitProblem('VISIT_NOT_REQUESTED');
        if (error instanceof InvalidVisitRejectionReasonError)
          throw new VisitProblem('VALIDATION_ERROR');
        throw error;
      }

      const { id, propertyId, clientId, agentId } = visit;
      const now = new Date();
      await transaction.saveRejection(id, reason, now);
      await transaction.enqueue({
        type: 'VisitRejected',
        aggregateId: id,
        occurredAt: now,
        correlationId: command.correlationId,
        payload: {
          visitId: id,
          propertyId,
          clientId,
          agentId,
          actor: 'AGENT',
          reason,
        },
      });
      const result: RejectedVisit = { id, status: 'REJECTED' };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
