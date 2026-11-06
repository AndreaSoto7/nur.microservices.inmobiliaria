import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

export const uuidPattern =
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export function leadFollowUpLocation(
  leadId: string,
  followUpId: string,
): string {
  return '/api/v1/leads/' + leadId + '/follow-ups/' + followUpId;
}

export function ensureCorrelationId(
  request: Request,
  response: Response,
): string {
  const existing = response.getHeader('X-Correlation-Id');
  if (typeof existing === 'string') return existing;
  const supplied = request.header('X-Correlation-Id');
  const id =
    supplied && /^[A-Za-z0-9._-]{1,128}$/.test(supplied)
      ? supplied
      : randomUUID();
  response.setHeader('X-Correlation-Id', id);
  return id;
}
