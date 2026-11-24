import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type RequestKey,
  type VisitPrincipal,
  type VisitRepository,
} from '../domain/visit.repository.js';
import {
  InvalidProposedVisitDateError,
  VisitNotRequestedError,
  type VisitProposer,
} from '../domain/visit.js';

export type ProposedVisit = {
  id: string;
  status: 'REQUESTED';
  proposedAt: string;
  proposedBy: VisitProposer;
};

export class ProposeVisitTimeCommand extends Command<ProposedVisit> {
  constructor(
    readonly visitId: string,
    readonly principal: VisitPrincipal,
    readonly idempotencyKey: string,
    readonly proposedAt: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

/**
 * El agente asignado o el cliente proponen otro horario para una visita pendiente. Si lo propone el agente,
 * no puede chocar con sus visitas programadas. Publica VisitTimeProposed para avisarle a la otra parte.
 */
@CommandHandler(ProposeVisitTimeCommand)
export class ProposeVisitTimeHandler implements ICommandHandler<ProposeVisitTimeCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: ProposeVisitTimeCommand): Promise<ProposedVisit> {
    const key: RequestKey = {
      actorId: command.principal.id,
      key: command.idempotencyKey,
      operation: 'propose-visit-time',
    };
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          visitId: command.visitId,
          proposedAt: command.proposedAt,
        }),
      )
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<ProposedVisit>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const agentId = await transaction.findVisitAgentId(command.visitId);
      if (agentId) await transaction.lockAgentSchedule(agentId);
      const visit = await transaction.findParticipantVisit(
        command.visitId,
        command.principal,
      );
      if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');
      const by: VisitProposer =
        visit.agentId === command.principal.id ? 'AGENT' : 'CLIENT';

      const now = new Date();
      try {
        visit.proposeTime(by, new Date(command.proposedAt), now);
      } catch (error) {
        if (error instanceof VisitNotRequestedError)
          throw new VisitProblem('VISIT_NOT_REQUESTED');
        if (error instanceof InvalidProposedVisitDateError)
          throw new VisitProblem('VISIT_INVALID_PROPOSED_DATE');
        throw error;
      }
      if (
        by === 'AGENT' &&
        (await transaction.agentIsBusy(visit.agentId, visit.proposedSlot))
      ) {
        throw new VisitProblem('VISIT_SCHEDULE_CONFLICT');
      }

      await transaction.saveProposal(visit.id, visit.proposedAt, by, now);
      const { id, propertyId, clientId } = visit;
      const proposedAt = visit.proposedAt.toISOString();
      await transaction.enqueue({
        type: 'VisitTimeProposed',
        aggregateId: id,
        occurredAt: now,
        correlationId: command.correlationId,
        payload: {
          visitId: id,
          propertyId,
          clientId,
          agentId: visit.agentId,
          proposedAt,
          proposedBy: by,
        },
      });
      const result: ProposedVisit = {
        id,
        status: 'REQUESTED',
        proposedAt,
        proposedBy: by,
      };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
