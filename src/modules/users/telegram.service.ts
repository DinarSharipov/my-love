import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TelegramService {
  constructor(private readonly prisma: PrismaService) {}
  async createLinkToken(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.telegramLinkToken.deleteMany({ where: { userId } });
    await this.prisma.telegramLinkToken.create({
      data: { userId, tokenHash: this.hash(token), expiresAt },
    });
    return { token, expiresAt };
  }
  async exchange(token: string, telegramUserId: string, chatId: string) {
    const now = new Date();
    const connection = await this.prisma.$transaction(async (tx) => {
      const record = await tx.telegramLinkToken.findUnique({
        where: { tokenHash: this.hash(token) },
      });
      if (!record || record.usedAt || record.expiresAt <= now)
        throw new NotFoundException('Link token is invalid or expired');
      const claimed = await tx.telegramLinkToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new NotFoundException('Link token is invalid or expired');
      const existing = await tx.telegramConnection.findFirst({
        where: { OR: [{ telegramUserId }, { chatId }] },
      });
      if (existing && existing.userId !== record.userId)
        throw new ConflictException('Telegram account is already linked');
      const linked = await tx.telegramConnection.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, telegramUserId, chatId },
        update: { telegramUserId, chatId, status: 'ACTIVE', revokedAt: null },
      });
      await tx.notificationPreference.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, telegramEnabled: true },
        update: { telegramEnabled: true },
      });
      return linked;
    });
    return { linked: true, connectionId: connection.id };
  }
  status(userId: string) {
    return this.prisma.telegramConnection.findUnique({
      where: { userId },
      select: {
        id: true,
        telegramUserId: true,
        status: true,
        linkedAt: true,
        revokedAt: true,
      },
    });
  }
  async unlink(userId: string) {
    await this.prisma.telegramConnection.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.prisma.notificationPreference.updateMany({
      where: { userId },
      data: { telegramEnabled: false },
    });
  }
  statusByTelegram(telegramUserId: string) {
    return this.prisma.telegramConnection.findUnique({
      where: { telegramUserId },
      select: { status: true, linkedAt: true, revokedAt: true },
    });
  }
  async unlinkByTelegram(telegramUserId: string) {
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramUserId },
      select: { userId: true },
    });
    if (!connection) return;
    await this.unlink(connection.userId);
  }
  async notificationsByTelegram(telegramUserId: string) {
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramUserId },
      select: { userId: true, status: true },
    });
    if (!connection || connection.status !== 'ACTIVE') return [];
    return this.prisma.notification.findMany({
      where: { userId: connection.userId, readAt: null },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true, type: true, title: true, body: true, createdAt: true },
    });
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
