#!/bin/sh

set -eu

cleanup() {
  npm run test:e2e:db:down
}

trap cleanup EXIT INT TERM

npm run test:e2e:db:up
npm run test:e2e:migrate
npm run test:e2e
