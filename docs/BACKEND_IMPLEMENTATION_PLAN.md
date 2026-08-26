# My Love Backend — Plan v1.0

Статус: **реализован полностью**.

Этот документ — зафиксированный итог первого backend-плана. Новые задачи сюда не
добавляются. Фактические детали отдельных срезов хранятся в
`docs/IMPLEMENTATION_STATUS.md`.

## Реализованный объём

### Платформа и безопасность

- NestJS, Prisma, PostgreSQL, Nest Config и Joi-валидация окружения.
- API versioning `/api/v1`, Swagger/OpenAPI, DTO validation, единый error envelope,
  request ID, Helmet, CORS, rate limiting и структурированные логи с redaction секретов.
- Docker Compose, health checks, Prisma migrations, production CI/CD через GitHub Actions,
  GHCR и отдельный сервер.
- Аудит чувствительных изменений, optimistic concurrency и idempotency для критичных команд.
- Transactional outbox с retry для внешних эффектов.

### Аутентификация и пользователи

- Регистрация, вход, выход, Argon2id, JWT и серверные сессии.
- Смена пароля, password reset, смена email и удаление аккаунта с безопасными одноразовыми
  токенами, отзывом сессий и email-outbox.
- Профиль пользователя, поиск, пагинация, публичное чтение профиля и аватар в private S3.

### Семья и участники

- Семейное членство, роли партнёров и управляемые профили детей.
- Создание семьи через приглашения, обычные и private email-приглашения, accept/reject/cancel/revoke.
- Выход, archive/restore, запрос и подтверждение dissolution.
- Общая family ownership/visibility policy и family-scoped audit history.

### Координация семьи

- Задачи: CRUD, назначение, child scope, complete/reopen, archive.
- Регулярные задачи, генерация по расписанию, reminders и lifecycle.
- Shopping lists/items, check/uncheck, archive/restore.
- Семейные события, подтверждение/отклонение, soft delete, reminders и calendar projection.
- Первая памятная дата.

### Meals

- Рецепты с dietary labels, archive/restore и meal plans.
- Генерация shopping items из плана.
- Media attachments для рецептов с family ownership и идемпотентным attach.

### Финансы

- Wallets, категории, бюджеты и recurring payments.
- Immutable balanced ledger, income/expense/transfer, reversal и idempotent commands.
- Visibility policy для wallet entries, финансовые цели и финансовые встречи с решениями.
- Media attachments для ledger transactions; detach не удаляет S3-объект.

### Wellbeing

- Check-ins, assessments, trends и export.
- Consent-first sharing, shared-with-me, gratitudes, support requests, rituals и couple meetings.
- Ownership/participant visibility, privacy hardening, retention cleanup и безопасное удаление
  личных артефактов.

### Уведомления и Telegram

- In-app notification inbox, preferences, quiet hours и reminders.
- Telegram linking/status/unlink.
- Telegram transport вынесен в отдельный репозиторий и отдельный контейнер.
- Backend отправляет уведомления через PostgreSQL outbox и HTTP delivery contract с retry.
- Доменные уведомления подключены к задачам, routines, shopping, family events, invitations,
  family lifecycle, first date, meals, wellbeing и finance meetings/goals.

### Private S3 media

- Selectel S3 private bucket через AWS SDK-compatible API.
- Multipart upload с initiate/status/complete/abort, ограничениями размера и очисткой.
- Раздельные префиксы и API-потоки для images, videos и audio.
- Family visibility, metadata в Prisma, preview WebP для изображений.
- Streaming с HTTP Range и download endpoints для видео и аудио.
- Привязки к user avatar, child avatar, family events, recipes и ledger transactions.
- S3 CORS, cleanup/retry и изолированный destructive smoke на временных данных.

## Критерий завершения v1.0

Первый backend-план считается полностью реализованным: основные домены MVP,
авторизация, семейная безопасность, уведомления, Telegram-интеграция, private S3,
Docker/CI-CD и текущие API-контракты доступны в коде и описаны в Swagger.

С этого момента задачи ведутся только по `docs/BACKEND_IMPLEMENTATION_PLAN_V2.md`.
