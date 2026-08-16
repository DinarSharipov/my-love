# My Love backend — статус реализации

Последняя сверка с кодом: 16 августа 2026 года.

Этот файл — обязательная точка входа для новых backend-агентов. Перед substantial
work сверять записи ниже с фактическими schema/controllers/tests. Frontend находится
в отдельном репозитории и доступен backend-агентам только для чтения контрактов.

## Текущий фокус

- Roadmap: этап 2 — hardening бытового MVP перед финансовым доменом.
- Последний завершённый продуктовый срез: Telegram auth и domain notifications.
- Последний завершённый инфраструктурный срез: production CI/CD через GitHub Actions,
  GHCR и Docker Compose на отдельном сервере.
- Этапы 0 и 1 закрыты в части auth, family foundation, invitations и базового
  календаря. Общая visibility/consent policy остаётся блокером перед finance и wellbeing.
- Этап 2 реализован минимально: tasks, routines, shopping, inbox, reminders и dashboard
  доступны, но требуют расширенного authorization/E2E покрытия, автоматической генерации
  routines, пагинации inbox и полных Swagger response contracts.
- Последний завершённый срез: timezone-aware quiet-hours scheduling для Telegram outbox
  при постановке и непосредственно перед delivery.
- Последний завершённый продуктовый срез: financial schema foundation — wallet и
  immutable balanced ledger по ADR 0006.
- Household hardening, scheduled routines, calendar projection и ADR visibility/consent
  завершены в текущем объёме.
- Последний завершённый продуктовый срез: financial wallet API.
- Последний завершённый финансовый срез: paginated ledger history, transaction detail
  и idempotent reversal поверх income/expense/transfer-команд.
- Последний инфраструктурный hardening-срез: единый transactional notification producer
  для всех текущих domain events и due reminders.
- Последний завершённый финансовый срез: категории доходов/расходов и месячные
  budget limits с привязкой category к immutable income/expense ledger transaction.
- Текущий срез: регулярные финансовые операции и их forecast/reminders поверх
  завершённых wallet, ledger и budget foundations.
- Приоритет реализации: сначала завершать основной пользовательский функционал
  (ближайший backend-срез — budgets и recurring financial operations). Production
  SMTP, security/privacy hardening, reliability-настройки и расширенное E2E/CI-покрытие
  сознательно отложены в финальный этап стабилизации перед релизной готовностью, если
  только не станут блокером для уже выбранной продуктовой функции.

## Реализовано

### Платформа и контракты

- NestJS/TypeScript, Prisma/PostgreSQL, URI API `/api/v1`, Swagger и DTO validation.
- Joi env validation, Helmet/CORS, Pino с request ID/redaction, глобальный rate limit.
- Docker Compose, health API+DB, production image и изолированная E2E PostgreSQL.
- Production deployment: push в `main` запускает lint/unit/build, публикует immutable
  image в приватный GHCR, подключается к серверу отдельным SSH deploy-key, применяет
  Prisma migrations, обновляет Compose и проверяет health. PostgreSQL и API container
  не публикуют внутренние порты; Caddy терминирует TLS на
  `https://api.147.45.124.221.sslip.io`.
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
  Maintenance worker автоматически генерирует одну задачу на due routine за проход;
  compare-and-swap по `version` предотвращает дубли конкурентных worker-ов.
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
- Calendar projection: `GET /api/v1/families/me/calendar?dateFrom&dateTo` объединяет
  family events, незархивированные задачи и только reminders текущего пользователя.
  Диапазон ограничен 93 днями, результат — 500 entries с явным `truncated`; timezone семьи
  определяет UTC-границы local dates. Исходные persistence-модели не объединяются.
- Financial wallets: `POST/GET/PATCH/DELETE /api/v1/families/me/wallets`; family и owner
  назначаются сервером, family wallet создаёт/изменяет только partner, personal wallet
  виден owner и партнёру только при `PARTNER`, но не child. Поддерживаются `If-Match`,
  soft archive и атомарный audit без сумм.
