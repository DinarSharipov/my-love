import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { EMAIL_PROVIDER } from './email.provider';
import { LoggingEmailProvider } from './logging-email.provider';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { PayloadEncryptionService } from './payload-encryption.service';
import { SmtpEmailProvider } from './smtp-email.provider';
import { HttpTelegramProvider } from './http-telegram.provider';
import { LoggingTelegramProvider } from './logging-telegram.provider';
import { TELEGRAM_PROVIDER } from './telegram.provider';
import { QuietHoursService } from '../notifications/quiet-hours.service';
import { FirebasePushProvider } from '../push/firebase-push.provider';
import { LoggingPushProvider } from '../push/logging-push.provider';
import { PUSH_PROVIDER } from '../push/push.provider';

@Module({
  imports: [DatabaseModule],
  providers: [
    LoggingEmailProvider,
    SmtpEmailProvider,
    LoggingTelegramProvider,
    HttpTelegramProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, LoggingEmailProvider, SmtpEmailProvider],
      useFactory: (
        config: ConfigService,
        loggingProvider: LoggingEmailProvider,
        smtpProvider: SmtpEmailProvider,
      ) =>
        config.get<string>('EMAIL_PROVIDER', 'log') === 'smtp' ? smtpProvider : loggingProvider,
    },
    {
      provide: TELEGRAM_PROVIDER,
      inject: [ConfigService, LoggingTelegramProvider, HttpTelegramProvider],
      useFactory: (
        config: ConfigService,
        loggingProvider: LoggingTelegramProvider,
        httpProvider: HttpTelegramProvider,
      ) =>
        config.get<string>('TELEGRAM_PROVIDER', 'log') === 'http' ? httpProvider : loggingProvider,
    },
    OutboxService,
    OutboxWorker,
    PayloadEncryptionService,
    QuietHoursService,
    LoggingPushProvider,
    {
      provide: PUSH_PROVIDER,
      inject: [ConfigService, LoggingPushProvider],
      useFactory: (config: ConfigService, loggingProvider: LoggingPushProvider) =>
        config.get<boolean>('FIREBASE_PUSH_ENABLED', false)
          ? new FirebasePushProvider(config)
          : loggingProvider,
    },
  ],
  exports: [OutboxService, QuietHoursService],
})
export class OutboxModule {}
