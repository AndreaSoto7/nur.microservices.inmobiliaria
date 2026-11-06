import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type CompletedVisit,
  type RequestKey,
  type VisitRepository,
} from '../domain/visit.repository.js';
import {
  VisitCompletionTooEarlyError,
  VisitNotScheduledError,
} from '../domain/visit.js';

export class CompleteVisitCommand extends Command<CompletedVisit> {
  constructor(
    readonly visitId: string,
    readonly agentId: string,
    readonly idempotencyKey: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(CompleteVisitCommand)
export class CompleteVisitHandler implements ICommandHandler<CompleteVisitCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: CompleteVisitCommand): Promise<CompletedVisit> {
    const key: RequestKey = {
      actorId: command.agentId,
      key: command.idempotencyKey,
      operation: 'complete-visit',
    };
    const hash = createHash('sha256').update(command.visitId).digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const visit = await transaction.findAssignedVisit(
        command.visitId,
        command.agentId,
      );
      if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');

      const previous = await transaction.findRequest<CompletedVisit>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const completedAt = new Date();
      try {
        visit.complete(completedAt);
      } catch (error) {
        if (error instanceof VisitNotScheduledError)
          throw new VisitProblem('VISIT_NOT_SCHEDULED');
        if (error instanceof VisitCompletionTooEarlyError)
          throw new VisitProblem('VISIT_COMPLETION_TOO_EARLY');
        throw error;
      }

      const { id, propertyId, clientId, agentId } = visit;
      await transaction.saveCompletion(id, completedAt);
      await transaction.enqueue({
        type: 'VisitCompleted',
        aggregateId: id,
        occurredAt: completedAt,
        correlationId: command.correlationId,
        payload: {
          visitId: id,
          propertyId,
          clientId,
          agentId,
          completedAt: completedAt.toISOString(),
        },
      });
      const result: CompletedVisit = { id, status: 'COMPLETED' };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
