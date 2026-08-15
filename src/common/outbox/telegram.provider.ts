import type { TelegramDeliveryMessage } from './outbox.types';

export interface TelegramProvider {
  send(message: TelegramDeliveryMessage): Promise<void>;
}

export const TELEGRAM_PROVIDER = Symbol('TELEGRAM_PROVIDER');
