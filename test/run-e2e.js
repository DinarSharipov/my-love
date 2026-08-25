const { spawnSync } = require('node:child_process');
const path = require('node:path');

const env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  EMAIL_PROVIDER: 'log',
  OUTBOX_WORKER_ENABLED: 'false',
  CLEANUP_WORKER_ENABLED: 'false',
  DATABASE_URL: 'postgresql://my_love_test:my_love_test@localhost:55432/my_love_test?schema=public',
  JWT_ACCESS_SECRET: 'e2e-only-secret-longer-than-thirty-two-characters',
  JWT_ACCESS_EXPIRES_IN: '15m',
  FAMILY_INVITATION_EXPIRES_IN: '1h',
  APP_TIMEZONE: 'Europe/Moscow',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'test-region',
  S3_BUCKET: 'my-love-e2e',
  S3_ACCESS_KEY: 'test-access-key',
  S3_SECRET_KEY: 'test-secret-key',
};

const jestPath = require.resolve('jest/bin/jest');
const result = spawnSync(process.execPath, [jestPath, '--config', 'test/jest-e2e.json', '--runInBand'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