- Ledger commands: `POST /api/v1/families/me/ledger/income`, `/expense` и `/transfer`
  создают append-only balanced transactions. Во всех командах обязателен
  `Idempotency-Key`; повтор идентичной команды возвращает исходную транзакцию, а иной
  payload с тем же ключом — конфликт. Сумма передаётся только строкой `amountMinor`,
  доступ к personal wallet есть только owner, к family wallet — partner; transfer требует
  две доступные неархивные wallet одной валюты. В HTTP response signed entry amount также
  сериализуется строкой, не JSON number.
- Ledger history и correction: `GET /api/v1/families/me/ledger` с page/limit и optional
  `walletId`, `GET /api/v1/families/me/ledger/:id` и
  `POST /api/v1/families/me/ledger/:id/reversal`. History не возвращает транзакцию,
  если хотя бы один её wallet недоступен текущему пользователю; archived wallet остаётся
  читаемым в history по current visibility policy. Reversal требует отдельный
  `Idempotency-Key`, создаёт новую balanced `REVERSAL` с инвертированными entries,
  не меняет original и доступна только при управляемости всех активных затронутых wallets.
  Повторная reversal или конкурентная отмена возвращает конфликт.
- Notification preferences: отдельная модель и `GET/PATCH /api/v1/notifications/preferences`
  с in-app/email toggles и quiet hours `HH:mm`; настройки создаются при первом чтении.
- Notification producers: после создания/завершения задачи и изменения позиции shopping
  другим участникам семьи создаются in-app уведомления; автор действия не уведомляется,
  а `inAppEnabled=false` учитывается.
- Quiet hours: Telegram outbox получает отложенный `availableAt` по timezone пользователя;
  outbox повторно проверяет актуальные preferences перед delivery. Поддерживаются дневные
  и переходящие через полночь интервалы и смена UTC offset при DST. In-app остаётся мгновенным.
- Telegram linking: authenticated пользователь создаёт одноразовый 10-minute link token,
  внешний bot обменивает его на connection, пользователь читает статус и отзывает связь.
  Exchange атомарно claim-ит token, connection и `telegramEnabled`; повторное и конкурентное
  использование запрещено. После обмена Telegram connection бессрочна, не зависит от срока
  JWT-сессии и остаётся `ACTIVE` до явного `/unlink`, отключения через приложение или удаления
  аккаунта. Повторный `/start` распознаёт активную связь без нового link token. Integration
  endpoints выключены по умолчанию и защищены secret.
- Telegram delivery: notification producer атомарно создаёт `telegram.notify` outbox event
  для активной connection с включённым каналом. Outbox поддерживает безопасный logging
  adapter и retryable HTTP adapter к отдельному bot/gateway; chat ID не хранится в outbox,
  connection/preference повторно проверяются перед delivery, идентификаторы и content не логируются.
- Telegram domain coverage: адресный и family-wide producer отправляет in-app/Telegram
  сообщения для приглашений и ответов на них, family events, first date, family lifecycle,
  task routines, задач и shopping. Due task reminders также создают Telegram outbox event.
- Единая архитектура domain notifications: каждый доменный сервис вызывает только
  `NotificationProducerService` (`notifyUser` или `notifyFamilyMembers`). Для scheduled
  источников worker claim-ит запись и в той же Prisma-транзакции вызывает
  `notifyUserInTransaction`; producer — единственное место, где создаются inbox-запись,
  применяется preference/quiet-hours и ставится Telegram outbox event. Новый тип события
  или напоминания добавляется без интеграции с ботом: достаточно выбрать получателя и
  передать `type/title/body` в producer. Внешняя доставка остаётся ответственностью outbox.
- Channel policy: product/domain notifications используют только in-app inbox и Telegram.
  Email зарезервирован для password reset, подтверждения смены email и account recovery;
  security email не отключается preferences и не задерживается quiet hours. Поле
  `emailEnabled` временно сохранено в API ради совместимости, но не управляет security email.
