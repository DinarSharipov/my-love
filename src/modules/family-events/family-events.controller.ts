import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateFamilyEventDto } from './dto/create-family-event.dto';
import { AttachFamilyEventMediaDto } from './dto/attach-family-event-media.dto';
import { FamilyEventResponseDto } from './dto/family-event-response.dto';
import { FamilyEventsQueryDto } from './dto/family-events-query.dto';
import { PaginatedFamilyEventsResponseDto } from './dto/paginated-family-events-response.dto';
import { UpdateFamilyEventDto } from './dto/update-family-event.dto';
import { FamilyEventsService } from './family-events.service';
import { MediaResponseDto } from '../media/dto/media-response.dto';

@ApiTags('family events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'family-events', version: '1' })
export class FamilyEventsController {
  constructor(private readonly eventsService: FamilyEventsService) {}

  @Post()
  @Idempotent('family-events.create')
  @ApiOperation({ summary: 'Propose a new event to the partner' })
  @ApiCreatedResponse({ type: FamilyEventResponseDto })
  @ApiBadRequestResponse({ description: 'The event date is not in the future' })
  @ApiForbiddenResponse({ description: 'The current user does not belong to a family' })
  createFamilyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFamilyEventDto,
  ): Promise<FamilyEventResponseDto> {
    return this.eventsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get events of the current user family' })
  @ApiOkResponse({ type: PaginatedFamilyEventsResponseDto })
  @ApiBadRequestResponse({ description: 'dateFrom must be earlier than dateTo' })
  findFamilyEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FamilyEventsQueryDto,
  ): Promise<PaginatedFamilyEventsResponseDto> {
    return this.eventsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one event of the current user family' })
  @ApiOkResponse({ type: FamilyEventResponseDto })
  @ApiNotFoundResponse({ description: 'Event does not exist in the current user family' })
  findFamilyEventById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyEventResponseDto> {
    return this.eventsService.findOne(id, user.id);
  }

  @Get(':id/media')
  @ApiOperation({ summary: 'List media attached to a family event' })
  @ApiOkResponse({ type: [MediaResponseDto] })
  listEventMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaResponseDto[]> {
    return this.eventsService.listMedia(id, user.id);
  }

  @Post(':id/media')
  @ApiOperation({ summary: 'Attach family media to an event' })
  @ApiOkResponse({ type: [MediaResponseDto] })
  attachEventMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachFamilyEventMediaDto,
  ): Promise<MediaResponseDto[]> {
    return this.eventsService.attachMedia(id, user.id, dto.mediaId);
  }

  @Delete(':id/media/:mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach media from a family event' })
  @ApiNoContentResponse()
  async detachEventMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<void> {
    await this.eventsService.detachMedia(id, user.id, mediaId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update and re-propose an event created by the current user' })
  @ApiOkResponse({ type: FamilyEventResponseDto })
  @ApiBadRequestResponse({
    description: 'No fields were provided or the date is not in the future',
  })
  @ApiForbiddenResponse({ description: 'Only the event creator can update it' })
  @ApiNotFoundResponse({ description: 'Event does not exist in the current user family' })
  @ApiConflictResponse({ description: 'The supplied version is stale' })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description: 'Current resource version. Omit for backward-compatible last-write-wins behavior.',
  })
  updateFamilyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyEventDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ): Promise<FamilyEventResponseDto> {
    return this.eventsService.update(id, user.id, dto, expectedVersion);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm an event proposed by the partner' })
  @ApiOkResponse({ type: FamilyEventResponseDto })
  @ApiConflictResponse({ description: 'The proposal was answered or its date has passed' })
  @ApiForbiddenResponse({ description: 'Only the partner can confirm the event' })
  confirmFamilyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyEventResponseDto> {
    return this.eventsService.confirm(id, user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject an event proposed by the partner' })
  @ApiOkResponse({ type: FamilyEventResponseDto })
  @ApiConflictResponse({ description: 'The proposal has already been answered' })
  @ApiForbiddenResponse({ description: 'Only the partner can reject the event' })
  rejectFamilyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyEventResponseDto> {
    return this.eventsService.reject(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an event created by the current user' })
  @ApiNoContentResponse({ description: 'Event hidden but retained in the database' })
  @ApiForbiddenResponse({ description: 'Only the event creator can delete it' })
  @ApiNotFoundResponse({ description: 'Event does not exist in the current user family' })
  async removeFamilyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.eventsService.remove(id, user.id);
  }
}
