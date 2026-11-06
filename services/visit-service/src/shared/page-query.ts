import { uuidPattern } from './http-contract.js';
import type { PageFilter } from './page.js';
import { VisitProblem } from './visit-problem.js';

function integer(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value) ||
    Number(value) > max
  ) {
    throw new VisitProblem('VALIDATION_ERROR');
  }
  return Number(value);
}

export function parsePageQuery(
  query: Record<string, unknown>,
  sortField: 'requestedAt' | 'createdAt' | 'openedAt',
  extraFields: readonly string[] = [],
): PageFilter {
  const fields = ['page', 'size', 'sort', 'propertyId', ...extraFields];
  if (Object.keys(query).some((key) => !fields.includes(key))) {
    throw new VisitProblem('VALIDATION_ERROR');
  }
  const { sort, propertyId } = query;
  if (
    sort !== undefined &&
    sort !== sortField + ',asc' &&
    sort !== sortField + ',desc'
  ) {
    throw new VisitProblem('VALIDATION_ERROR');
  }
  if (
    propertyId !== undefined &&
    (typeof propertyId !== 'string' || !uuidPattern.test(propertyId))
  ) {
    throw new VisitProblem('VALIDATION_ERROR');
  }
  return {
    page: integer(query.page, 1, 2_147_483_647),
    size: integer(query.size, 20, 100),
    sort: sort === sortField + ',asc' ? 'asc' : 'desc',
    propertyId: propertyId?.toLowerCase(),
  };
}
