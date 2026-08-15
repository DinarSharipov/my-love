import type { Prisma } from '@prisma/client';

export const OUTBOX_EVENT_TYPE = {
  EMAIL: 'email.send',
  TELEGRAM: 'telegram.notify',
} as const;

export interface TelegramNotificationEnvelope {
  eventId: string;
  schemaVersion: 1;
  type: string;
  recipientUserId: string;
  templateData: Record<string, string>;
  locale: string;
  timeZone: string;
  occurredAt: string;
  availableAt: string;
  expiresAt?: string;
  deepLink?: string;
}

export interface TelegramDeliveryMessage extends TelegramNotificationEnvelope {
  recipientChatId: string;
}

export interface EmailOutboxPayload {
  to: string;
  subject: string;
  text?: string;
  encryptedText?: string;
}

export type OutboxTransaction = Prisma.TransactionClient;
