# My Love backend — статус реализации

Последняя сверка с кодом: 15 августа 2026 года.

Этот файл — обязательная точка входа для новых backend-агентов. Перед substantial
work сверять записи ниже с фактическими schema/controllers/tests. Frontend находится
в отдельном репозитории и доступен backend-агентам только для чтения контрактов.

## Текущий фокус

- Roadmap: этап 1 — закрыть начатые сценарии.
- Последний завершённый срез: scheduled cleanup истёкших security-артефактов.
- Последний завершённый срез: retention policy для завершивших grace period аккаунтов.
- Последний завершённый срез: базовый family lifecycle API.
- Последний завершённый срез: двустороннее подтверждение расформирования семьи.
- Последний завершённый срез: backend Telegram account linking contract.
- Этап 0 и этап 1 backend закрыты по текущему объёму roadmap.
- Последний завершённый срез: hardened Telegram linking contract и outbox delivery transport.
- Следующий срез: подключить отдельный Telegram bot/gateway к exchange и HTTP delivery contract.

## Реализовано

### Платформа и контракты

- NestJS/TypeScript, Prisma/PostgreSQL, URI API `/api/v1`, Swagger и DTO validation.
- Joi env validation, Helmet/CORS, Pino с request ID/redaction, глобальный rate limit.
- Docker Compose, health API+DB, production image и изолированная E2E PostgreSQL.
- Совместимый error envelope с `code`, `details`, `requestId`.
- Общие pagination/date/time/timezone/money contracts.
- Optional optimistic concurrency (`If-Match`) для first date, events и профиля.
- Optional `Idempotency-Key` с hash payload/replay результата для критических команд.
- Transactional outbox: durable event, worker, stale-lock recovery, retry/backoff,
  dead-letter status, logging adapter и SMTP adapter.
- Docker Compose запускает Mailpit: SMTP `mailpit:1025` для API и web-интерфейс
  писем на `http://localhost:8025` для локальной проверки.

### Auth и users

- Register/login/logout, Argon2id, JWT и серверная отзываемая `AuthSession`.
- Пользовательский registry с пагинацией; текущий пользователь исключён из выдачи.
- Публичный профиль использует masked email.
- `GET/PATCH /users/me`: имя, фамилия, пол, описание, телефон, locale, timezone и version.
- Сессии хранят IP, User-Agent и last-seen; доступны list, точечный revoke и revoke others.
- Смена пароля проверяет текущий пароль и атомарно отзывает все другие сессии.
- Forgot/reset password: enumeration-safe request, one-time hash token, 30-minute TTL,
  encrypted reset link in outbox and revocation of every session after reset.
- Смена email: re-auth текущим паролем, одноразовый hash-токен с 30-minute TTL,
  encrypted confirmation link to the new address and revocation of all sessions after confirmation.
- Account deletion request: re-auth, немедленная деактивация, отзыв всех sessions,
  30-day configurable grace period и одноразовая encrypted recovery link. Во время
  grace period сохраняются membership и shared data; исходящие pending invitations
  отменяются. Восстановление возвращает аккаунт, но требует нового login.
- Maintenance worker: раз в час удаляет истёкшие auth sessions и reset/email-change/
  deletion tokens, переводит просроченные legacy/private invitations в `EXPIRED`;
  защищён от overlapping runs и настраивается через `CLEANUP_*`.
- Account export: `GET /api/v1/users/me/export` возвращает JSON-снимок профиля,
  membership семьи, настройки семьи, события, first date и историю приглашений
  текущего аккаунта. В экспорт намеренно не попадают password hash, auth/session
  данные, raw/hash токены и outbox payloads; endpoint ограничен активным текущим
  пользователем и не меняет состояние.
- Family lifecycle: `DELETE /api/v1/families/me/membership` атомарно выводит
  текущего участника из семьи, а при отсутствии участников архивирует семью;
  `POST /api/v1/families/me/archive` доступен партнёру и архивирует активную
  семью. Исходящие pending invitations отменяются. Shared data не удаляются.
- Audit events: append-only `audit_events` с nullable ссылками на actor/family,
  безопасными action/resource полями и JSON metadata без секретов. Операции leave,
  archive и request/confirm/cancel dissolution записываются атомарно вместе с
  изменением состояния (cancel — только если была активная заявка).
- Restore family: `POST /api/v1/families/me/restore` доступен партнёру, который
  остаётся участником архивированной семьи; возвращает её в `ACTIVE` и пишет audit
  event. Расформированную семью восстановить нельзя.
