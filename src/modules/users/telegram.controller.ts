import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { TelegramService } from './telegram.service';
import {
  ExchangeTelegramLinkDto,
  TelegramConnectionResponseDto,
  TelegramIntegrationConnectionResponseDto,
  TelegramIntegrationQueryDto,
  TelegramLinkExchangeResponseDto,
  TelegramLinkTokenResponseDto,
} from './dto/telegram.dto';

@ApiTags('telegram')
@Controller({ path: 'telegram', version: '1' })
export class TelegramController {
  constructor(
    private readonly service: TelegramService,
    private readonly config: ConfigService,
  ) {}
  @Post('link-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: TelegramLinkTokenResponseDto })
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.service.createLinkToken(user.id);
  }
  @Get('connection')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: TelegramConnectionResponseDto })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.status(user.id);
  }
  @Delete('connection')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  unlink(@CurrentUser() user: AuthenticatedUser) {
    return this.service.unlink(user.id);
  }
  @Post('link/exchange')
  @ApiCreatedResponse({ type: TelegramLinkExchangeResponseDto })
  exchange(@Body() body: ExchangeTelegramLinkDto) {
    return this.service.exchange(body.token, body.telegramUserId, body.chatId);
  }
  @ApiOkResponse({ type: TelegramIntegrationConnectionResponseDto })
  @Get('integration/connection')
  integrationStatus(
    @Query() query: TelegramIntegrationQueryDto,
    @Headers('x-telegram-integration-secret') secret: string,
  ) {
    this.authorize(secret);
    return this.service.statusByTelegram(query.telegramUserId);
  }
  @Delete('integration/connection') @HttpCode(HttpStatus.NO_CONTENT) async integrationUnlink(
    @Query() query: TelegramIntegrationQueryDto,
    @Headers('x-telegram-integration-secret') secret: string,
  ) {
    this.authorize(secret);
    await this.service.unlinkByTelegram(query.telegramUserId);
  }
  @Get('integration/notifications')
  integrationNotifications(
    @Query() query: TelegramIntegrationQueryDto,
    @Headers('x-telegram-integration-secret') secret: string,
  ) {
    this.authorize(secret);
    return this.service.notificationsByTelegram(query.telegramUserId);
  }
  private authorize(secret: string) {
    if (!this.config.get<boolean>('TELEGRAM_INTEGRATION_ENABLED', false)) {
      throw new ServiceUnavailableException('Telegram integration is disabled');
    }
    const expected = this.config.get<string>('TELEGRAM_INTEGRATION_SECRET');
    if (!secret || !expected || secret !== expected) throw new UnauthorizedException();
  }
}
