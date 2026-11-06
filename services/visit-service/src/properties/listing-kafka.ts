import type { INestApplication } from '@nestjs/common';
import { Transport, type KafkaOptions } from '@nestjs/microservices';

export function connectListingConsumer(
  app: INestApplication,
  brokers: string[],
): void {
  app.connectMicroservice<KafkaOptions>({
    transport: Transport.KAFKA,
    options: {
      postfixId: '',
      client: { clientId: 'visit-service', brokers },
      consumer: { groupId: 'visit-service', allowAutoTopicCreation: false },
      producer: { allowAutoTopicCreation: false },
      subscribe: { fromBeginning: true },
    },
  });
}
