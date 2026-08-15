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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validationSchema: envValidationSchema }),
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
          redact: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.token',
            'res.headers["set-cookie"]',
          ],
          autoLogging: { ignore: (request) => request.url?.includes('/health') ?? false },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    FamiliesModule,
    FamilyEventsModule,
    FirstDateModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
