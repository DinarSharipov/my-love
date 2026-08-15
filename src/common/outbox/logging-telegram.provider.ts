import { Injectable, Logger } from '@nestjs/common';
import type { TelegramDeliveryMessage } from './outbox.types';
import type { TelegramProvider } from './telegram.provider';

@Injectable()
export class LoggingTelegramProvider implements TelegramProvider {
  private readonly logger = new Logger(LoggingTelegramProvider.name);

  send(message: TelegramDeliveryMessage): Promise<void> {
    // Do not log chat identifiers or notification content.
    void message;
    this.logger.log({ event: 'telegram_delivery_simulated' });
    return Promise.resolve();
  }
}
