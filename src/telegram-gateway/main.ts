import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { TelegramGatewayModule } from './telegram-gateway.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(TelegramGatewayModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
  );
  await app.listen(config.get<number>('TELEGRAM_GATEWAY_PORT', 3000), '0.0.0.0');
}

void bootstrap();
