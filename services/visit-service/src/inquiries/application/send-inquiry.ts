import { Inject } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createHash, randomUUID } from 'node:crypto';
import { openLeadOnContact } from '../../leads/application/open-lead-on-contact.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import {
  Inquiry,
  InvalidInquiryError,
  type InquiryInput,
} from '../domain/inquiry.js';

export class SendInquiryCommand extends Command<{ id: string }> {
  constructor(
    readonly clientId: string,
    readonly idempotencyKey: string,
    readonly input: InquiryInput,
    readonly correlationId: string,
  ) {
    super();
  }
}

@CommandHandler(SendInquiryCommand)
export class SendInquiryHandler implements ICommandHandler<SendInquiryCommand> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(command: SendInquiryCommand): Promise<{ id: string }> {
    const { propertyId, contactName, contactEmail, contactPhone, message } =
      command.input;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          propertyId,
          contactName,
          contactEmail,
          contactPhone,
          message,
        }),
      )
      .digest('hex');
    const key = {
      actorId: command.clientId,
      key: command.idempotencyKey,
      operation: 'send-inquiry',
    } as const;

    return this.visits.transaction(async (transaction) => {
      await transaction.lockRequest(key);
      const previous = await transaction.findRequest<{ id: string }>(key);
      if (previous) {
        if (previous.hash !== hash)
          throw new VisitProblem('IDEMPOTENCY_KEY_REUSED');
        return previous.response;
      }

      const property = await transaction.findProperty(propertyId);
      if (!property) throw new VisitProblem('PROPERTY_NOT_FOUND');
      if (property.status !== 'PUBLISHED')
        throw new VisitProblem('PROPERTY_UNAVAILABLE');

      const createdAt = new Date();
      let inquiry: Inquiry;
      try {
        inquiry = Inquiry.receive({
          ...command.input,
          id: randomUUID(),
          propertyId: property.id,
          clientId: command.clientId,
          agentId: property.agentId,
          createdAt,
        });
      } catch (error) {
        if (error instanceof InvalidInquiryError)
          throw new VisitProblem('VALIDATION_ERROR');
        throw error;
      }
      await transaction.saveInquiry(inquiry);

      const { id, clientId, agentId } = inquiry;
      const participants = { propertyId: property.id, clientId, agentId };
      const eventId = await transaction.enqueue({
        type: 'InquiryReceived',
        aggregateId: id,
        occurredAt: createdAt,
        correlationId: command.correlationId,
        payload: { ...participants, inquiryId: id },
      });
      await openLeadOnContact(
        transaction,
        { ...participants, openedAt: createdAt },
        command.correlationId,
        eventId,
      );
      const result = { id };
      await transaction.saveRequest(key, hash, result, 201);
      return result;
    });
  }
}
