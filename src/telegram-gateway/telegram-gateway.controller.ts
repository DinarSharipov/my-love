import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramNotificationDto } from './dto/telegram-notification.dto';
import { TelegramWebhookDto } from './dto/telegram-webhook.dto';
import { TelegramGatewayService } from './telegram-gateway.service';

@Controller()
export class TelegramGatewayController {
  constructor(
    private readonly service: TelegramGatewayService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  async webhook(
    @Body() update: TelegramWebhookDto,
    @Headers('x-telegram-bot-api-secret-token') secret: string,
  ) {
    if (secret !== this.config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET'))
      throw new UnauthorizedException();
    await this.service.handleUpdate(update);
  }

  @Post('internal/notifications')
  @HttpCode(HttpStatus.NO_CONTENT)
  async notification(
    @Body() body: TelegramNotificationDto,
    @Headers('authorization') auth: string,
  ) {
    const expected = this.config.getOrThrow<string>('TELEGRAM_INTEGRATION_SECRET');
    if (auth !== `Bearer ${expected}`) throw new UnauthorizedException();
    await this.service.deliver(body);
  }
}
