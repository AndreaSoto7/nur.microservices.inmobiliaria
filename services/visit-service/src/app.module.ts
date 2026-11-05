import { Module } from '@nestjs/common';
import { HealthController } from './shared/health/health.controller.js';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
