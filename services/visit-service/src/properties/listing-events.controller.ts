import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  KafkaRetriableException,
  Payload,
} from '@nestjs/microservices';
import { setTimeout as delay } from 'node:timers/promises';
import { parsePropertyEvent } from './property-event.js';
import { PropertyProjection } from './property-projection.js';

export const listingPropertyTopic = 'listing.property.events';

@Controller()
export class ListingEventsController {
  private readonly logger = new Logger(ListingEventsController.name);

  constructor(private readonly projection: PropertyProjection) {}

  @EventPattern(listingPropertyTopic)
  async project(
    @Payload() payload: unknown,
    @Ctx() context: unknown,
  ): Promise<void> {
    if (!(context instanceof KafkaContext))
      throw new Error('Falta el contexto del mensaje de Kafka');
    let event;
    try {
      event = parsePropertyEvent(payload);
    } catch (error) {
      await this.sendToDeadLetter(
        payload,
        context,
        error instanceof Error ? error.message : 'Evento inválido',
      );
      return;
    }
    if (!event) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.projection.apply(event, context.getHeartbeat());
        return;
      } catch (error) {
        if (attempt === 2) {
          await this.sendToDeadLetter(
            payload,
            context,
            error instanceof Error ? error.name : 'ProjectionError',
          );
          return;
        }
      }
      await delay(200 * 2 ** attempt);
      await context.getHeartbeat()();
    }
  }

  private async sendToDeadLetter(
    payload: unknown,
    context: KafkaContext,
    reason: string,
  ) {
    const message = context.getMessage();
    const key = message.key?.toString();
    const origin = {
      topic: context.getTopic(),
      partition: context.getPartition(),
      offset: message.offset,
    };
    try {
      await context.getProducer().send({
        topic: listingPropertyTopic + '.dlq',
        messages: [
          { key, value: JSON.stringify({ ...origin, reason, event: payload }) },
        ],
      });
      this.logger.warn({
        ...origin,
        reason,
        message: 'Evento de Listing enviado a DLQ',
      });
    } catch {
      throw new KafkaRetriableException(
        'No se pudo enviar el evento de Listing a DLQ',
      );
    }
  }
}
