# Operations runbook

## Disk and Docker logs

Compose services use Docker's `local` logging driver with a 10 MB file size and three retained
files per service. Inspect before any cleanup:

```bash
df -h
docker system df
docker compose ps
```

Only after confirming no active deployment and preserving required logs, remove unused images with
`docker image prune -f`. Do not remove volumes, running containers, or PostgreSQL data as a disk
cleanup action.

## Deploy and rollback

The GitHub workflow publishes an immutable image tagged by commit SHA, applies migrations, then
starts Compose and verifies `/api/v1/health`. For rollback, select the last known healthy image SHA,
set `APP_IMAGE` to that exact image, run `docker compose pull` and `docker compose up -d`.
Do not roll back database migrations by deleting rows from `_prisma_migrations`; prepare a forward
migration instead.

## Migration recovery

If `prisma migrate deploy` fails, keep API traffic stopped at the previous image, record the exact
migration and database error, and create a forward-only repair migration. Never edit an applied
migration. Verify with `npx prisma migrate status` before restarting API.

## Outbox

Set `OUTBOX_METRICS_TOKEN` in the production environment to enable
`GET /api/v1/health/outbox` with header `x-ops-token`. The response contains only aggregate queue
counters: pending/retrying/processing/stale/delivered/failed and oldest pending timestamp. Alert on
failed events, stale processing, or a growing oldest pending age. Delivery logs include
`deliveryLatencyMs` but never payloads, recipient addresses, device tokens, or message text.

## S3 and Telegram outages

S3 upload failures must not be retried by deleting database media records or object prefixes. Keep
the upload session, inspect provider status and retry through the supported upload lifecycle. For
Telegram delivery failures, inspect aggregate outbox state and transport logs; retryable events are
rescheduled automatically until `OUTBOX_MAX_ATTEMPTS`, then become `FAILED` for manual review.
