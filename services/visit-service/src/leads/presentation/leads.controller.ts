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
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { Response } from 'express';
import {
  ensureCorrelationId,
  leadFollowUpLocation,
  uuidPattern,
} from '../../shared/http-contract.js';
import {
  IdentityGuard,
  VisitRoles,
  type AuthenticatedRequest,
} from '../../shared/identity.guard.js';
import { parsePageQuery } from '../../shared/page-query.js';
import { VisitProblem } from '../../shared/visit-problem.js';
import {
  GetLeadFollowUpQuery,
  ListAgentLeadsQuery,
} from '../application/lead-queries.js';
import { CloseLeadCommand } from '../application/close-lead.js';
import { leadOutcomes, type LeadOutcome } from '../domain/lead.js';
import { RegisterLeadFollowUpCommand } from '../application/register-lead-follow-up.js';

class RegisterFollowUpDto {
  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  note!: string;
}

class CloseLeadDto {
  @IsIn(leadOutcomes)
  outcome!: LeadOutcome;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  note?: string;
}

@Controller('api/v1/leads')
@UseGuards(IdentityGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class LeadsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @VisitRoles(['AGENT'])
  listLeads(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const filter = parsePageQuery(query, 'openedAt', ['status']);
    const { status } = query;
    if (status !== undefined && status !== 'OPEN' && status !== 'CLOSED') {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    ensureCorrelationId(request, response);
    return this.queries.execute(
      new ListAgentLeadsQuery(request.principal.id, { ...filter, status }),
    );
  }

  @Post(':leadId/close')
  @HttpCode(200)
  @VisitRoles(['AGENT'])
  closeLead(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('leadId') leadId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CloseLeadDto,
  ) {
    if (
      !uuidPattern.test(leadId) ||
      !key ||
      !uuidPattern.test(key) ||
      !body?.outcome
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    return this.commands.execute(
      new CloseLeadCommand(
        leadId.toLowerCase(),
        request.principal.id,
        key.toLowerCase(),
        body.outcome,
        body.note,
        ensureCorrelationId(request, response),
      ),
    );
  }

  @Post(':leadId/follow-ups')
  @VisitRoles(['AGENT'])
  async registerFollowUp(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('leadId') leadId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RegisterFollowUpDto,
  ) {
    if (
      !uuidPattern.test(leadId) ||
      !key ||
      !uuidPattern.test(key) ||
      typeof body?.note !== 'string'
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    const id = leadId.toLowerCase();
    const created = await this.commands.execute(
      new RegisterLeadFollowUpCommand(
        id,
        request.principal.id,
        key.toLowerCase(),
        body.note,
        ensureCorrelationId(request, response),
      ),
    );
    response.setHeader('Location', leadFollowUpLocation(id, created.id));
    return created;
  }

  @Get(':leadId/follow-ups/:followUpId')
  @VisitRoles(['AGENT'])
  getFollowUp(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('leadId') leadId: string,
    @Param('followUpId') followUpId: string,
  ) {
    if (!uuidPattern.test(leadId) || !uuidPattern.test(followUpId))
      throw new VisitProblem('VALIDATION_ERROR');
    ensureCorrelationId(request, response);
    return this.queries.execute(
      new GetLeadFollowUpQuery(
        leadId.toLowerCase(),
        followUpId.toLowerCase(),
        request.principal.id,
      ),
    );
  }
}
