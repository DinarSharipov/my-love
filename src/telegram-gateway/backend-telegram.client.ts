import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BackendTelegramClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('BACKEND_API_URL').replace(/\/$/, '');
    this.secret = config.getOrThrow<string>('TELEGRAM_INTEGRATION_SECRET');
  }

  exchange(token: string, telegramUserId: string, chatId: string) {
    return this.request<{ linked: boolean; connectionId: string }>('/telegram/link/exchange', {
      method: 'POST',
      body: JSON.stringify({ token, telegramUserId, chatId }),
    });
  }

  status(telegramUserId: string) {
    return this.request<{ status: string; linkedAt: string; revokedAt: string | null } | null>(
      `/telegram/integration/connection?telegramUserId=${encodeURIComponent(telegramUserId)}`,
    );
  }

  unlink(telegramUserId: string) {
    return this.request<void>(
      `/telegram/integration/connection?telegramUserId=${encodeURIComponent(telegramUserId)}`,
      { method: 'DELETE' },
    );
  }

  notifications(telegramUserId: string) {
    return this.request<Array<{ title: string; body: string | null; createdAt: string }>>(
      `/telegram/integration/notifications?telegramUserId=${encodeURIComponent(telegramUserId)}`,
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-telegram-integration-secret': this.secret,
        ...init.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new BackendRequestError(response.status);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export class BackendRequestError extends Error {
  constructor(readonly status: number) {
    super(`Backend request failed with status ${status}`);
  }
}
