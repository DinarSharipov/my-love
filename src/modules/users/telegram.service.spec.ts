import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  const tokenRecord = {
    id: 'token-id',
    userId: 'user-id',
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };

  function setup(overrides?: { claimed?: number; existingUserId?: string }) {
    const tx = {
      telegramLinkToken: {
        findUnique: jest.fn().mockResolvedValue(tokenRecord),
        updateMany: jest.fn().mockResolvedValue({ count: overrides?.claimed ?? 1 }),
      },
      telegramConnection: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            overrides?.existingUserId ? { userId: overrides.existingUserId } : null,
          ),
        upsert: jest.fn().mockResolvedValue({ id: 'connection-id' }),
      },
      notificationPreference: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { tx, service: new TelegramService(prisma as unknown as PrismaService) };
  }

  it('claims the token and enables Telegram in the same transaction', async () => {
    const { service, tx } = setup();

    await expect(service.exchange('a'.repeat(43), 'telegram-id', 'chat-id')).resolves.toEqual({
      linked: true,
      connectionId: 'connection-id',
    });
    expect(tx.telegramLinkToken.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: tokenRecord.userId },
      create: { userId: tokenRecord.userId, telegramEnabled: true },
      update: { telegramEnabled: true },
    });
  });

  it('rejects a token lost to a concurrent exchange', async () => {
    const { service, tx } = setup({ claimed: 0 });

    await expect(service.exchange('a'.repeat(43), 'telegram-id', 'chat-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.telegramConnection.upsert).not.toHaveBeenCalled();
  });

  it('does not attach a Telegram identity linked to another user', async () => {
    const { service, tx } = setup({ existingUserId: 'other-user-id' });

    await expect(service.exchange('a'.repeat(43), 'telegram-id', 'chat-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.telegramConnection.upsert).not.toHaveBeenCalled();
  });
});
