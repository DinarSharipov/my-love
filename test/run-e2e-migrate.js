const { spawnSync } = require('node:child_process');
const path = require('node:path');

const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://my_love_test:my_love_test@localhost:55432/my_love_test?schema=public',
};
const prismaPath = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaPath, 'migrate', 'deploy'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
