import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { VisitDatabase } from './database/visit-database.js';
import { GetInquiryByIdHandler } from './inquiries/application/get-inquiry-by-id.js';
import { ListAgentInquiriesHandler } from './inquiries/application/list-agent-inquiries.js';
import { SendInquiryHandler } from './inquiries/application/send-inquiry.js';
import { InquiriesController } from './inquiries/presentation/inquiries.controller.js';
import { ListingEventsController } from './properties/listing-events.controller.js';
import { PropertyProjection } from './properties/property-projection.js';
import { HealthController } from './shared/health/health.controller.js';
import { IdentityGuard } from './shared/identity.guard.js';
import { OutboxRelay } from './shared/messaging/outbox-relay.js';
import { ProblemFilter } from './shared/problem.filter.js';
import { CancelVisitHandler } from './visits/application/cancel-visit.js';
import { CompleteVisitHandler } from './visits/application/complete-visit.js';
import { GetVisitByIdHandler } from './visits/application/get-visit-by-id.js';
import { ListVisitsHandler } from './visits/application/list-visits.js';
import { RejectVisitHandler } from './visits/application/reject-visit.js';
import { RequestVisitHandler } from './visits/application/request-visit.js';
import { ScheduleVisitHandler } from './visits/application/schedule-visit.js';
import { VISIT_REPOSITORY } from './visits/domain/visit.repository.js';
import { PostgresVisits } from './visits/infrastructure/postgres-visits.js';
import { VisitsController } from './visits/presentation/visits.controller.js';

@Module({
  imports: [CqrsModule.forRoot()],
  controllers: [
    HealthController,
    VisitsController,
    InquiriesController,
    ListingEventsController,
  ],
  providers: [
    IdentityGuard,
    VisitDatabase,
    OutboxRelay,
    PropertyProjection,
    RequestVisitHandler,
    ScheduleVisitHandler,
    RejectVisitHandler,
    CancelVisitHandler,
    CompleteVisitHandler,
    GetVisitByIdHandler,
    GetInquiryByIdHandler,
    SendInquiryHandler,
    ListAgentInquiriesHandler,
    ListVisitsHandler,
    { provide: VISIT_REPOSITORY, useClass: PostgresVisits },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
