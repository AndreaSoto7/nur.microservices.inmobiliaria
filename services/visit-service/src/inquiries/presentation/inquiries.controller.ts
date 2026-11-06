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
import { VisitProblem } from '../../shared/visit-problem.js';
import { GetInquiryByIdQuery } from '../application/get-inquiry-by-id.js';
import { SendInquiryCommand } from '../application/send-inquiry.js';

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
  @Matches(/\S/u)
  @MaxLength(30)
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
