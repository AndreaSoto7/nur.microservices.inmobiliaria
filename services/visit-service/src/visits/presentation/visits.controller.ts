import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { Response } from 'express';
import {
  ensureCorrelationId,
  uuidPattern,
} from '../../shared/http-contract.js';
import {
  IdentityGuard,
  VisitRoles,
  type AuthenticatedRequest,
} from '../../shared/identity.guard.js';
import { parsePageQuery } from '../../shared/page-query.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import { CancelVisitCommand } from '../application/cancel-visit.js';
import { CompleteVisitCommand } from '../application/complete-visit.js';
import { GetVisitByIdQuery } from '../application/get-visit-by-id.js';
import { ListVisitsQuery } from '../application/list-visits.js';
import { visitStatuses } from '../domain/visit.js';
import { RejectVisitCommand } from '../application/reject-visit.js';
import { RequestVisitCommand } from '../application/request-visit.js';
import { ScheduleVisitCommand } from '../application/schedule-visit.js';

class RequestVisitDto {
  @Matches(uuidPattern)
  propertyId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  @IsISO8601({ strict: true, strictSeparator: true })
  proposedAt!: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(500)
  clientNote?: string;
}

class ScheduleVisitDto {
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  @IsISO8601({ strict: true, strictSeparator: true })
  scheduledStart!: string;
}

class RejectVisitDto {
  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  reason!: string;
}

class CancelVisitDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  reason?: string;
}

@Controller('api/v1/visits')
@UseGuards(IdentityGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class VisitsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @VisitRoles(['CLIENT', 'AGENT'])
  async listVisits(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const filter = parsePageQuery(query, 'requestedAt', ['status']);
    const status = visitStatuses.find((value) => value === query.status);
    if (query.status !== undefined && !status)
      throw new VisitProblem('VALIDATION_ERROR');
    ensureCorrelationId(request, response);
    return this.queries.execute(
      new ListVisitsQuery(request.principal, { ...filter, status }),
    );
  }

  @Post()
  @VisitRoles(['CLIENT'])
  async requestVisit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RequestVisitDto,
  ) {
    if (
      !key ||
      !uuidPattern.test(key) ||
      typeof body?.propertyId !== 'string'
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    const correlationId = ensureCorrelationId(request, response);
    const created = await this.commands.execute(
      new RequestVisitCommand(
        request.principal.id,
        key.toLowerCase(),
        body,
        correlationId,
      ),
    );
    response.setHeader('Location', '/api/v1/visits/' + created.id);
    return created;
  }

  @Post(':visitId/schedule')
  @HttpCode(200)
  @VisitRoles(['AGENT'])
  async scheduleVisit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: ScheduleVisitDto,
  ) {
    if (
      !uuidPattern.test(visitId) ||
      !key ||
      !uuidPattern.test(key) ||
      typeof body?.scheduledStart !== 'string'
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    return this.commands.execute(
      new ScheduleVisitCommand(
        visitId.toLowerCase(),
        request.principal.id,
        key.toLowerCase(),
        body.scheduledStart,
        ensureCorrelationId(request, response),
      ),
    );
  }

  @Post(':visitId/reject')
  @HttpCode(200)
  @VisitRoles(['AGENT'])
  async rejectVisit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RejectVisitDto,
  ) {
    if (
      !uuidPattern.test(visitId) ||
      !key ||
      !uuidPattern.test(key) ||
      typeof body?.reason !== 'string'
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    return this.commands.execute(
      new RejectVisitCommand(
        visitId.toLowerCase(),
        request.principal.id,
        key.toLowerCase(),
        body.reason,
        ensureCorrelationId(request, response),
      ),
    );
  }

  @Post(':visitId/cancel')
  @HttpCode(200)
  @VisitRoles(['CLIENT', 'AGENT'])
  async cancelVisit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CancelVisitDto,
  ) {
    if (
      !uuidPattern.test(visitId) ||
      !key ||
      !uuidPattern.test(key) ||
      Array.isArray(request.body)
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    return this.commands.execute(
      new CancelVisitCommand(
        visitId.toLowerCase(),
        request.principal,
        key.toLowerCase(),
        body?.reason,
        ensureCorrelationId(request, response),
      ),
    );
  }

  @Post(':visitId/complete')
  @HttpCode(200)
  @VisitRoles(['AGENT'])
  async completeVisit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    if (
      !uuidPattern.test(visitId) ||
      !key ||
      !uuidPattern.test(key) ||
      (body !== undefined &&
        (body === null ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length !== 0))
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    return this.commands.execute(
      new CompleteVisitCommand(
        visitId.toLowerCase(),
        request.principal.id,
        key.toLowerCase(),
        ensureCorrelationId(request, response),
      ),
    );
  }

  @Get(':visitId')
  @VisitRoles(['CLIENT', 'AGENT'])
  async getVisit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
  ) {
    if (!uuidPattern.test(visitId)) throw new VisitProblem('VALIDATION_ERROR');
    ensureCorrelationId(request, response);
    return this.queries.execute(
      new GetVisitByIdQuery(visitId, request.principal),
    );
  }
}
