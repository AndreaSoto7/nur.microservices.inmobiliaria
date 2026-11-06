import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type RequestKey,
  type ScheduledVisit,
  type VisitRepository,
} from '../domain/visit.repository.js';
import {
  InvalidVisitScheduleError,
  VisitNotRequestedError,
} from '../domain/visit.js';

export class ScheduleVisitCommand extends Command<ScheduledVisit> {
  constructor(
    readonly visitId: string,
    readonly agentId: string,
    readonly idempotencyKey: string,
    readonly scheduledStart: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(ScheduleVisitCommand)
export class ScheduleVisitHandler implements ICommandHandler<ScheduleVisitCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: ScheduleVisitCommand): Promise<ScheduledVisit> {
    const key: RequestKey = {
      actorId: command.agentId,
      key: command.idempotencyKey,
      operation: 'schedule-visit',
    };
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          visitId: command.visitId,
          scheduledStart: command.scheduledStart,
        }),
      )
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<ScheduledVisit>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      await transaction.lockAgentSchedule(command.agentId);
      const visit = await transaction.findAssignedVisit(
        command.visitId,
        command.agentId,
      );
      if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');
      const now = new Date();
      let slot;
      try {
        slot = visit.schedule(new Date(command.scheduledStart), now);
      } catch (error) {
        if (error instanceof VisitNotRequestedError)
          throw new VisitProblem('VISIT_NOT_REQUESTED');
        if (error instanceof InvalidVisitScheduleError)
          throw new VisitProblem('VISIT_INVALID_SCHEDULE');
        throw error;
      }

      await transaction.saveSchedule(visit.id, slot, now);
      const { id, propertyId, clientId, agentId } = visit;
      const scheduledStart = slot.start.toISOString();
      const scheduledEnd = slot.end.toISOString();
      await transaction.enqueue({
        type: 'VisitScheduled',
        aggregateId: id,
        occurredAt: now,
        correlationId: command.correlationId,
        payload: {
          visitId: id,
          propertyId,
          clientId,
          agentId,
          scheduledStart,
          scheduledEnd,
        },
      });
      const result: ScheduledVisit = {
        id,
        status: 'SCHEDULED',
        scheduledStart,
        scheduledEnd,
      };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
