import Joi from 'joi';

export const telegramGatewayEnvSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  TELEGRAM_GATEWAY_PORT: Joi.number().port().default(3000),
  BACKEND_API_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  TELEGRAM_BOT_TOKEN: Joi.string()
    .pattern(/^\d+:[A-Za-z0-9_-]{20,}$/)
    .required(),
  TELEGRAM_WEBHOOK_SECRET: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{32,256}$/)
    .required(),
  TELEGRAM_INTEGRATION_SECRET: Joi.string().min(32).required(),
});
