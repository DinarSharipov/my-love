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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiAcceptedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetRequestResponseDto } from './dto/password-reset-request-response.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { CancelAccountDeletionDto } from './dto/cancel-account-deletion.dto';
import { AccountDeletionRequestResponseDto } from './dto/account-deletion-request-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user and receive an access token' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body() dto: RegisterDto, @Req() request: Request): Promise<AuthResponseDto> {
    return this.authService.register(dto, this.sessionMetadata(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthResponseDto> {
    return this.authService.login(dto, this.sessionMetadata(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current access token' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.tokenHash);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request password reset instructions without revealing account existence',
  })
  @ApiAcceptedResponse({ type: PasswordResetRequestResponseDto })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<PasswordResetRequestResponseDto> {
    await this.authService.requestPasswordReset(dto);
    return { message: 'If the account exists, password reset instructions have been sent.' };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set a new password with a one-time password reset token' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'The reset token is invalid, expired, or already used' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  @Post('email-change/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a one-time confirmation link to a new email address' })
  @ApiAcceptedResponse({ description: 'Confirmation instructions have been queued' })
  @ApiForbiddenResponse({ description: 'The current password is incorrect' })
  @ApiConflictResponse({ description: 'Email is already registered or unchanged' })
  async requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
  ): Promise<void> {
    await this.authService.requestEmailChange(user.id, dto);
  }

  @Post('email-change/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm a new email address with a one-time token' })
  @ApiNoContentResponse({ description: 'Email changed and all sessions revoked' })
  @ApiBadRequestResponse({
    description: 'The confirmation token is invalid, expired, or already used',
  })
  @ApiConflictResponse({ description: 'Email became unavailable' })
  async confirmEmailChange(@Body() dto: ConfirmEmailChangeDto): Promise<void> {
    await this.authService.confirmEmailChange(dto);
  }

  @Post('account-deletion/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Deactivate the account and schedule deletion after a recovery grace period',
  })
  @ApiAcceptedResponse({ type: AccountDeletionRequestResponseDto })
  @ApiForbiddenResponse({ description: 'The current password is incorrect' })
  async requestAccountDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestAccountDeletionDto,
  ): Promise<AccountDeletionRequestResponseDto> {
    return this.authService.requestAccountDeletion(user.id, dto);
  }

  @Post('account-deletion/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Restore a deactivated account using its one-time recovery link' })
  @ApiNoContentResponse({ description: 'Account restored; sign in again to create a new session' })
  @ApiBadRequestResponse({ description: 'The recovery token is invalid, expired, or already used' })
  async cancelAccountDeletion(@Body() dto: CancelAccountDeletionDto): Promise<void> {
    await this.authService.cancelAccountDeletion(dto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions of the current user' })
  @ApiOkResponse({ type: [AuthSessionResponseDto] })
  listSessions(@CurrentUser() user: AuthenticatedUser): Promise<AuthSessionResponseDto[]> {
    return this.authService.listSessions(user.id, user.tokenHash);
  }

  @Delete('sessions/others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke every session except the current one' })
  @ApiNoContentResponse()
  async revokeOtherSessions(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.revokeOtherSessions(user.id, user.tokenHash);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke one session owned by the current user' })
  @ApiNoContentResponse()
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.authService.revokeSession(user.id, id);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change password and revoke all other sessions' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'The current password is incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, user.tokenHash, dto);
  }

  private sessionMetadata(request: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: request.ip?.slice(0, 45),
      userAgent: request.get('user-agent')?.slice(0, 512),
    };
  }
}