- Audit history read: `GET /api/v1/families/me/audit-events?page=1&limit=20`
  возвращает пагинированные события только семьи текущего пользователя. В ответе
  нет `requestId` и иных внутренних транспортных данных; metadata содержит только
  безопасные данные, записанные доменными командами.
- Audit history filtering: endpoint принимает optional `action` и `resourceType`
  (оба ограничены строкой до 100 символов), сохраняя общую пагинацию и family scope.
- Tasks: модель `Task` и API `POST/GET/PATCH/DELETE /families/me/tasks`, команды
  `complete`/`reopen`, назначение только участнику текущей семьи, статусы
  `OPEN/COMPLETED/ARCHIVED`, priority, dueAt, version/`If-Match` и audit events.
- Task routines: модель `TaskRoutine` и API `POST/GET /families/me/task-routines`,
  `POST /:id/generate`, `DELETE /:id`; DAILY/WEEKLY frequency, interval, nextRunAt,
  family-scoped assignment и атомарное продвижение расписания с concurrency check.
- Shopping lists: модели `ShoppingList`/`ShoppingItem` и API для создания/просмотра/
  архивации списков, добавления позиций и check/uncheck; все операции ограничены
  текущей семьёй и пишутся в audit.
- Notifications: модель `Notification` и защищённый inbox API `GET /notifications`,
  `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`; выдача scoped
  текущим пользователем и его текущей семьёй, максимум 100 последних событий.
- Task reminders: модель `TaskReminder` и API создания/списка/удаления напоминаний
  для задач. Maintenance worker атомарно claim-ит due reminders и создаёт in-app
  `TASK_REMINDER` notification, защищая от повторной доставки.
- Dashboard: `GET /api/v1/families/me/dashboard` возвращает read-only агрегаты
  открытых/просроченных задач, unchecked shopping items, unread notifications и
  ближайшие пять family events; доступ ограничен active membership.
- Notification preferences: отдельная модель и `GET/PATCH /api/v1/notifications/preferences`
  с in-app/email toggles и quiet hours `HH:mm`; настройки создаются при первом чтении.
- Notification producers: после создания/завершения задачи и изменения позиции shopping
  другим участникам семьи создаются in-app уведомления; автор действия не уведомляется,
  а `inAppEnabled=false` учитывается.
- Telegram linking: authenticated пользователь создаёт одноразовый 10-minute link token,
  внешний bot обменивает его на connection, пользователь читает статус и отзывает связь.
  Exchange атомарно claim-ит token, connection и `telegramEnabled`; повторное и конкурентное
  использование запрещено. Integration endpoints выключены по умолчанию и защищены secret.
- Telegram delivery: notification producer атомарно создаёт `telegram.notify` outbox event
  для активной connection с включённым каналом. Outbox поддерживает безопасный logging
  adapter и retryable HTTP adapter к отдельному bot/gateway; chat ID не хранится в outbox,
  connection/preference повторно проверяются перед delivery, идентификаторы и content не логируются.
- Retention worker: после `deletionScheduledAt` неактивный аккаунт может быть
  анонимизирован (имя, email, описание, телефон и дата рождения), при этом
  membership и shared family data сохраняются, а ссылки на пользователя остаются
  валидными. Защита от повторной обработки — `retentionAnonymizedAt`; worker
  отключён по умолчанию через `RETENTION_WORKER_ENABLED=false` и обрабатывает
  ограниченную пачку.

### Семья и приглашения

- Роли `PARTNER`/`CHILD`, lifecycle family, locale/timezone/default currency.
- Общая membership policy и DB-level ограничение максимум двух партнёров.
- Старый совместимый invite по `recipientId`, self-invite запрещён.
- Закрытые приглашения по точному нормализованному email/одноразовой ссылке:
  hash-токен, expiry, max use, cooldown, outgoing list, revoke, accept после регистрации.
- Accept атомарно создаёт семью и отменяет конкурирующие pending invitations.

### Совместные сценарии

- First date: create/read/update/delete, одна запись на семью, ownership и concurrency.
- Family events: CRUD, date-range pagination, partner confirm/reject, timezone statuses,
  re-proposal after material update, creator soft delete и concurrency.

## Миграции

Применяются только новыми файлами; текущая последняя миграция:
`20260815190000_add_telegram_linking`. Всего 25 миграций.

## Проверки на момент сверки

- `npm run lint` — passed.
- `npm test -- --runInBand` — 9 suites / 28 tests passed.
- `npm run build` — passed.
- `npm run test:e2e:verify` — 9 scenarios passed на чистой БД; все 25 миграций
  последовательно применились.
