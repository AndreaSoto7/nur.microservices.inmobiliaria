import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.SERVICE_PORT ?? '8003');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVICE_PORT debe ser un puerto TCP entre 1 y 65535.');
  }

  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  new ConsoleLogger({ json: true }).error(error);
  process.exitCode = 1;
});
