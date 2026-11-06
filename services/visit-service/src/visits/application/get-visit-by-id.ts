import { Inject } from '@nestjs/common';
import { Query, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitDetails,
  type VisitPrincipal,
  type VisitRepository,
} from '../domain/visit.repository.js';

export class GetVisitByIdQuery extends Query<VisitDetails> {
  constructor(
    readonly id: string,
    readonly principal: VisitPrincipal,
  ) {
    super();
  }
}

@QueryHandler(GetVisitByIdQuery)
export class GetVisitByIdHandler implements IQueryHandler<GetVisitByIdQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(query: GetVisitByIdQuery): Promise<VisitDetails> {
    const visit = await this.visits.findVisible(query.id, query.principal);
    if (!visit) throw new VisitProblem('VISIT_NOT_FOUND');
    return visit;
  }
}
