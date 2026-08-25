import { HTTP_LOG_REDACT_PATHS } from './common/logging/http-log-redaction';

describe('HTTP logger configuration', () => {
  it('redacts credentials and Telegram integration secrets from request logs', () => {
    expect(HTTP_LOG_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.x-telegram-integration-secret',
        'res.headers["set-cookie"]',
      ]),
    );
  });
});
