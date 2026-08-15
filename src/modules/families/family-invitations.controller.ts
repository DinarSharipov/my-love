import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AcceptPrivateFamilyInvitationDto } from './dto/accept-private-family-invitation.dto';
import { CreateFamilyInvitationDto } from './dto/create-family-invitation.dto';
import { CreatePrivateFamilyInvitationDto } from './dto/create-private-family-invitation.dto';
import { FamilyInvitationResponseDto } from './dto/family-invitation-response.dto';
import {
  CreatedPrivateFamilyInvitationResponseDto,
  PrivateFamilyInvitationResponseDto,
} from './dto/private-family-invitation-response.dto';
import { FamilyInvitationsService } from './family-invitations.service';

@ApiTags('family invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'family-invitations', version: '1' })
export class FamilyInvitationsController {
  constructor(private readonly invitationsService: FamilyInvitationsService) {}

  @Post()
  @Idempotent('family-invitations.create')
  @ApiOperation({ summary: 'Invite another user to create a family' })
  @ApiCreatedResponse({ type: FamilyInvitationResponseDto })
  @ApiConflictResponse({ description: 'A user is unavailable or an invitation already exists' })
  createFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFamilyInvitationDto,
  ): Promise<FamilyInvitationResponseDto> {
    return this.invitationsService.create(user.id, dto);
  }

  @Post('private')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a closed one-time invitation link for an exact email' })
  @ApiCreatedResponse({ type: CreatedPrivateFamilyInvitationResponseDto })
  @ApiConflictResponse({ description: 'The sender cannot create an invitation' })
  @ApiTooManyRequestsResponse({ description: 'The resend cooldown has not elapsed' })
  createPrivateFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePrivateFamilyInvitationDto,
  ): Promise<CreatedPrivateFamilyInvitationResponseDto> {
    return this.invitationsService.createPrivate(user.id, dto);
  }

  @Get('private/outgoing')
  @ApiOperation({ summary: 'Get closed invitations created by the current user' })
  @ApiOkResponse({ type: [PrivateFamilyInvitationResponseDto] })
  findOutgoingPrivateFamilyInvitations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PrivateFamilyInvitationResponseDto[]> {
    return this.invitationsService.findOutgoingPrivate(user.id);
  }

  @Post('private/accept')
  @HttpCode(HttpStatus.OK)
  @Idempotent('family-invitations.private.accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Accept a closed invitation using its one-time token' })
  @ApiOkResponse({ type: PrivateFamilyInvitationResponseDto })
  @ApiForbiddenResponse({ description: 'The invitation targets another email' })
  @ApiGoneResponse({ description: 'The invitation has expired' })
  acceptPrivateFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptPrivateFamilyInvitationDto,
  ): Promise<PrivateFamilyInvitationResponseDto> {
    return this.invitationsService.acceptPrivate(user.id, dto);
  }

  @Patch('private/:id/revoke')
  @ApiOperation({ summary: 'Revoke a closed invitation link' })
  @ApiOkResponse({ type: PrivateFamilyInvitationResponseDto })
  revokePrivateFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrivateFamilyInvitationResponseDto> {
    return this.invitationsService.revokePrivate(id, user.id);
  }

  @Get('incoming')
  @ApiOperation({ summary: 'Get invitations received by the current user' })
  @ApiOkResponse({ type: [FamilyInvitationResponseDto] })
  findIncomingInvitations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyInvitationResponseDto[]> {
    return this.invitationsService.findIncoming(user.id);
  }

  @Get('outgoing')
  @ApiOperation({ summary: 'Get invitations sent by the current user' })
  @ApiOkResponse({ type: [FamilyInvitationResponseDto] })
  findOutgoingInvitations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyInvitationResponseDto[]> {
    return this.invitationsService.findOutgoing(user.id);
  }

  @Patch(':id/accept')
  @Idempotent('family-invitations.accept')
  @ApiOperation({ summary: 'Accept an invitation and create a family' })
  @ApiOkResponse({ type: FamilyInvitationResponseDto })
  acceptFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyInvitationResponseDto> {
    return this.invitationsService.accept(id, user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a received invitation' })
  @ApiOkResponse({ type: FamilyInvitationResponseDto })
  rejectFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyInvitationResponseDto> {
    return this.invitationsService.reject(id, user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a sent invitation' })
  @ApiOkResponse({ type: FamilyInvitationResponseDto })
  cancelFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyInvitationResponseDto> {
    return this.invitationsService.cancel(id, user.id);
  }
}
