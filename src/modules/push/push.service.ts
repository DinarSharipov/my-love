import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PushDevicePlatform } from '@prisma/client';
import { RegisterPushDeviceDto, PushDevicePlatformDto } from './dto/register-push-device.dto';
import { OutboxService } from '../../common/outbox/outbox.service';
import type { OutboxTransaction } from '../../common/outbox/outbox.types';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  enqueueChatMessagePush(
    tx: OutboxTransaction,
    input: {
      messageId: string;
      conversationId: string;
      senderId: string;
      recipientUserIds: string[];
      senderName: string;
      body: string;
      occurredAt: Date;
    },
  ): Promise<void> {
    return this.outbox.enqueuePush(tx, {
      schemaVersion: 1,
      eventId: randomUUID(),
      messageId: input.messageId,
      conversationId: input.conversationId,
      senderId: input.senderId,
      recipientUserIds: input.recipientUserIds,
      title: input.senderName,
      body: input.body,
      data: {
        type: 'chat_message',
        conversationId: input.conversationId,
        messageId: input.messageId,
        senderId: input.senderId,
      },
      occurredAt: input.occurredAt.toISOString(),
    });
  }

  async registerDevice(userId: string, dto: RegisterPushDeviceDto) {
    return this.prisma.pushDevice.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: this.toPlatform(dto.platform),
        appVersion: dto.appVersion?.trim() || null,
        lastSeenAt: new Date(),
      },
      update: {
        userId,
        platform: this.toPlatform(dto.platform),
        appVersion: dto.appVersion?.trim() || null,
        lastSeenAt: new Date(),
        disabledAt: null,
      },
      select: { id: true, platform: true, appVersion: true, lastSeenAt: true, createdAt: true },
    });
  }

  async disableDevice(userId: string, token: string): Promise<void> {
    const result = await this.prisma.pushDevice.updateMany({
      where: { userId, token },
      data: { disabledAt: new Date(), lastSeenAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Push device not found');
  }

  private toPlatform(platform: PushDevicePlatformDto): PushDevicePlatform {
    return platform === PushDevicePlatformDto.IOS
      ? PushDevicePlatform.IOS
      : PushDevicePlatform.ANDROID;
  }
}
