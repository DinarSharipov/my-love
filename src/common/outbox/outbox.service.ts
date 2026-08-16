import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EMAIL_PROVIDER, type EmailProvider } from './email.provider';
import {
  OUTBOX_EVENT_TYPE,
  type EmailOutboxPayload,
  type OutboxTransaction,
  type TelegramNotificationEnvelope,
} from './outbox.types';
import { PayloadEncryptionService } from './payload-encryption.service';
import { TELEGRAM_PROVIDER, type TelegramProvider } from './telegram.provider';
import { QuietHoursService } from '../notifications/quiet-hours.service';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(TELEGRAM_PROVIDER) private readonly telegramProvider: TelegramProvider,
    private readonly encryption: PayloadEncryptionService,
    private readonly quietHours: QuietHoursService,
  ) {
    this.maxAttempts = config.get<number>('OUTBOX_MAX_ATTEMPTS', 5);
  }

  enqueueEmail(tx: OutboxTransaction, payload: EmailOutboxPayload): Promise<void> {
    return tx.outboxEvent
      .create({
        data: {
          type: OUTBOX_EVENT_TYPE.EMAIL,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      })
      .then(() => undefined);
  }

  enqueueEncryptedEmail(
    tx: OutboxTransaction,
    payload: Required<Pick<EmailOutboxPayload, 'to' | 'subject' | 'text'>>,
  ): Promise<void> {
    return this.enqueueEmail(tx, {
      to: payload.to,
      subject: payload.subject,
      encryptedText: this.encryption.encrypt(payload.text),
    });
  }

  enqueueTelegram(tx: OutboxTransaction, payload: TelegramNotificationEnvelope): Promise<void> {
    return tx.outboxEvent
      .create({
        data: {
          type: OUTBOX_EVENT_TYPE.TELEGRAM,
          payload: payload as unknown as Prisma.InputJsonValue,
          availableAt: new Date(payload.availableAt),
        },
      })
      .then(() => undefined);
  }

  async processAvailable(limit = 20): Promise<number> {
    let processed = 0;
    for (let index = 0; index < limit; index += 1) {
      const event = await this.claimNext();
      if (!event) break;
      processed += 1;
      await this.deliver(event.id, event.type, event.payload);
    }
    return processed;
  }

  private async claimNext() {
    const now = new Date();
    const staleLockBefore = new Date(
      now.getTime() - this.config.get<number>('OUTBOX_LOCK_TIMEOUT_MS', 300_000),
    );
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.outboxEvent.findFirst({
        where: {
          OR: [
            { status: OutboxEventStatus.PENDING, availableAt: { lte: now } },
            { status: OutboxEventStatus.PROCESSING, lockedAt: { lte: staleLockBefore } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!event) return null;
      const claimed = await tx.outboxEvent.updateMany({
        where: {
          id: event.id,
          ...(event.status === OutboxEventStatus.PENDING
            ? { status: OutboxEventStatus.PENDING }
            : { status: OutboxEventStatus.PROCESSING, lockedAt: { lte: staleLockBefore } }),
        },
        data: { status: OutboxEventStatus.PROCESSING, lockedAt: now },
      });
      return claimed.count === 1 ? event : null;
    });
  }

  private async deliver(id: string, type: string, payload: Prisma.JsonValue): Promise<void> {
    try {
      if (type === OUTBOX_EVENT_TYPE.EMAIL) {
        await this.emailProvider.send(this.parseEmailPayload(payload));
      } else if (type === OUTBOX_EVENT_TYPE.TELEGRAM) {
        const message = this.parseTelegramPayload(payload);
        const recipient = await this.prisma.telegramConnection.findFirst({
          where: {
            userId: message.recipientUserId,
            status: 'ACTIVE',
            user: { notificationPreference: { telegramEnabled: true } },
          },
          select: {
            chatId: true,
            user: {
              select: {
                timeZone: true,
                notificationPreference: {
                  select: {
                    quietHoursEnabled: true,
                    quietHoursStart: true,
                    quietHoursEnd: true,
                  },
                },
              },
            },
          },
        });
        if (recipient) {
          const now = new Date();
          const availableAt = this.quietHours.nextAllowedAt(
            now,
            recipient.user.timeZone,
            recipient.user.notificationPreference,
          );
          if (availableAt.getTime() > now.getTime()) {
            await this.deferTelegram(id, message, availableAt);
            return;
          }
          await this.telegramProvider.send({ ...message, recipientChatId: recipient.chatId });
        }
      } else {
        throw new Error(`Unsupported outbox event type: ${type}`);
      }
      await this.prisma.outboxEvent.updateMany({
        where: { id, status: OutboxEventStatus.PROCESSING },
        data: { status: OutboxEventStatus.DELIVERED, deliveredAt: new Date(), lockedAt: null },
      });
      this.logger.log({ event: 'outbox_event_delivered', outboxEventId: id, type });
    } catch (error) {
      await this.fail(id, error);
    }
  }

  private async deferTelegram(
    id: string,
    message: TelegramNotificationEnvelope,
    availableAt: Date,
  ): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PROCESSING },
      data: {
        status: OutboxEventStatus.PENDING,
        availableAt,
        lockedAt: null,
        payload: {
          ...message,
          availableAt: availableAt.toISOString(),
        },
      },
    });
  }

  private async fail(id: string, error: unknown): Promise<void> {
    const event = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!event || event.status !== OutboxEventStatus.PROCESSING) return;
    const attempts = event.attempts + 1;
    const exhausted = attempts >= this.maxAttempts;
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
    const message =
      error instanceof Error ? error.message.slice(0, 500) : 'Unknown delivery failure';
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts,
        status: exhausted ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
        availableAt: new Date(Date.now() + delayMs),
        lockedAt: null,
        lastError: message,
      },
    });
    this.logger.warn({ event: 'outbox_event_failed', outboxEventId: id, attempts, exhausted });
  }

  private parseEmailPayload(
    payload: Prisma.JsonValue,
  ): Required<Pick<EmailOutboxPayload, 'to' | 'subject' | 'text'>> {
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      typeof payload.to !== 'string' ||
      typeof payload.subject !== 'string' ||
      (typeof payload.text !== 'string' && typeof payload.encryptedText !== 'string')
    ) {
      throw new Error('Invalid email outbox payload');
    }
    return {
      to: payload.to,
      subject: payload.subject,
      text:
        typeof payload.text === 'string'
          ? payload.text
          : this.encryption.decrypt(payload.encryptedText as string),
    };
  }

  private parseTelegramPayload(payload: Prisma.JsonValue): TelegramNotificationEnvelope {
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      payload.schemaVersion !== 1 ||
      typeof payload.eventId !== 'string' ||
      typeof payload.type !== 'string' ||
      typeof payload.recipientUserId !== 'string' ||
      typeof payload.locale !== 'string' ||
      typeof payload.timeZone !== 'string' ||
      typeof payload.occurredAt !== 'string' ||
      typeof payload.availableAt !== 'string' ||
      !payload.templateData ||
      typeof payload.templateData !== 'object' ||
      Array.isArray(payload.templateData)
    ) {
      throw new Error('Invalid Telegram outbox payload');
    }
    return payload as unknown as TelegramNotificationEnvelope;
  }
}