- Рабочий Docker API: `http://localhost:5001`, health healthy, schema up to date.

## Известные пробелы и решения

- Нет production email-доставки: локальный Mailpit принимает SMTP-письма, но не
  пересылает их наружу. Для production задаются SMTP реквизиты отдельного провайдера.
- Для password reset нельзя хранить raw token/link в outbox payload; перед реализацией
  добавлен AES-256-GCM encryption boundary; production должен задавать отдельный
  `OUTBOX_ENCRYPTION_KEY` (не использовать fallback от JWT secret).
- Expiration приглашений пока lazy, с defensive check в командах.
- Нет refresh rotation; hard delete shared data намеренно не выполняется.
- Архивация пока односторонняя команда партнёра; восстановление и публичное чтение
  audit history требуют отдельного согласования контракта.
- Запланированная деактивация безопасно блокирует доступ, но не удаляет данные до
  отдельного cleanup job с утверждённой policy.
- Нет cursor pagination и calendar projection для будущих доменов.
- Внешний Telegram bot/gateway пока не входит в этот repository: backend HTTP adapter
  готов, но production delivery требует настроить `TELEGRAM_PROVIDER=http`, URL и secret.
- Quiet hours пока хранятся как preferences, но отложенная Telegram/email доставка по ним
  ещё не рассчитывается; до подключения production transport это нужно завершить.
- Public user registry оставлен ради обратной совместимости и требует privacy-решения.
- Старые endpoint/DTO нельзя молча ломать: frontend сильно зависит от generated contract.
- Frontend не изменять; необходимые frontend-действия фиксировать только здесь.
- Frontend follow-up (выполняет отдельный frontend-агент): заменить legacy
  `POST /api/v1/auth/restore` на `POST /api/v1/auth/password-reset/request` и добавить
  страницу `/reset-password` для `POST /api/v1/auth/password-reset/confirm`.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить защищённую форму
  `POST /api/v1/auth/email-change/request` (`email`, `currentPassword`) и публичную
  страницу `/confirm-email-change` для `POST /api/v1/auth/email-change/confirm` (`token`).
- Frontend follow-up (выполняет отдельный frontend-агент): добавить опасное действие
  удаления аккаунта через `POST /api/v1/auth/account-deletion/request`
  (`currentPassword`), показывать `scheduledFor`, очищать локальный token после 202;
  добавить публичную страницу `/cancel-account-deletion` для
  `POST /api/v1/auth/account-deletion/cancel` (`token`) с переходом на login после 204.

## Журнал backend-срезов

