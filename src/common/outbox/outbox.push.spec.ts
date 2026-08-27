import { OutboxEventStatus } from '@prisma/client';
import { OutboxService } from './outbox.service';

describe('OutboxService push delivery', () => {
  const prisma = {
    pushDevice: { findMany: jest.fn(), updateMany: jest.fn() },
    outboxEvent: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const pushProvider = { sendToDevices: jest.fn() };
  const config = { get: jest.fn((key: string, fallback?: unknown) => fallback) };
  const service = new OutboxService(
    prisma as never,
    config as never,
    {} as never,
    {} as never,
    pushProvider,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.pushDevice.findMany.mockResolvedValue([
      { id: 'device-1', token: 'secret-token', platform: 'ANDROID' },
    ]);
    prisma.pushDevice.updateMany.mockResolvedValue({ count: 1 });
  });

  it('disables invalid tokens after a successful FCM multicast', async () => {
    pushProvider.sendToDevices.mockResolvedValue({ invalidDeviceIds: ['device-1'] });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'outbox-1',
      status: OutboxEventStatus.PROCESSING,
      attempts: 0,
    });

    // Delivery is exercised through the private method to isolate provider behavior.
    await (
      service as unknown as {
        deliver: (id: string, type: string, payload: unknown) => Promise<void>;
      }
    ).deliver('outbox-1', 'push.notify', {
      schemaVersion: 1,
      eventId: 'event-1',
      messageId: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'sender-1',
      recipientUserIds: ['recipient-1'],
      title: 'Sender',
      body: 'Hello',
      data: { type: 'chat_message' },
      occurredAt: new Date().toISOString(),
    });

    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['device-1'] } } }),
    );
  });

  it('does not throw when the provider fails; outbox records a retry', async () => {
    pushProvider.sendToDevices.mockRejectedValue(new Error('FCM unavailable'));
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'outbox-1',
      status: OutboxEventStatus.PROCESSING,
      attempts: 0,
    });

    await expect(
      (
        service as unknown as {
          deliver: (id: string, type: string, payload: unknown) => Promise<void>;
        }
      ).deliver('outbox-1', 'push.notify', {
        schemaVersion: 1,
        eventId: 'event-1',
        messageId: 'message-1',
        conversationId: 'conversation-1',
        senderId: 'sender-1',
        recipientUserIds: ['recipient-1'],
        title: 'Sender',
        body: 'Hello',
        data: { type: 'chat_message' },
        occurredAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
    expect(prisma.outboxEvent.update).toHaveBeenCalled();
  });
});
