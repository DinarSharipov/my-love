import {
  Body,
  Controller,
  Get,
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateFamilyInvitationDto } from './dto/create-family-invitation.dto';
import { FamilyInvitationResponseDto } from './dto/family-invitation-response.dto';
import { FamilyInvitationsService } from './family-invitations.service';

@ApiTags('family invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'family-invitations', version: '1' })
export class FamilyInvitationsController {
  constructor(private readonly invitationsService: FamilyInvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Invite another user to create a family' })
  @ApiCreatedResponse({ type: FamilyInvitationResponseDto })
  @ApiConflictResponse({ description: 'A user is unavailable or an invitation already exists' })
  createFamilyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFamilyInvitationDto,
  ): Promise<FamilyInvitationResponseDto> {
    return this.invitationsService.create(user.id, dto);
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