- Telegram bot/gateway: отдельный Nest entrypoint без доступа к БД принимает защищённый
  Telegram webhook, поддерживает `/start`/`/link`, `/status`, `/notifications`, `/unlink`,
  вызывает backend integration API и отправляет outbox delivery через Telegram Bot API.
  Internal endpoint защищён Bearer secret, webhook — Telegram secret-token; команды разрешены
  только в private chat. Compose-профиль `telegram` и deployment-инструкция находятся в
  `docs/TELEGRAM_GATEWAY.md`.
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
- Family event reminders: create/update DTO получили additive поля
  `reminderOffsetMinutes`, `reminderRecipientIds` и `repeatReminderAt`. Первый момент
  доставки вычисляется и хранится сервером; оба момента валидируются как будущие и до
  начала события, а получатели — как уникальные участники текущей семьи. Изменение
  времени или настроек сбрасывает delivery claim. Worker каждую минуту атомарно claim-ит
  только подтверждённые, не удалённые события и передаёт каждому получателю
  `FAMILY_EVENT_REMINDER` в единственный `NotificationProducerService` (in-app + Telegram
  outbox, preferences и quiet hours). Почасовой housekeeping и минутный poll reminder-ов
  разделены через `CLEANUP_POLL_INTERVAL_MS` / `REMINDER_POLL_INTERVAL_MS`.

## Миграции

Применяются только новыми файлами; текущая последняя миграция:
`20260816020000_add_budget_categories`. Всего 28 миграций.

Financial foundation добавляет personal/family wallets, append-only ledger transactions/
entries, reversal link и `FinancialCommandResult`. Deferred PostgreSQL triggers требуют
минимум две balanced entries, совпадение family/currency/category и запрещают update/delete ledger.
Миграция `20260816020000_add_budget_categories` добавляет family-shared категории
`INCOME`/`EXPENSE`, optional category к ledger transaction и budget лимит expense-category
на первый день календарного месяца. Бюджет — план, а не изменяемый баланс: его фактическая
сумма будет строиться из видимых immutable ledger entries в summary read model.

## Проверки на момент сверки

- `npm run lint` — passed.
- `npm test -- --runInBand` — 22 suites / 64 tests passed.
- `npm run build` — passed.
- `npm run test:e2e:verify` — 10 scenarios passed на чистой БД; все 26 миграций
  последовательно применились.
- Production Docker image собран; оба entrypoint (`dist/main.js` и
  `dist/telegram-gateway/main.js`) присутствуют.
- Рабочий Docker API: `http://localhost:5001`, health healthy, schema up to date.

## Известные пробелы и решения

- Отложено до финального этапа стабилизации: production SMTP, не блокирующие основной
  функционал security/privacy улучшения, reliability hardening и расширение E2E/CI.
  Эти работы не должны прерывать реализацию продуктовых доменов без отдельного решения.

- Нет production email-доставки: локальный Mailpit принимает SMTP-письма, но не
  пересылает их наружу. Для production задаются SMTP реквизиты отдельного провайдера.
- Для password reset нельзя хранить raw token/link в outbox payload; перед реализацией
  добавлен AES-256-GCM encryption boundary; production должен задавать отдельный
  `OUTBOX_ENCRYPTION_KEY` (не использовать fallback от JWT secret).
- Expiration приглашений выполняется maintenance worker-ом; defensive expiry checks в
  командах сохранены как защита от задержки worker-а.
- Нет refresh rotation; hard delete shared data намеренно не выполняется.
- Архивация остаётся односторонней командой партнёра; расформирование требует подтверждения
  второго партнёра. Restore и family-scoped audit history уже реализованы.
- Retention worker анонимизирует завершившие grace period аккаунты, сохраняя membership
  и shared family data; полного hard-delete shared data намеренно нет.
- Базовая visibility/consent policy и calendar projection готовы; cursor pagination
  остаётся для больших ledger/timeline выборок. Notification inbox получил additive
  paginated endpoint, legacy array сохранён для frontend compatibility.
- Telegram bot/gateway реализован, но production deployment должен предоставить публичный
  HTTPS endpoint, создать bot через BotFather, зарегистрировать webhook и задать secrets;
  эти внешние операции намеренно не выполняются из repository.
- Quiet hours применяются к Telegram. Общий domain email notification producer не нужен
  по принятой channel policy; security email доставляется немедленно.
- Household ownership покрыт unit и общим cross-family E2E critical path; CI пока не
  запускает PostgreSQL E2E suite.
- Shopping check/uncheck принимает optional `If-Match` и проверяет соответствие item сегменту
  `listId`; tasks используют общий строгий parser concurrency header.
