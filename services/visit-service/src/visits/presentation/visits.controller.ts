import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
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
import { VisitProblem } from '../../shared/visit-problem.js';
import { GetVisitByIdQuery } from '../application/get-visit-by-id.js';
import { RequestVisitCommand } from '../application/request-visit.js';

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
