import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import { OutboxService } from '../outbox/outbox.service';
import { QuietHoursService } from './quiet-hours.service';

@Injectable()
export class NotificationProducerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly quietHours: QuietHoursService,
  ) {}

  async notifyUser(input: {
    userId: string;
    familyId?: string;
    type: string;
    title: string;
    body?: string;
  }): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, isActive: true },
      select: {
        locale: true,
        timeZone: true,
        notificationPreference: {
          select: {
            inAppEnabled: true,
            telegramEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
          },
        },
        telegramConnection: { select: { status: true } },
      },
    });
    if (!user) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (user.notificationPreference?.inAppEnabled !== false) {
        await tx.notification.create({
          data: {
            userId: input.userId,
            familyId: input.familyId,
            type: input.type,
            title: input.title,
            body: input.body,
          },
        });
      }
      if (
        user.notificationPreference?.telegramEnabled &&
        user.telegramConnection?.status === 'ACTIVE'
      ) {
        const availableAt = this.quietHours.nextAllowedAt(
          now,
          user.timeZone,
          user.notificationPreference,
        );
        await this.outbox.enqueueTelegram(tx, {
          eventId: randomUUID(),
          schemaVersion: 1,
          type: input.type,
          recipientUserId: input.userId,
          templateData: { title: input.title, ...(input.body ? { body: input.body } : {}) },
          locale: user.locale,
          timeZone: user.timeZone,
          occurredAt: now.toISOString(),
          availableAt: availableAt.toISOString(),
        });
      }
    });
  }

  async notifyFamilyMembers(input: {
    familyId: string;
    actorId: string;
    type: string;
    title: string;
    body?: string;
  }): Promise<void> {
    const members = await this.prisma.familyMember.findMany({
      where: { familyId: input.familyId },
      select: {
        userId: true,
        user: {
          select: {
            locale: true,
            timeZone: true,
            telegramConnection: { select: { status: true } },
          },
        },
      },
    });
    const recipients = members.filter((member) => member.userId !== input.actorId);
    if (!recipients.length) return;
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: recipients.map((member) => member.userId) } },
      select: {
        userId: true,
        inAppEnabled: true,
        telegramEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });
    const byUserId = new Map(preferences.map((preference) => [preference.userId, preference]));
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const member of recipients) {
        const preference = byUserId.get(member.userId);
        if (preference?.inAppEnabled !== false) {
          await tx.notification.create({
            data: {
              userId: member.userId,
              familyId: input.familyId,
              type: input.type,
              title: input.title,
              body: input.body,
            },
          });
        }
        const connection = member.user.telegramConnection;
        if (preference?.telegramEnabled && connection?.status === 'ACTIVE') {
          const availableAt = this.quietHours.nextAllowedAt(now, member.user.timeZone, preference);
          await this.outbox.enqueueTelegram(tx, {
            eventId: randomUUID(),
            schemaVersion: 1,
            type: input.type,
            recipientUserId: member.userId,
            templateData: { title: input.title, ...(input.body ? { body: input.body } : {}) },
            locale: member.user.locale,
            timeZone: member.user.timeZone,
            occurredAt: now.toISOString(),
            availableAt: availableAt.toISOString(),
          });
        }
      }
    });
  }
}
