import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'node:crypto';
import { OutboxService } from '../outbox/outbox.service';
import { QuietHoursService } from './quiet-hours.service';
import type { OutboxTransaction } from '../outbox/outbox.types';

export interface DomainNotification {
  userId: string;
  familyId?: string;
  type: string;
  title: string;
  body?: string;
}

@Injectable()
export class NotificationProducerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly quietHours: QuietHoursService,
  ) {}

  async notifyUser(input: DomainNotification): Promise<void> {
    await this.prisma.$transaction((tx) => this.notifyUserInTransaction(tx, input));
  }

  /**
   * Use from a domain transaction that changes the source entity (for example,
   * claiming a due reminder). This keeps the inbox item and Telegram outbox
   * record atomic with that source-state change.
   */
  async notifyUserInTransaction(
    tx: OutboxTransaction,
    input: DomainNotification,
    now = new Date(),
  ): Promise<void> {
    const user = await tx.user.findFirst({
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

    await this.dispatchToRecipient(tx, input, user, now);
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
        await this.dispatchToRecipient(
          tx,
          { ...input, userId: member.userId },
          { ...member.user, notificationPreference: preference },
          now,
        );
      }
    });
  }

  private async dispatchToRecipient(
    tx: OutboxTransaction,
    input: DomainNotification,
    user: {
      locale: string;
      timeZone: string;
      notificationPreference:
        | {
            inAppEnabled?: boolean;
            telegramEnabled: boolean;
            quietHoursEnabled: boolean;
            quietHoursStart: string | null;
            quietHoursEnd: string | null;
          }
        | null
        | undefined;
      telegramConnection: { status: string } | null;
    },
    now: Date,
  ): Promise<void> {
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
  }
}
