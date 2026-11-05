import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { connectListingConsumer } from './properties/listing-kafka.js';

async function bootstrap(): Promise<void> {
  const envFile = '.env';
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const port = Number(process.env.SERVICE_PORT ?? '8003');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVICE_PORT debe ser un puerto TCP entre 1 y 65535.');
  }

  const logger = new ConsoleLogger({ json: true });
  const app = await NestFactory.create(AppModule, {
    logger,
  });
  app.enableShutdownHooks();
  try {
    const brokers = process.env.KAFKA_BROKERS?.split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);
    if (brokers?.length) {
      connectListingConsumer(app, brokers);
      await app.startAllMicroservices();
      logger.log('Consumidor de Listing iniciado', 'VisitKafka');
    }
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    await app.close();
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  new ConsoleLogger({ json: true }).error(error);
  process.exitCode = 1;
});
