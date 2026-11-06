import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash, randomUUID } from 'node:crypto';
import { leadFollowUpLocation } from '../../shared/http-contract.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import {
  InvalidLeadFollowUpNoteError,
  LeadNotOpenError,
  type LeadFollowUp,
} from '../domain/lead.js';

export class RegisterLeadFollowUpCommand extends Command<{ id: string }> {
  constructor(
    readonly leadId: string,
    readonly agentId: string,
    readonly idempotencyKey: string,
    readonly note: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(RegisterLeadFollowUpCommand)
export class RegisterLeadFollowUpHandler implements ICommandHandler<RegisterLeadFollowUpCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: RegisterLeadFollowUpCommand): Promise<{ id: string }> {
    const key = {
      actorId: command.agentId,
      key: command.idempotencyKey,
      operation: 'register-lead-follow-up',
    } as const;
    const hash = createHash('sha256')
      .update(JSON.stringify({ leadId: command.leadId, note: command.note }))
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const lead = await transaction.findAssignedLead(
        command.leadId,
        command.agentId,
      );
      if (!lead) throw new VisitProblem('LEAD_NOT_FOUND');

      const previous = await transaction.findRequest<{ id: string }>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      let followUp: LeadFollowUp;
      try {
        followUp = lead.registerFollowUp(
          randomUUID(),
          command.note,
          new Date(),
        );
      } catch (error) {
        if (error instanceof LeadNotOpenError)
          throw new VisitProblem('LEAD_NOT_OPEN');
        if (error instanceof InvalidLeadFollowUpNoteError)
          throw new VisitProblem('VALIDATION_ERROR');
        throw error;
      }
      const { id: followUpId, createdAt } = followUp;
      const { id: leadId, propertyId, clientId, agentId } = lead;
      await transaction.saveLeadFollowUp(followUp);
      await transaction.enqueue({
        type: 'LeadFollowUpRegistered',
        aggregateId: leadId,
        occurredAt: createdAt,
        correlationId: command.correlationId,
        payload: { leadId, followUpId, propertyId, clientId, agentId },
      });
      const result = { id: followUpId };
      await transaction.saveRequest(
        key,
        hash,
        result,
        201,
        leadFollowUpLocation(leadId, followUpId),
      );
      return result;
    });
  }
}
