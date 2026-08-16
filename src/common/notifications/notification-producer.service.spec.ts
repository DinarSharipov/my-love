import { OutboxService } from '../outbox/outbox.service';
import { NotificationProducerService } from './notification-producer.service';

describe('NotificationProducerService', () => {
  it('creates inbox and Telegram outbox messages for an active linked recipient', async () => {
    const tx = { notification: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          locale: 'ru-RU',
          timeZone: 'Europe/Moscow',
          notificationPreference: { inAppEnabled: true, telegramEnabled: true },
          telegramConnection: { status: 'ACTIVE' },
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const outbox = { enqueueTelegram: jest.fn().mockResolvedValue({}) };
    const service = new NotificationProducerService(prisma as never, outbox as never);

    await service.notifyUser({
      userId: 'user-id',
      familyId: 'family-id',
      type: 'FAMILY_EVENT_PROPOSED',
      title: 'Новое событие',
    });

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        familyId: 'family-id',
        type: 'FAMILY_EVENT_PROPOSED',
        title: 'Новое событие',
      },
    });
    expect(outbox.enqueueTelegram).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientUserId: 'user-id',
        type: 'FAMILY_EVENT_PROPOSED',
        locale: 'ru-RU',
        timeZone: 'Europe/Moscow',
      }),
    );
  });

  it('does not enqueue Telegram when the user has no active connection', async () => {
    const tx = { notification: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          locale: 'ru-RU',
          timeZone: 'Europe/Moscow',
          notificationPreference: { inAppEnabled: true, telegramEnabled: true },
          telegramConnection: { status: 'REVOKED' },
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const enqueueTelegram = jest.fn();
    const outbox = { enqueueTelegram } as unknown as OutboxService;
    const service = new NotificationProducerService(prisma as never, outbox);

    await service.notifyUser({
      userId: 'user-id',
      type: 'FAMILY_INVITATION_CREATED',
      title: 'Приглашение',
    });

    expect(enqueueTelegram).not.toHaveBeenCalled();
  });
});
