import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('7d'),
  FAMILY_INVITATION_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('7d'),
  PRIVATE_FAMILY_INVITATION_COOLDOWN: Joi.string()
    .pattern(/^\d+[smhdw]$/)
    .default('1m'),
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
});
