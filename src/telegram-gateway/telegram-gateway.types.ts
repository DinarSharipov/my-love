export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; is_bot: boolean };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramNotificationRequest {
  eventId: string;
  schemaVersion: 1;
  type: string;
  recipientUserId: string;
  recipientChatId: string;
  templateData: { title: string; body?: string };
  locale: string;
  timeZone: string;
  occurredAt: string;
  availableAt: string;
  expiresAt?: string;
  deepLink?: string;
}
