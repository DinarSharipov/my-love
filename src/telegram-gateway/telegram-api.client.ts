import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramApiClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    const token = config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Telegram API request failed with status ${response.status}`);
  }
}
