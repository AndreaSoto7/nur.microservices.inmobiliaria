import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { VisitDatabase } from './database/visit-database.js';
import { HealthController } from './shared/health/health.controller.js';
import { IdentityGuard } from './shared/identity.guard.js';
import { ProblemFilter } from './shared/problem.filter.js';
import { GetVisitByIdHandler } from './visits/application/get-visit-by-id.js';
import { RequestVisitHandler } from './visits/application/request-visit.js';
import { VISIT_REPOSITORY } from './visits/domain/visit.repository.js';
import { PostgresVisits } from './visits/infrastructure/postgres-visits.js';
import { VisitsController } from './visits/presentation/visits.controller.js';

@Module({
  imports: [CqrsModule.forRoot()],
  controllers: [HealthController, VisitsController],
  providers: [
    IdentityGuard,
    VisitDatabase,
    RequestVisitHandler,
    GetVisitByIdHandler,
    { provide: VISIT_REPOSITORY, useClass: PostgresVisits },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
