import { Inject } from '@nestjs/common';
import { Query, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  VISIT_REPOSITORY,
  type VisitPrincipal,
  type VisitRepository,
} from '../../visits/domain/visit.repository.js';
import type { InquiryDetails } from '../domain/inquiry.js';

export class GetInquiryByIdQuery extends Query<InquiryDetails> {
  constructor(
    readonly id: string,
    readonly principal: VisitPrincipal,
  ) {
    super();
  }
}

@QueryHandler(GetInquiryByIdQuery)
export class GetInquiryByIdHandler implements IQueryHandler<GetInquiryByIdQuery> {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
  ) {}

  async execute(query: GetInquiryByIdQuery): Promise<InquiryDetails> {
    const inquiry = await this.visits.findVisibleInquiry(
      query.id,
      query.principal,
    );
    if (!inquiry) throw new VisitProblem('INQUIRY_NOT_FOUND');
    return inquiry;
  }
}
