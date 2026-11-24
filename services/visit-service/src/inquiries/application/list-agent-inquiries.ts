import { Inject } from '@nestjs/common';
import { Query, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Page, PageFilter } from '../../shared/page.js';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import type { AgentInquirySummary } from '../domain/inquiry.js';

export class ListAgentInquiriesQuery extends Query<Page<AgentInquirySummary>> {
  constructor(
    readonly agentId: string,
    readonly filter: PageFilter,
  ) {
    super();
  }
}

@QueryHandler(ListAgentInquiriesQuery)
export class ListAgentInquiriesHandler implements IQueryHandler<ListAgentInquiriesQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  execute(query: ListAgentInquiriesQuery): Promise<Page<AgentInquirySummary>> {
    return this.visits.listAgentInquiries(query.agentId, query.filter);
  }
}

/** Las consultas que envió el cliente, con la fecha de respuesta si ya la tienen. */
export class ListClientInquiriesQuery extends Query<Page<AgentInquirySummary>> {
  constructor(
    readonly clientId: string,
    readonly filter: PageFilter,
  ) {
    super();
  }
}

@QueryHandler(ListClientInquiriesQuery)
export class ListClientInquiriesHandler implements IQueryHandler<ListClientInquiriesQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  execute(query: ListClientInquiriesQuery): Promise<Page<AgentInquirySummary>> {
    return this.visits.listClientInquiries(query.clientId, query.filter);
  }
}
