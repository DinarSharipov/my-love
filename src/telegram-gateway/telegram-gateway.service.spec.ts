import { BackendRequestError, BackendTelegramClient } from './backend-telegram.client';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramGatewayService } from './telegram-gateway.service';

describe('TelegramGatewayService', () => {
  const backend = {
    exchange: jest.fn(),
    status: jest.fn(),
    unlink: jest.fn(),
    notifications: jest.fn(),
  };
  const telegram = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  let service: TelegramGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TelegramGatewayService(
      backend as unknown as BackendTelegramClient,
      telegram as unknown as TelegramApiClient,
    );
  });

  it('exchanges a link token from a private Telegram command', async () => {
    backend.exchange.mockResolvedValue({ linked: true });

    await service.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 456, type: 'private' },
        from: { id: 123, is_bot: false },
        text: '/link abc-token',
      },
    });

    expect(backend.exchange).toHaveBeenCalledWith('abc-token', '123', '456');
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      '456',
      'Аккаунт привязан. Уведомления Telegram включены.',
    );
  });

  it('supports the explicit /auth command', async () => {
    backend.exchange.mockResolvedValue({ linked: true });

    await service.handleUpdate({
      update_id: 6,
      message: {
        message_id: 6,
        chat: { id: 456, type: 'private' },
        from: { id: 123, is_bot: false },
        text: '/auth one-time-code',
      },
    });

    expect(backend.exchange).toHaveBeenCalledWith('one-time-code', '123', '456');
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      '456',
      'Аккаунт привязан. Уведомления Telegram включены.',
    );
  });

  it('keeps an already linked Telegram user authorized on later /start commands', async () => {
    backend.status.mockResolvedValue({
      status: 'ACTIVE',
      linkedAt: '2026-08-15T12:00:00.000Z',
      revokedAt: null,
    });

    await service.handleUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        chat: { id: 456, type: 'private' },
        from: { id: 123, is_bot: false },
        text: '/start',
      },
    });

    expect(backend.status).toHaveBeenCalledWith('123');
    expect(backend.exchange).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      '456',
      'Вы уже авторизованы. Повторная привязка не требуется.',
    );
  });

  it('asks an unlinked Telegram user for a one-time link code', async () => {
    backend.status.mockResolvedValue(null);

    await service.handleUpdate({
      update_id: 5,
      message: {
        message_id: 5,
        chat: { id: 456, type: 'private' },
        from: { id: 123, is_bot: false },
        text: '/start',
      },
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      '456',
      'Создайте код привязки в приложении и отправьте /link КОД',
    );
  });

  it('does not process commands from group chats', async () => {
    await service.handleUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        chat: { id: -456, type: 'group' },
        from: { id: 123, is_bot: false },
        text: '/status',
      },
    });

    expect(backend.status).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('returns a safe message for an expired link token', async () => {
    backend.exchange.mockRejectedValue(new BackendRequestError(404));

    await service.handleUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        chat: { id: 456, type: 'private' },
        from: { id: 123, is_bot: false },
        text: '/start expired-token',
      },
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith('456', 'Ссылка недействительна или истекла.');
  });

  it('renders an internal notification without exposing metadata', async () => {
    await service.deliver({
      eventId: '6caa5c45-3291-4bc0-8474-8ff1396409dc',
      schemaVersion: 1,
      type: 'TASK_CREATED',
      recipientUserId: 'df4881ce-abf0-463c-bdb9-7477f9b18596',
      recipientChatId: '456',
      templateData: { title: 'Новая задача', body: 'Купить молоко' },
      locale: 'ru-RU',
      timeZone: 'Europe/Moscow',
      occurredAt: '2026-08-15T12:00:00.000Z',
      availableAt: '2026-08-15T12:00:00.000Z',
    });

    expect(telegram.sendMessage).toHaveBeenCalledWith('456', 'Новая задача\nКупить молоко');
  });
});
