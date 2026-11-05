export type VisitProblemCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_INVALID_TOKEN'
  | 'PERMISSION_DENIED'
  | 'PROPERTY_NOT_FOUND'
  | 'PROPERTY_UNAVAILABLE'
  | 'VISIT_INVALID_PROPOSED_DATE'
  | 'VISIT_ALREADY_REQUESTED'
  | 'VISIT_NOT_FOUND'
  | 'IDEMPOTENCY_KEY_REUSED';

export class VisitProblem extends Error {
  constructor(readonly code: VisitProblemCode) {
    super(code);
  }
}
