import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import {
  InquiryAlreadyRepliedError,
  InvalidInquiryError,
  replyToInquiry,
  type InquiryReply,
} from '../domain/inquiry.js';

export class ReplyInquiryCommand extends Command<{ id: string }> {
  constructor(
    readonly inquiryId: string,
    readonly agentId: string,
    readonly idempotencyKey: string,
    readonly message: string,
    readonly correlationId: string,
  ) {
    super();
  }
}

/**
 * El agente asignado responde la consulta, una vez. Publica InquiryReplied para que notification le
 * avise al cliente; la respuesta no viaja en el evento, el cliente la lee por la API.
 */
@CommandHandler(ReplyInquiryCommand)
export class ReplyInquiryHandler implements ICommandHandler<ReplyInquiryCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: ReplyInquiryCommand): Promise<{ id: string }> {
    const key = {
      actorId: command.agentId,
      key: command.idempotencyKey,
      operation: 'reply-inquiry',
    } as const;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          inquiryId: command.inquiryId,
          message: command.message,
        }),
      )
      .digest('hex');

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<{ id: string }>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const inquiry = await transaction.findAssignedInquiry(
        command.inquiryId,
        command.agentId,
      );
      if (!inquiry) throw new VisitProblem('INQUIRY_NOT_FOUND');

      let reply: InquiryReply;
      try {
        reply = replyToInquiry(inquiry, command.message, new Date());
      } catch (error) {
        if (error instanceof InquiryAlreadyRepliedError)
          throw new VisitProblem('INQUIRY_ALREADY_REPLIED');
        if (error instanceof InvalidInquiryError)
          throw new VisitProblem('VALIDATION_ERROR');
        throw error;
      }
      await transaction.saveInquiryReply(reply);
      const { id, propertyId, clientId, agentId } = inquiry;
      await transaction.enqueue({
        type: 'InquiryReplied',
        aggregateId: id,
        occurredAt: reply.repliedAt,
        correlationId: command.correlationId,
        payload: { inquiryId: id, propertyId, clientId, agentId },
      });
      const result = { id };
      await transaction.saveRequest(key, hash, result, 200);
      return result;
    });
  }
}
