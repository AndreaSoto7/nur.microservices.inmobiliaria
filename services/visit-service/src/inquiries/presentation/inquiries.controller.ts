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
  IsEmail,
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
import { GetInquiryByIdQuery } from '../application/get-inquiry-by-id.js';
import {
  ListAgentInquiriesQuery,
  ListClientInquiriesQuery,
} from '../application/list-agent-inquiries.js';
import { ReplyInquiryCommand } from '../application/reply-inquiry.js';
import { SendInquiryCommand } from '../application/send-inquiry.js';
import { PHONE_PATTERN } from '../domain/inquiry.js';

class ReplyInquiryDto {
  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  message!: string;
}

class SendInquiryDto {
  @Matches(uuidPattern)
  propertyId!: string;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(150)
  contactName!: string;

  @IsEmail()
  @Matches(/^\S+$/u)
  @MaxLength(254)
  contactEmail!: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(PHONE_PATTERN)
  @MaxLength(20)
  contactPhone?: string;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  message!: string;
}

@Controller('api/v1/inquiries')
@UseGuards(IdentityGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class InquiriesController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @VisitRoles(['AGENT', 'CLIENT'])
  async listInquiries(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Query() query: Record<string, unknown>,
  ) {
    const filter = parsePageQuery(query, 'createdAt');
    ensureCorrelationId(request, response);
    // La colección depende de quién llama (rule api-rest): el agente ve su bandeja; el cliente, lo que envió.
    const { id, roles } = request.principal;
    return this.queries.execute(
      roles.includes('AGENT')
        ? new ListAgentInquiriesQuery(id, filter)
        : new ListClientInquiriesQuery(id, filter),
    );
  }

  @Post(':inquiryId/reply')
  @HttpCode(200)
  @VisitRoles(['AGENT'])
  async replyInquiry(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('inquiryId') inquiryId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: ReplyInquiryDto,
  ) {
    if (
      !uuidPattern.test(inquiryId) ||
      !key ||
      !uuidPattern.test(key) ||
      typeof body?.message !== 'string'
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    return this.commands.execute(
      new ReplyInquiryCommand(
        inquiryId.toLowerCase(),
        request.principal.id,
        key.toLowerCase(),
        body.message,
        ensureCorrelationId(request, response),
      ),
    );
  }

  @Post()
  @VisitRoles(['CLIENT'])
  async sendInquiry(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: SendInquiryDto,
  ) {
    if (
      !key ||
      !uuidPattern.test(key) ||
      typeof body?.propertyId !== 'string'
    ) {
      throw new VisitProblem('VALIDATION_ERROR');
    }
    const created = await this.commands.execute(
      new SendInquiryCommand(
        request.principal.id,
        key.toLowerCase(),
        { ...body, propertyId: body.propertyId.toLowerCase() },
        ensureCorrelationId(request, response),
      ),
    );
    response.setHeader('Location', '/api/v1/inquiries/' + created.id);
    return created;
  }

  @Get(':inquiryId')
  @VisitRoles(['CLIENT', 'AGENT'])
  async getInquiry(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('inquiryId') inquiryId: string,
  ) {
    if (!uuidPattern.test(inquiryId))
      throw new VisitProblem('VALIDATION_ERROR');
    ensureCorrelationId(request, response);
    return this.queries.execute(
      new GetInquiryByIdQuery(inquiryId.toLowerCase(), request.principal),
    );
  }
}
