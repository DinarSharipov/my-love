import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelegramDeliveryMessage } from './outbox.types';
import type { TelegramProvider } from './telegram.provider';

@Injectable()
export class HttpTelegramProvider implements TelegramProvider {
  private readonly url?: string;
  private readonly secret?: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('TELEGRAM_DELIVERY_URL');
    this.secret = config.get<string>('TELEGRAM_INTEGRATION_SECRET');
  }

  async send(message: TelegramDeliveryMessage): Promise<void> {
    if (!this.url || !this.secret) throw new Error('Telegram HTTP provider is not configured');
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Telegram delivery failed with status ${response.status}`);
  }
}
