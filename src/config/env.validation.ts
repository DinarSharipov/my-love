import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  MESSENGER_REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .optional(),
  REDIS_PASSWORD: Joi.string()
    .pattern(/^[A-Za-z0-9._~-]{32,}$/)
    .optional(),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  TELEGRAM_INTEGRATION_ENABLED: Joi.boolean().default(false),
  TELEGRAM_INTEGRATION_SECRET: Joi.string()
    .min(32)
    .when('TELEGRAM_INTEGRATION_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .when('TELEGRAM_PROVIDER', { is: 'http', then: Joi.required() }),
  TELEGRAM_PROVIDER: Joi.string().valid('log', 'http').default('log'),
  TELEGRAM_DELIVERY_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('TELEGRAM_PROVIDER', {
      is: 'http',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('7d'),
  FAMILY_INVITATION_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('7d'),
  PRIVATE_FAMILY_INVITATION_COOLDOWN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('1m'),
  OUTBOX_WORKER_ENABLED: Joi.boolean().default(true),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(250).default(5000),
  OUTBOX_LOCK_TIMEOUT_MS: Joi.number().integer().min(1000).default(300000),
  OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  OUTBOX_METRICS_TOKEN: Joi.string().min(32).optional(),
  OUTBOX_ENCRYPTION_KEY: Joi.string().min(32).optional(),
  CLEANUP_WORKER_ENABLED: Joi.boolean().default(true),
  CLEANUP_POLL_INTERVAL_MS: Joi.number().integer().min(1000).default(3600000),
  REMINDER_POLL_INTERVAL_MS: Joi.number().integer().min(1000).default(60000),
  RETENTION_WORKER_ENABLED: Joi.boolean().default(false),
  EMAIL_PROVIDER: Joi.string().valid('log', 'smtp').default('log'),
  SMTP_HOST: Joi.string().hostname().default('127.0.0.1'),
  SMTP_PORT: Joi.number().port().default(1025),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USERNAME: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_FROM_EMAIL: Joi.string().email().default('no-reply@example.com'),
  SMTP_REPLY_TO: Joi.string().email().optional(),
  PASSWORD_RESET_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('30m'),
  EMAIL_CHANGE_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('30m'),
  ACCOUNT_DELETION_GRACE_PERIOD: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('30d'),
  FRONTEND_APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:5173'),
  APP_TIMEZONE: Joi.string()
    .custom((value: string, helpers) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return value;
      } catch {
        return helpers.error('any.invalid');
      }
    })
    .default('Europe/Moscow'),
  DEFAULT_LOCALE: Joi.string().min(2).max(35).default('ru-RU'),
  DEFAULT_CURRENCY: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .default('RUB'),
  S3_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  S3_REGION: Joi.string().min(1).required(),
  S3_BUCKET: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .required(),
  S3_ACCESS_KEY: Joi.string().min(1).required(),
  S3_SECRET_KEY: Joi.string().min(1).required(),
  S3_PRESIGNED_URL_EXPIRES_IN: Joi.number().integer().min(60).max(86400).default(900),
  S3_MULTIPART_UPLOAD_SESSION_RETENTION_MS: Joi.number()
    .integer()
    .min(60_000)
    .default(7 * 24 * 60 * 60 * 1000),
  FIREBASE_PUSH_ENABLED: Joi.boolean().default(false),
  FIREBASE_PROJECT_ID: Joi.string().min(1).when('FIREBASE_PUSH_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().when('FIREBASE_PUSH_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  FIREBASE_PRIVATE_KEY: Joi.string().min(1).when('FIREBASE_PUSH_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});
