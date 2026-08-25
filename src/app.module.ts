import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { FamiliesModule } from './modules/families/families.module';
import { FamilyEventsModule } from './modules/family-events/family-events.module';
import { FirstDateModule } from './modules/first-date/first-date.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { MaintenanceModule } from './common/maintenance/maintenance.module';
import { AuditModule } from './common/audit/audit.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ShoppingModule } from './modules/shopping/shopping.module';
import { MealsModule } from './modules/meals/meals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationProducerModule } from './common/notifications/notification-producer.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WellbeingModule } from './modules/wellbeing/wellbeing.module';
import { MediaModule } from './modules/media/media.module';

export const HTTP_LOG_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-telegram-integration-secret',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'res.headers["set-cookie"]',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.get('LOG_LEVEL', 'info'),
          genReqId: (request, response) => {
            const incomingId = request.headers['x-request-id'];
            const requestId =
              typeof incomingId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingId)
                ? incomingId
                : randomUUID();
            response.setHeader('x-request-id', requestId);
            return requestId;
          },
          redact: HTTP_LOG_REDACT_PATHS,
          autoLogging: { ignore: (request) => request.url?.includes('/health') ?? false },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    OutboxModule,
    MaintenanceModule,
    AuditModule,
    TasksModule,
    ShoppingModule,
    MealsModule,
    NotificationsModule,
    NotificationProducerModule,
    AuthModule,
    FamiliesModule,
    FamilyEventsModule,
    FirstDateModule,
    CalendarModule,
    FinanceModule,
    WellbeingModule,
    MediaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
