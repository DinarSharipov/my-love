import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateFinancialDecisionDto,
  CreateFinancialMeetingDto,
  FinancialDecisionResponseDto,
  FinancialMeetingResponseDto,
  RespondFinancialDecisionDto,
  UpdateFinancialMeetingDto,
} from './dto/financial-meeting.dto';
import { FinancialMeetingsService } from './financial-meetings.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/financial-meetings', version: '1' })
export class FinancialMeetingsController {
  constructor(private readonly meetings: FinancialMeetingsService) {}

  @Post()
  @ApiCreatedResponse({ type: FinancialMeetingResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFinancialMeetingDto) {
    return this.meetings.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: [FinancialMeetingResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.meetings.list(user.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: FinancialMeetingResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialMeetingDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.meetings.update(user.id, id, dto, version);
  }

  @Post(':id/complete')
  @ApiOkResponse({ type: FinancialMeetingResponseDto })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.meetings.complete(user.id, id, version);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.meetings.cancel(user.id, id, version);
  }

  @Post(':id/decisions')
  @ApiCreatedResponse({ type: FinancialDecisionResponseDto })
  createDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateFinancialDecisionDto,
  ) {
    return this.meetings.createDecision(user.id, id, dto);
  }

  @Post(':meetingId/decisions/:decisionId/respond')
  @ApiOkResponse({ type: FinancialDecisionResponseDto })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId') meetingId: string,
    @Param('decisionId') decisionId: string,
    @Body() dto: RespondFinancialDecisionDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.meetings.respond(user.id, meetingId, decisionId, dto.status, version);
  }
}
