import { NotFoundException } from '@nestjs/common';
import { PushDevicePlatform } from '@prisma/client';
import { PushService } from './push.service';
import { PushDevicePlatformDto } from './dto/register-push-device.dto';

describe('PushService', () => {
  const prisma = {
    pushDevice: { upsert: jest.fn(), updateMany: jest.fn() },
  };
  const outbox = { enqueuePush: jest.fn() };
  const service = new PushService(prisma as never, outbox as never);

  beforeEach(() => jest.clearAllMocks());

  it('upserts a device idempotently without returning the token', async () => {
    prisma.pushDevice.upsert.mockResolvedValue({
      id: 'device-1',
      platform: PushDevicePlatform.ANDROID,
      appVersion: '1.2.3',
      lastSeenAt: new Date(),
      createdAt: new Date(),
    });

    const result: {
      id: string;
      platform: PushDevicePlatform;
      appVersion: string | null;
      lastSeenAt: Date;
      createdAt: Date;
    } = await service.registerDevice('user-1', {
      token: 'fcm-token',
      platform: PushDevicePlatformDto.ANDROID,
      appVersion: ' 1.2.3 ',
    });

    expect(result).not.toHaveProperty('token');
    expect(prisma.pushDevice.upsert).toHaveBeenCalledTimes(1);
  });

  it("does not allow disabling another user's token", async () => {
    prisma.pushDevice.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.disableDevice('user-1', 'foreign-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', token: 'foreign-token' } }),
    );
  });

  it('queues a retry-safe chat push payload with a message dedupe key', async () => {
    await service.enqueueChatMessagePush({} as never, {
      messageId: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'sender-1',
      recipientUserIds: ['recipient-1'],
      senderName: 'Sender User',
      body: 'Hello',
      occurredAt: new Date('2026-08-27T10:00:00.000Z'),
    });

    expect(outbox.enqueuePush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageId: 'message-1',
        recipientUserIds: ['recipient-1'],
        data: {
          type: 'chat_message',
          conversationId: 'conversation-1',
          messageId: 'message-1',
          senderId: 'sender-1',
        },
      }),
    );
  });
});
