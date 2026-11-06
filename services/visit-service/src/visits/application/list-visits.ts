import { Inject } from '@nestjs/common';
import { Query, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Page } from '../../shared/page.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitDetails,
  type VisitListFilter,
  type VisitPrincipal,
  type VisitRepository,
} from '../domain/visit.repository.js';

export class ListVisitsQuery extends Query<Page<VisitDetails>> {
  constructor(
    readonly principal: VisitPrincipal,
    readonly filter: VisitListFilter,
  ) {
    super();
  }
}

@QueryHandler(ListVisitsQuery)
export class ListVisitsHandler implements IQueryHandler<ListVisitsQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(query: ListVisitsQuery): Promise<Page<VisitDetails>> {
    const { id, roles } = query.principal;
    const role = roles.includes('AGENT')
      ? 'AGENT'
      : roles.includes('CLIENT')
        ? 'CLIENT'
        : undefined;
    if (!role) throw new VisitProblem('PERMISSION_DENIED');
    return this.visits.listVisits({ id, role }, query.filter);
  }
}
