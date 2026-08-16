import { Injectable, Logger } from '@nestjs/common';
import { BackendRequestError, BackendTelegramClient } from './backend-telegram.client';
import { TelegramApiClient } from './telegram-api.client';
import type { TelegramNotificationRequest, TelegramUpdate } from './telegram-gateway.types';

@Injectable()
export class TelegramGatewayService {
  private readonly logger = new Logger(TelegramGatewayService.name);

  constructor(
    private readonly backend: BackendTelegramClient,
    private readonly telegram: TelegramApiClient,
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text || !message.from || message.from.is_bot || message.chat.type !== 'private')
      return;
    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from.id);
    const [rawCommand = '', argument] = message.text.trim().split(/\s+/, 2);
    const command = rawCommand.toLowerCase().split('@')[0];
    try {
      if (command === '/start' && !argument) {
        const connection = await this.backend.status(telegramUserId);
        return this.telegram.sendMessage(
          chatId,
          connection?.status === 'ACTIVE'
            ? 'Вы уже авторизованы. Повторная привязка не требуется.'
            : this.linkHelp(),
        );
      }
      if (command === '/start' || command === '/link' || command === '/auth') {
        if (!argument) return this.telegram.sendMessage(chatId, this.linkHelp());
        await this.backend.exchange(argument, telegramUserId, chatId);
        return this.telegram.sendMessage(
          chatId,
          'Аккаунт привязан. Уведомления Telegram включены.',
        );
      }
      if (command === '/status') {
        const connection = await this.backend.status(telegramUserId);
        const text = connection?.status === 'ACTIVE' ? 'Аккаунт привязан.' : 'Аккаунт не привязан.';
        return this.telegram.sendMessage(chatId, text);
      }
      if (command === '/unlink') {
        await this.backend.unlink(telegramUserId);
        return this.telegram.sendMessage(chatId, 'Связь с аккаунтом отключена.');
      }
      if (command === '/notifications') {
        const items = await this.backend.notifications(telegramUserId);
        const text = items.length
          ? items.map((item) => `• ${item.title}${item.body ? ` — ${item.body}` : ''}`).join('\n')
          : 'Новых уведомлений нет.';
        return this.telegram.sendMessage(chatId, text);
      }
      return this.telegram.sendMessage(chatId, this.help());
    } catch (error) {
      if (error instanceof BackendRequestError && [404, 409].includes(error.status)) {
        const text =
          error.status === 404
            ? 'Ссылка недействительна или истекла.'
            : 'Этот Telegram уже привязан.';
        await this.telegram.sendMessage(chatId, text);
        return;
      }
      this.logger.error({ event: 'telegram_command_failed', updateId: update.update_id });
      await this.telegram.sendMessage(chatId, 'Не удалось выполнить команду. Попробуйте позже.');
    }
  }

  deliver(notification: TelegramNotificationRequest): Promise<void> {
    const { title, body } = notification.templateData;
    const text = `${title}${body ? `\n${body}` : ''}${notification.deepLink ? `\n${notification.deepLink}` : ''}`;
    return this.telegram.sendMessage(notification.recipientChatId, text);
  }

  private linkHelp() {
    return 'Создайте код привязки в приложении и отправьте /link КОД';
  }

  private help() {
    return [
      '/link КОД — привязать аккаунт',
      '/auth КОД — авторизоваться по коду из приложения',
      '/status — проверить связь',
      '/notifications — непрочитанные',
      '/unlink — отключить связь',
    ].join('\n');
  }
}
