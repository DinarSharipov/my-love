import { ConfigService } from '@nestjs/config';
import { HttpTelegramProvider } from './http-telegram.provider';
import type { TelegramDeliveryMessage } from './outbox.types';

describe('HttpTelegramProvider', () => {
  const message: TelegramDeliveryMessage = {
    eventId: 'event-id',
    schemaVersion: 1,
    type: 'TASK_ASSIGNED',
    recipientUserId: 'user-id',
    recipientChatId: 'chat-id',
    templateData: { taskTitle: 'Купить продукты' },
    locale: 'ru',
    timeZone: 'Europe/Moscow',
    occurredAt: '2026-08-25T10:00:00.000Z',
    availableAt: '2026-08-25T10:00:00.000Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the versioned delivery envelope to the configured transport', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 202 } as Response);
    const provider = createProvider({
      TELEGRAM_DELIVERY_URL: 'https://bot.example.test/internal/telegram/deliver',
      TELEGRAM_INTEGRATION_SECRET: 'test-integration-secret',
    });

    await expect(provider.send(message)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bot.example.test/internal/telegram/deliver',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-integration-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify(message),
      }),
    );
  });

  it('fails so the outbox can retry when transport rejects delivery', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
    const provider = createProvider({
      TELEGRAM_DELIVERY_URL: 'https://bot.example.test/internal/telegram/deliver',
      TELEGRAM_INTEGRATION_SECRET: 'test-integration-secret',
    });

    await expect(provider.send(message)).rejects.toThrow(
      'Telegram delivery failed with status 503',
    );
  });

  it('fails closed without a configured URL or integration secret', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const provider = createProvider({});

    await expect(provider.send(message)).rejects.toThrow(
      'Telegram HTTP provider is not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function createProvider(values: Record<string, string>): HttpTelegramProvider {
  return new HttpTelegramProvider({
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService);
}