| Дата       | Срез                    | Миграция/API                                                                                                                                             | Проверки                                       | Следующий шаг                                    |
| ---------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| 2026-08-15 | Foundation              | roles/lifecycle/membership policy, DB partner limit                                                                                                      | lint, unit, e2e, build                         | API contracts                                    |
| 2026-08-15 | API contracts           | error/request ID, pagination/date/time/money                                                                                                             | lint, unit, e2e, build                         | concurrency                                      |
| 2026-08-15 | Concurrency             | version/If-Match для first-date/events                                                                                                                   | generate, lint, unit, e2e, build               | idempotency                                      |
| 2026-08-15 | Idempotency             | optional key, payload conflict, response replay                                                                                                          | generate, lint, unit, e2e, build               | closed invite                                    |
| 2026-08-15 | Closed invite           | private email/link create/list/accept/revoke                                                                                                             | migration, unit, e2e, build                    | profile                                          |
| 2026-08-15 | Profile                 | `GET/PATCH /users/me`, locale/timezone/version                                                                                                           | migration, 24 unit, 3 e2e, build               | password/sessions                                |
| 2026-08-15 | Password/sessions       | metadata/list/revoke/revoke others, смена password с отзывом других JWT                                                                                  | migration, 24 unit, 4 e2e, build               | outbox/email adapter                             |
| 2026-08-15 | Outbox/email foundation | durable outbox, worker/retry/stale-lock recovery, безопасный logging email adapter                                                                       | migration, 24 unit, 5 e2e, build               | protected forgot/reset password                  |
| 2026-08-15 | Password reset          | request/confirm, hash token, encrypted email outbox payload, session revocation                                                                          | migration, 24 unit, 6 e2e, build               | email confirmation/account lifecycle             |
| 2026-08-15 | Local SMTP              | Mailpit service, Nodemailer SMTP adapter, Compose SMTP wiring и inbox verification                                                                       | lint, unit, e2e, Docker build, SMTP smoke test | production SMTP credentials / email confirmation |
| 2026-08-15 | Email change            | re-auth request, one-time hash token, encrypted confirmation email, email update и revocation всех sessions                                              | generate, lint, 24 unit, 7 e2e, build          | account lifecycle / cleanup jobs                 |
| 2026-08-15 | Account deactivation    | re-auth request, configurable grace period, encrypted recovery link, session revocation, cancellation исходящих invitations и одноразовое восстановление | generate, lint, 24 unit, 8 e2e, build          | cleanup jobs / retention policy / account export |
| 2026-08-15 | Cleanup worker          | периодическая очистка истёкших sessions/tokens и перевод просроченных invitations в `EXPIRED` | lint, 25 unit, 8 e2e, build | retention policy / account export |
| 2026-08-15 | Account export          | `GET /api/v1/users/me/export`, безопасный JSON-экспорт профиля, family data и приглашений без секретов | lint, 25 unit, build | retention policy для завершивших grace period аккаунтов |
| 2026-08-15 | Retention policy        | новая миграция `20260815100000_add_retention_anonymized_at`, opt-in worker анонимизации истёкших аккаунтов с сохранением shared data | generate, lint, 25 unit, build | полный family lifecycle API |
| 2026-08-15 | Family lifecycle        | `DELETE /families/me/membership`, `POST /families/me/archive`, атомарная смена статуса и отмена pending invitations | lint, 25 unit, build | подтверждение расформирования и audit events |
| 2026-08-15 | Dissolution confirmation | миграция `20260815110000_add_family_dissolution_requests`, request/confirm/cancel API с обязательным вторым партнёром | generate, lint, 25 unit, build | audit events |
| 2026-08-15 | Audit events | миграция `20260815120000_add_audit_events`, внутренний append-only журнал family lifecycle без секретов | generate, lint, 25 unit, build, diff-check | полный family lifecycle API |
| 2026-08-15 | Family restore | `POST /families/me/restore`, партнёрская авторизация, атомарное возвращение `ARCHIVED` в `ACTIVE` и audit event | lint, 25 unit, build, diff-check | audit history read API |
| 2026-08-15 | Audit history read | `GET /families/me/audit-events` с общей page/limit пагинацией и проверкой active membership | lint, 25 unit, build, diff-check | административные family lifecycle сценарии |
| 2026-08-15 | Audit history filters | фильтры `action` и `resourceType` без изменения базового endpoint/response contract | lint, 25 unit, build, diff-check | этап 2: tasks и task-routines |
| 2026-08-15 | Tasks | миграция `20260815130000_add_tasks`, CRUD/complete/reopen/archive, family membership и optimistic concurrency | generate, lint, 25 unit, build, diff-check | task-routines |
| 2026-08-15 | Task routines | миграция `20260815140000_add_task_routines`, DAILY/WEEKLY шаблоны и атомарная генерация Task | generate, lint, 25 unit, build, diff-check | shopping lists |
| 2026-08-15 | Shopping lists | миграция `20260815150000_add_shopping_lists`, family-scoped списки/позиции, check/uncheck и archive | generate, lint, 25 unit, build, diff-check | notifications и reminders |
| 2026-08-15 | Notifications inbox | миграция `20260815160000_add_notifications`, user/family-scoped inbox и mark read/read-all | generate, lint, 25 unit, build, diff-check | reminders и notification producers |
| 2026-08-15 | Task reminders | миграция `20260815170000_add_task_reminders`, task reminder API и atomic maintenance delivery в notifications | generate, lint, 25 unit, build, diff-check | dashboard/cockpit агрегаты |
| 2026-08-15 | Dashboard aggregates | `GET /families/me/dashboard`, агрегаты tasks/shopping/notifications/events без новой миграции | lint, 25 unit, build, diff-check | notification preferences и quiet hours |
| 2026-08-15 | Notification preferences | миграция `20260815180000_add_notification_preferences`, GET/PATCH preferences и HH:mm validation | generate, lint, 25 unit, build, diff-check | notification producers |
| 2026-08-15 | Notification producers | общий producer для family members, события задач и shopping с учётом in-app preferences | generate, lint, unit, build, diff-check | family events и email-канал |
| 2026-08-15 | Telegram delivery hardening | validated DTO/Swagger, atomic single-use exchange, optional integration boundary, token cleanup, `telegram.notify` outbox и log/HTTP providers | generate, lint, 28 unit, 9 e2e, build, 25 migrations on clean DB | внешний Telegram bot/gateway и quiet-hours scheduling |
