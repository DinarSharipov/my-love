import type { Prisma } from '@prisma/client';

export const OUTBOX_EVENT_TYPE = {
  EMAIL: 'email.send',
  TELEGRAM: 'telegram.notify',
  PUSH: 'push.notify',
} as const;

export interface PushDeviceDelivery {
  id: string;
  token: string;
  platform: 'ANDROID' | 'IOS';
}

export interface PushNotificationPayload {
  schemaVersion: 1;
  eventId: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientUserIds: string[];
  title: string;
  body: string;
  data: Record<string, string>;
  occurredAt: string;
}

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
