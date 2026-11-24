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
  VisitNoAgentProposalError,
  VisitNotRequestedError,
} from '../domain/visit.js';

export class AcceptVisitProposalCommand extends Command<ScheduledVisit> {
  constructor(
    readonly visitId: string,
    readonly clientId: string,
    readonly idempotencyKey: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

/**
 * El cliente acepta el horario que le propuso el agente: la visita queda programada. Publica VisitScheduled
 * con actor CLIENT, y notification le avisa al agente.
 */
@CommandHandler(AcceptVisitProposalCommand)
export class AcceptVisitProposalHandler implements ICommandHandler<AcceptVisitProposalCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: AcceptVisitProposalCommand): Promise<ScheduledVisit> {
    const key: RequestKey = {
      actorId: command.clientId,
      key: command.idempotencyKey,
      operation: 'accept-visit-proposal',
    };
    const hash = createHash('sha256')
      .update(JSON.stringify({ visitId: command.visitId }))
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<ScheduledVisit>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      // Mismo orden de bloqueo que al programar: primero la agenda del agente, después la visita.
      const agentId = await transaction.findVisitAgentId(command.visitId);
      if (agentId) await transaction.lockAgentSchedule(agentId);
      const visit = await transaction.findParticipantVisit(command.visitId, {
        id: command.clientId,
        roles: ['CLIENT'],
      });
      if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');

      const now = new Date();
      let slot;
      try {
        slot = visit.acceptProposal(now);
      } catch (error) {
        if (error instanceof VisitNotRequestedError)
          throw new VisitProblem('VISIT_NOT_REQUESTED');
        if (error instanceof VisitNoAgentProposalError)
          throw new VisitProblem('VISIT_NO_AGENT_PROPOSAL');
        if (error instanceof InvalidVisitScheduleError)
          throw new VisitProblem('VISIT_INVALID_SCHEDULE');
        throw error;
      }

      await transaction.saveSchedule(visit.id, slot, now);
      const { id, propertyId, clientId } = visit;
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
          agentId: visit.agentId,
          scheduledStart,
          scheduledEnd,
          actor: 'CLIENT',
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
