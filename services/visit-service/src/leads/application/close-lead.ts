import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import {
  InvalidLeadNoteError,
  InvalidLeadOutcomeError,
  LeadNotOpenError,
  type LeadClosure,
  type LeadOutcome,
} from '../domain/lead.js';

type ClosedLead = { id: string; status: 'CLOSED'; outcome: LeadOutcome };

export class CloseLeadCommand extends Command<ClosedLead> {
  constructor(
    readonly leadId: string,
    readonly agentId: string,
    readonly idempotencyKey: string,
    readonly outcome: LeadOutcome,
    readonly note: string | undefined,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(CloseLeadCommand)
export class CloseLeadHandler implements ICommandHandler<CloseLeadCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: CloseLeadCommand): Promise<ClosedLead> {
    const key = {
      actorId: command.agentId,
      key: command.idempotencyKey,
      operation: 'close-lead',
    } as const;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          leadId: command.leadId,
          outcome: command.outcome,
          note: command.note,
        }),
      )
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const lead = await transaction.findAssignedLead(
        command.leadId,
        command.agentId,
      );
      if (!lead) throw new VisitProblem('LEAD_NOT_FOUND');

      const previous = await transaction.findRequest<ClosedLead>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      let closure: LeadClosure;
      try {
        closure = lead.close(command.outcome, new Date(), command.note);
      } catch (error) {
        if (error instanceof LeadNotOpenError)
          throw new VisitProblem('LEAD_NOT_OPEN');
        if (
          error instanceof InvalidLeadNoteError ||
          error instanceof InvalidLeadOutcomeError
        ) {
          throw new VisitProblem('VALIDATION_ERROR');
        }
        throw error;
      }

      const { id, propertyId, agentId, clientId } = lead;
      const { outcome, closedAt } = closure;
      await transaction.saveLeadClosure(id, closure);
      await transaction.enqueue({
        type: 'LeadClosed',
        aggregateId: id,
        occurredAt: closedAt,
        correlationId: command.correlationId,
        payload: { leadId: id, propertyId, agentId, clientId, outcome },
      });
      const result: ClosedLead = { id, status: 'CLOSED', outcome };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
