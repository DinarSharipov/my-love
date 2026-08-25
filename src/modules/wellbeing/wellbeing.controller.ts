import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateWellbeingCheckInDto,
  WellbeingCheckInResponseDto,
} from './dto/wellbeing-check-in.dto';
import {
  CreateWellbeingConsentDto,
  WellbeingConsentResponseDto,
} from './dto/wellbeing-consent.dto';
import {
  CreateWellbeingAssessmentDto,
  WellbeingAssessmentResponseDto,
} from './dto/wellbeing-assessment.dto';
import {
  CreateWellbeingGratitudeDto,
  WellbeingGratitudeResponseDto,
} from './dto/wellbeing-gratitude.dto';
import { WellbeingService } from './wellbeing.service';
import {
  CreateWellbeingSupportRequestDto,
  UpdateWellbeingSupportRequestDto,
  WellbeingSupportRequestResponseDto,
} from './dto/wellbeing-support-request.dto';
import {
  CreateWellbeingRitualDto,
  UpdateWellbeingRitualDto,
  WellbeingRitualResponseDto,
} from './dto/wellbeing-ritual.dto';
import {
  CreateWellbeingCoupleMeetingDto,
  UpdateWellbeingCoupleMeetingDto,
  WellbeingCoupleMeetingDecisionDto,
  WellbeingCoupleMeetingResponseDto,
  WellbeingCoupleMeetingResponseInputDto,
} from './dto/wellbeing-couple-meeting.dto';

@ApiTags('wellbeing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/wellbeing/check-ins', version: '1' })
export class WellbeingController {
  constructor(private readonly wellbeing: WellbeingService) {}

  @Post()
  @ApiCreatedResponse({ type: WellbeingCheckInResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWellbeingCheckInDto) {
    return this.wellbeing.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: [WellbeingCheckInResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.list(user.id);
  }

  @Post('consents')
  @ApiCreatedResponse({ type: WellbeingConsentResponseDto })
  grantConsent(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWellbeingConsentDto) {
    return this.wellbeing.grantConsent(user.id, dto);
  }

  @Get('consents')
  @ApiOkResponse({ type: [WellbeingConsentResponseDto] })
  listConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.listConsents(user.id);
  }

  @Delete('consents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  revokeConsent(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wellbeing.revokeConsent(user.id, id);
  }

  @Get('shared-with-me')
  @ApiOkResponse({ type: [WellbeingCheckInResponseDto] })
  sharedWithMe(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.sharedWithMe(user.id);
  }

  @Post('assessments')
  @ApiCreatedResponse({ type: WellbeingAssessmentResponseDto })
  createAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWellbeingAssessmentDto,
  ) {
    return this.wellbeing.createAssessment(user.id, dto);
  }

  @Get('assessments')
  @ApiOkResponse({ type: [WellbeingAssessmentResponseDto] })
  listAssessments(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.listAssessments(user.id);
  }

  @Get('trends')
  @ApiOkResponse({ type: Object })
  trends(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.trends(user.id);
  }

  @Get('export')
  @ApiOkResponse({ type: Object })
  exportData(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.exportData(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteAll(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.deleteAll(user.id);
  }

  @Post('gratitudes')
  @ApiCreatedResponse({ type: WellbeingGratitudeResponseDto })
  createGratitude(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWellbeingGratitudeDto,
  ) {
    return this.wellbeing.createGratitude(user.id, dto);
  }

  @Get('gratitudes')
  @ApiOkResponse({ type: [WellbeingGratitudeResponseDto] })
  listGratitudes(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.listGratitudes(user.id);
  }

  @Delete('gratitudes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeGratitude(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wellbeing.removeGratitude(user.id, id);
  }

  @Post('support-requests')
  @ApiCreatedResponse({ type: WellbeingSupportRequestResponseDto })
  createSupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWellbeingSupportRequestDto,
  ) {
    return this.wellbeing.createSupportRequest(user.id, dto);
  }

  @Get('support-requests')
  @ApiOkResponse({ type: [WellbeingSupportRequestResponseDto] })
  listSupportRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.listSupportRequests(user.id);
  }

  @Post('support-requests/:id/status')
  @ApiOkResponse({ type: WellbeingSupportRequestResponseDto })
  updateSupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWellbeingSupportRequestDto,
  ) {
    return this.wellbeing.updateSupportRequest(user.id, id, dto);
  }

  @Post('rituals')
  @ApiCreatedResponse({ type: WellbeingRitualResponseDto })
  createRitual(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWellbeingRitualDto) {
    return this.wellbeing.createRitual(user.id, dto);
  }

  @Get('rituals')
  @ApiOkResponse({ type: [WellbeingRitualResponseDto] })
  listRituals(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.listRituals(user.id);
  }

  @Post('rituals/:id')
  @ApiOkResponse({ type: WellbeingRitualResponseDto })
  updateRitual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWellbeingRitualDto,
  ) {
    return this.wellbeing.updateRitual(user.id, id, dto);
  }

  @Delete('rituals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeRitual(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wellbeing.removeRitual(user.id, id);
  }

  @Post('couple-meetings')
  @ApiCreatedResponse({ type: WellbeingCoupleMeetingResponseDto })
  createCoupleMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWellbeingCoupleMeetingDto,
  ) {
    return this.wellbeing.createCoupleMeeting(user.id, dto);
  }

  @Get('couple-meetings')
  @ApiOkResponse({ type: [WellbeingCoupleMeetingResponseDto] })
  listCoupleMeetings(@CurrentUser() user: AuthenticatedUser) {
    return this.wellbeing.listCoupleMeetings(user.id);
  }

  @Post('couple-meetings/:id')
  @ApiOkResponse({ type: WellbeingCoupleMeetingResponseDto })
  updateCoupleMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWellbeingCoupleMeetingDto,
  ) {
    return this.wellbeing.updateCoupleMeeting(user.id, id, dto);
  }

  @Post('couple-meetings/:id/response')
  @ApiOkResponse({ type: WellbeingCoupleMeetingResponseDto })
  respondToCoupleMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WellbeingCoupleMeetingResponseInputDto,
  ) {
    return this.wellbeing.respondToCoupleMeeting(user.id, id, dto);
  }

  @Post('couple-meetings/:id/publish')
  @ApiOkResponse({ type: WellbeingCoupleMeetingResponseDto })
  publishCoupleMeeting(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wellbeing.publishCoupleMeeting(user.id, id);
  }

  @Post('couple-meetings/:id/decision')
  @ApiOkResponse({ type: WellbeingCoupleMeetingResponseDto })
  setCoupleMeetingDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WellbeingCoupleMeetingDecisionDto,
  ) {
    return this.wellbeing.setCoupleMeetingDecision(user.id, id, dto);
  }

  // Keep catch-all item routes last: Express matches routes in registration order.
  @Get(':id')
  @ApiOkResponse({ type: WellbeingCheckInResponseDto })
  @ApiNotFoundResponse()
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wellbeing.findOne(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wellbeing.remove(user.id, id);
  }
}
