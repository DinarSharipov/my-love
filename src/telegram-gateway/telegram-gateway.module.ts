import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackendTelegramClient } from './backend-telegram.client';
import { telegramGatewayEnvSchema } from './telegram-gateway.validation';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramGatewayController } from './telegram-gateway.controller';
import { TelegramGatewayService } from './telegram-gateway.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: telegramGatewayEnvSchema,
    }),
  ],
  controllers: [TelegramGatewayController],
  providers: [BackendTelegramClient, TelegramApiClient, TelegramGatewayService],
})
export class TelegramGatewayModule {}