- Для запуска Telegram gateway на production всё ещё нужен bot token от BotFather; без него
  нельзя зарегистрировать webhook или выполнять реальные отправки через Telegram Bot API.
- Production Compose пока не запускает gateway и не публикует webhook route. Нужны BotFather
  token, два независимых secrets, публичный HTTPS hostname/path и DNS; полный checklist —
  `docs/TELEGRAM_GATEWAY.md`.
- Public user registry оставлен ради обратной совместимости и требует privacy-решения.
- Старые endpoint/DTO нельзя молча ломать: frontend сильно зависит от generated contract.
- Frontend не изменять; необходимые frontend-действия фиксировать только здесь.
- Frontend follow-up: после публикации актуального Swagger перейти с legacy
  `GET /notifications` на `GET /notifications/page` и при необходимости заменить
  client-side объединение календаря на `GET /families/me/calendar`; старые endpoints
  сохранены и продолжают работать.
- Frontend follow-up (выполняет отдельный frontend-агент): production frontend
  `https://my-love-frontend.vercel.app` должен направлять `/api/:path*` на
  `https://api.147.45.124.221.sslip.io/api/:path*` через Vercel rewrite. Текущий
  `VITE_API_PROXY_TARGET` используется только Vite dev server и не меняет production fetch.
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
- Frontend follow-up (выполняет отдельный frontend-агент): в форме создания/редактирования
  family event добавить optional `reminderOffsetMinutes` (минуты до события),
  `reminderRecipientIds` (массив UUID участников семьи) и `repeatReminderAt` (ISO datetime).
  Для очистки настройки PATCH передаёт `null` для дат/offset и `[]` для recipients.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить financial commands
  `POST /families/me/ledger/income`, `/expense`, `/transfer` с обязательным уникальным
  `Idempotency-Key` на пользовательское действие. Деньги передавать строкой `amountMinor`,
  не JavaScript number; для transfer выбирать только доступные пользователю wallet одной
  валюты.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить paginated ledger
  history `GET /families/me/ledger?page&limit&walletId`, transaction detail и действие
  отмены `POST /families/me/ledger/:id/reversal` с новым уникальным `Idempotency-Key`.
  Отображать signed `entries[].amountMinor` как строки и скрывать reversal для уже
  отменённой операции.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить управление
  `POST/GET/PATCH/DELETE /families/me/financial-categories` (создание/изменение/архив —
  только partner), optional `categoryId` в income/expense ledger-командах и месячные
  лимиты `POST/GET/PATCH/DELETE /families/me/budgets`. `periodStart` — строка первого дня
  месяца `YYYY-MM-01`, `limitMinor` — строка minor units; budget доступен только для
  expense category. Для PATCH/DELETE передавать `If-Match` из `version`.

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
| 2026-08-16 | Unified notifications   | due task reminders переведены на `NotificationProducerService`; inbox и Telegram outbox создаются единообразно и атомарно с claim reminder              | lint, 22 unit suites / 64 tests, build         | financial ledger commands                         |
| 2026-08-16 | Family event reminders | миграция `20260816010000_add_family_event_reminders`; first offset, family recipients и exact repeat reminder, minute delivery worker через unified producer | generate, lint, 22 unit suites / 66 tests, build, diff-check | frontend event reminder controls |
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
| 2026-08-15 | Telegram bot/gateway | отдельный Nest entrypoint, Telegram webhook/Bot API client, link/status/notifications/unlink commands, защищённый internal delivery, Compose profile | lint, 32 unit, 9 e2e, build, Docker production image, diff-check | quiet-hours scheduling для Telegram/email |
| 2026-08-15 | Production CI/CD | GitHub Actions test/build/GHCR/deploy pipeline, production Compose, отдельный deploy user/key, migration и health gates | lint, 32 unit, build, Compose config, server SSH/Docker smoke-check | merge PR и проверить первый production workflow |
| 2026-08-15 | Permanent Telegram authorization | бессрочная `TelegramConnection` после одноразовой привязки; `/start` повторно использует активную связь без нового кода | targeted unit, lint, build | quiet-hours scheduling для Telegram/email |
| 2026-08-15 | Telegram auth and domain notifications | `/auth`/`/link`/`/start` linking, persistent bot identity, direct/family notification producer; invitations, events, first date, lifecycle, tasks/routines, shopping и reminders создают Telegram outbox | lint, 37 unit, 9 e2e, build, diff-check | добавить BotFather token и включить gateway/webhook на production |
| 2026-08-16 | Documentation sync | статус и backend backlog сверены с 25 миграциями, controllers, tests и read-only frontend status; устранены устаревшие next-slice/gap записи | diff-check | quiet-hours scheduling |
| 2026-08-16 | Quiet-hours scheduling | timezone-aware расчёт `availableAt` для Telegram producers/reminders и повторная проверка preferences перед delivery; in-app остаётся мгновенным | format, lint, 12 suites / 42 unit, build, diff-check | hardening tasks/shopping/notifications/reminders |
| 2026-08-16 | Household hardening I | общий строгий `If-Match` для tasks, list/item scope и concurrency для shopping, валидные quiet-hours preferences, точные shopping Swagger DTO | lint, 15 suites / 46 unit, build, diff-check | scheduled task routines |
| 2026-08-16 | Scheduled task routines | maintenance generation due DAILY/WEEKLY routines; атомарный CAS claim, task и audit, ограничение одного catch-up occurrence на routine за проход | lint, 16 suites / 48 unit, 9 e2e на чистой БД, 25 migrations, build, diff-check | продолжить household hardening |
| 2026-08-16 | Household hardening II | ownership tests/E2E для tasks, shopping, notifications/reminders; additive `GET /notifications/page`; точные notification/reminder/dashboard DTO | lint, 19 suites / 54 unit, 10 e2e, build, diff-check | calendar projection |
| 2026-08-16 | Calendar projection | additive `GET /families/me/calendar`, family events + tasks + private reminders, local-date range до 93 дней, 500 entries + `truncated` | lint, 20 suites / 56 unit, 10 e2e, build, diff-check | visibility/consent ADR |
| 2026-08-16 | Visibility/consent foundation | ADR 0005 и общая pure policy owner/same-family/scoped consent без premature polymorphic persistence | lint, 21 suites / 59 unit, build, diff-check | financial foundation |
| 2026-08-16 | Financial schema foundation | ADR 0006, migration `20260816000000_add_financial_foundation`: wallet, immutable balanced ledger, reversal и transactional command result | generate, validate, lint, 21 suites / 59 unit, 10 e2e, 26 migrations, build, diff-check | wallet API и idempotent ledger commands |
| 2026-08-16 | Financial wallet API | `POST/GET/PATCH/DELETE /families/me/wallets`; server-owned family/owner, PRIVATE/PARTNER/FAMILY reads, partner-only family wallet management, concurrency и audit | lint, 22 suites / 64 unit, build, diff-check | idempotent ledger commands |
| 2026-08-16 | Ledger commands | `POST /families/me/ledger/income`, `/expense`, `/transfer`; mandatory command-local idempotency, immutable balanced entries, wallet access/currency validation и safe string minor-unit response | generate, targeted unit, lint, build, diff-check | ledger history и reversal commands |
| 2026-08-16 | Ledger history и reversal | `GET /families/me/ledger`, `GET /:id`, `POST /:id/reversal`; paginated visibility-safe history, immutable inverse entries, idempotency и race-safe single reversal | 24 unit suites / 71 tests, lint, build, diff-check | budgets и recurring financial operations |
| 2026-08-16 | Budget categories | миграция `20260816020000_add_budget_categories`; family income/expense categories, optional category в income/expense/reversal ledger, CRUD месячных expense budget limits с optimistic locking и audit | generate, 25 unit suites / 74 tests, lint, чистый 28-migration E2E, build, diff-check | recurring payment forecast/reminders |
| 2026-08-16 | Notification channel policy | domain notifications только in-app/Telegram; email только security/account recovery; production bot readiness checklist | code/config audit | production gateway wiring после получения hostname/token/secrets |
| 2026-08-16 | Приоритизация roadmap | основной пользовательский функционал впереди; SMTP, hardening и расширенные E2E/CI отложены до финальной стабилизации | status review | idempotent financial ledger commands |
