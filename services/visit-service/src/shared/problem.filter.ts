import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ensureCorrelationId } from './http-contract.js';
import { VisitProblem, type VisitProblemCode } from './visit-problem.js';

const problems: Record<VisitProblemCode, [number, string]> = {
  VALIDATION_ERROR: [400, 'Datos inválidos'],
  AUTH_INVALID_TOKEN: [401, 'Se requiere autenticación'],
  PERMISSION_DENIED: [403, 'Acceso denegado'],
  PROPERTY_NOT_FOUND: [404, 'Propiedad no encontrada'],
  PROPERTY_UNAVAILABLE: [409, 'La propiedad debe estar publicada'],
  VISIT_INVALID_PROPOSED_DATE: [409, 'La fecha propuesta debe ser futura'],
  VISIT_ALREADY_REQUESTED: [
    409,
    'Ya tienes una solicitud pendiente para esta propiedad',
  ],
  LEAD_NOT_FOUND: [404, 'Oportunidad no encontrada'],
  LEAD_NOT_OPEN: [409, 'La oportunidad debe estar abierta'],
  LEAD_FOLLOW_UP_NOT_FOUND: [404, 'Nota de seguimiento no encontrada'],
  INQUIRY_NOT_FOUND: [404, 'Consulta no encontrada'],
  VISIT_NOT_FOUND: [404, 'Visita no encontrada'],
  VISIT_NOT_REQUESTED: [409, 'La visita debe estar pendiente'],
  VISIT_NOT_SCHEDULED: [409, 'La visita debe estar programada'],
  VISIT_COMPLETION_TOO_EARLY: [
    409,
    'La hora de fin de la visita todavía no llegó',
  ],
  VISIT_CANCELLATION_TOO_LATE: [
    409,
    'La hora de inicio de la visita ya llegó o pasó',
  ],
  VISIT_INVALID_SCHEDULE: [
    409,
    'La fecha de programación debe ser futura y válida',
  ],
  VISIT_SCHEDULE_CONFLICT: [
    409,
    'El agente ya tiene una visita en ese horario',
  ],
  IDEMPOTENCY_KEY_REUSED: [
    422,
    'Clave de idempotencia reutilizada con datos distintos',
  ],
};

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const correlationId = ensureCorrelationId(request, response);
    let code: VisitProblemCode | 'NOT_FOUND' | 'INTERNAL_ERROR' =
      'INTERNAL_ERROR';
    let status = 500;
    let title = 'Error interno';

    if (error instanceof VisitProblem) {
      code = error.code;
      [status, title] = problems[code];
    } else if (error instanceof HttpException && error.getStatus() === 400) {
      code = 'VALIDATION_ERROR';
      [status, title] = problems[code];
    } else if (error instanceof HttpException && error.getStatus() === 404) {
      code = 'NOT_FOUND';
      status = 404;
      title = 'Recurso no encontrado';
    } else if (error instanceof HttpException && error.getStatus() < 500) {
      code = 'VALIDATION_ERROR';
      status = error.getStatus();
      title = 'Datos inválidos';
    } else {
      this.logger.error({
        correlationId,
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }

    if (status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
    response
      .status(status)
      .type('application/problem+json')
      .json({
        type:
          'https://inmobiliaria.local/problems/' +
          code.toLowerCase().replaceAll('_', '-'),
        title,
        status,
        code,
        correlationId,
      });
  }
}
