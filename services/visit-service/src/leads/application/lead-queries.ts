import { Inject } from '@nestjs/common';
import { Query, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Page, PageFilter } from '../../shared/page.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type LeadListFilter,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import type { LeadFollowUpDetails, LeadSummary } from '../domain/lead.js';

export class ListAgentLeadsQuery extends Query<Page<LeadSummary>> {
  constructor(
    readonly agentId: string,
    readonly filter: LeadListFilter,
  ) {
    super();
  }
}

@QueryHandler(ListAgentLeadsQuery)
export class ListAgentLeadsHandler implements IQueryHandler<ListAgentLeadsQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  execute(query: ListAgentLeadsQuery): Promise<Page<LeadSummary>> {
    return this.visits.listAgentLeads(query.agentId, query.filter);
  }
}

export class ListLeadFollowUpsQuery extends Query<Page<LeadFollowUpDetails>> {
  constructor(
    readonly leadId: string,
    readonly agentId: string,
    readonly filter: PageFilter,
  ) {
    super();
  }
}

/** Las notas que el agente fue dejando en su oportunidad (antes solo se podía leer una por id). */
@QueryHandler(ListLeadFollowUpsQuery)
export class ListLeadFollowUpsHandler implements IQueryHandler<ListLeadFollowUpsQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(
    query: ListLeadFollowUpsQuery,
  ): Promise<Page<LeadFollowUpDetails>> {
    const notes = await this.visits.listLeadFollowUps(
      query.leadId,
      query.agentId,
      query.filter,
    );
    if (!notes) throw new VisitProblem('LEAD_NOT_FOUND');
    return notes;
  }
}

export class GetLeadFollowUpQuery extends Query<LeadFollowUpDetails> {
  constructor(
    readonly leadId: string,
    readonly followUpId: string,
    readonly agentId: string,
  ) {
    super();
  }
}

@QueryHandler(GetLeadFollowUpQuery)
export class GetLeadFollowUpHandler implements IQueryHandler<GetLeadFollowUpQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(query: GetLeadFollowUpQuery): Promise<LeadFollowUpDetails> {
    const followUp = await this.visits.findLeadFollowUp(
      query.leadId,
      query.followUpId,
      query.agentId,
    );
    if (!followUp) throw new VisitProblem('LEAD_FOLLOW_UP_NOT_FOUND');
    return followUp;
  }
}
