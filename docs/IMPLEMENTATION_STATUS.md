# 2026-08-28 Family wish partner identifier compatibility

Исправлен контракт создания family wish: `partnerId` теперь принимает как `User.id`, так и
`FamilyMember.id` из `GET /api/v1/families/me`. Backend нормализует значение в `User.id` только
после проверки активной семьи и роли `PARTNER`; хранение и уведомления используют нормализованный
user id. Это устраняет 403 при передаче frontend-ом `members[].id` и не ослабляет authorization.

Проверка: FamilyWishesService Jest `5/5`.

# 2026-08-28 Media scopes and album isolation

Добавлено явное назначение media через Prisma enum `MediaScope`: `ALBUM`, `CHAT`, `RECIPE`,
`FAMILY_EVENT`, `LEDGER`, `USER_AVATAR`, `CHILD_AVATAR`. Значение хранится и в `Media`, и в
`MediaUploadSession`; migration `20260828100000_add_media_scope` безопасно классифицирует старые
записи как `ALBUM`.

`POST /api/v1/media/uploads/initiate` принимает optional `scope` (legacy default `ALBUM`). Общие
`GET /api/v1/media`, `GET /api/v1/media/:id`, video/audio stream/download и DELETE теперь работают
только с `ALBUM`. Message media остаётся доступной через message-scoped Messenger endpoints;
при создании сообщения выбранные legacy `ALBUM` media атомарно переводятся в `CHAT`, а media,
зарезервированная другим доменом, отклоняется.

Проверки: Prisma format/validate/generate, clean PostgreSQL migration (63 migrations), format,
lint, build и Jest `44 suites / 169 tests` PASS.

# 2026-08-27 Server-side FCM push for family messenger

Добавлена push-инфраструктура для новых текстовых сообщений семейного Messenger.
Миграция `20260827180000_add_push_devices_and_outbox_dedupe` добавляет `PushDevice` с
уникальным FCM token, платформой `ANDROID/IOS`, app version, `lastSeenAt` и soft-disable
через `disabledAt`, а также nullable unique `OutboxEvent.dedupeKey`.

HTTP API (JWT): `POST /api/v1/push/devices` регистрирует или обновляет device token и намеренно
не возвращает token; `DELETE /api/v1/push/devices/:token` отключает token текущего пользователя
с ответом `204`. Повторная регистрация идемпотентна, устройств может быть несколько.

Создание непустого текстового сообщения атомарно добавляет `push.notify` outbox event для всех
участников conversation кроме sender. Event dedupe-ится по `chat-message:{messageId}`; worker
получает только активные устройства, отправляет FCM multicast и soft-disables invalid/unregistered
tokens. Ошибка Firebase retryable и не откатывает сообщение. Private message text и tokens не
логируются.

Firebase Admin provider включается только при `FIREBASE_PUSH_ENABLED=true` и читает
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` из secret manager.
При выключенном флаге используется logging/mock provider. Push payload и smoke test описаны в
README. Push отправляется для непустых текстовых, image, video и voice-сообщений; для media-only
сообщений используется короткий типовой body.

Проверки: targeted push/messenger Jest `14/14`, Prisma format/validate/generate, lint и build.
Рекомендуемый следующий срез: production/staging Firebase smoke test с Flutter token и push
preferences.

# 2026-08-27 Family wishes

Реализован первый вертикальный backend-срез раздела «Семейные желания». Добавлен модуль
`family-wishes`, Prisma-модель `FamilyWish`, три статуса workflow (`NOT_REALIZED/REALIZED`,
подтверждение желания партнёром и подтверждение реализации), optimistic concurrency через
`version`/`If-Match`, soft-delete и индексы family-scoped. Migration:
`20260827170000_add_family_wishes`; она проверена на чистой PostgreSQL.

HTTP API:

- `POST/GET /api/v1/families/me/wishes` и `GET/PATCH/DELETE /api/v1/families/me/wishes/:id`;
- `POST /:id/accept`, `POST /:id/reject`;
- `POST /:id/mark-realized`, `POST /:id/confirm-realization`, `POST /:id/reject-realization`.

Создание и все state-changing actions атомарно записывают outbox/in-app/Telegram notification
в одной транзакции с изменением желания. Авторизация требует активного партнёра текущей семьи;
адресат фиксируется при создании и не может быть самим создателем. Повторные команды защищены
Idempotency-Key и version conflict. WebSocket-события для желаний пока не добавлялись: HTTP
остаётся источником истины для этого среза.

Проверки: Prisma format/validate/generate, lint, build, targeted Jest `4/4`, полный Jest
`42 suites / 164 tests`, migration на чистой PostgreSQL и `git diff --check` — PASS.
Следующий срез: review контрактов/интеграционных тестов API, затем при подтверждении UX добавить
versioned `family-wish.created/updated` events и расширенные причины отклонения.

# 2026-08-26 Direct conversation uniqueness

Direct conversations are now idempotent per pair within a family. A deterministic sorted
`directKey` is stored only for DIRECT conversations and protected by a database unique index
`(family_id, direct_key)`. `POST /api/v1/conversations` returns the existing direct chat with
HTTP 200 if it already exists; a newly created chat still returns HTTP 201 and emits
`conversation.created`. The service handles the unique-index race by re-reading and returning
the winning conversation. The migration keeps historical data: when old duplicate direct chats
exist, the earliest active chat is retained as canonical and other duplicates are archived.

Checks: focused Messenger service tests, Prisma format/validate/generate, lint, build, and full
Jest are required before delivery. No frontend files were changed.

# 2026-08-26 Messenger contract hardening

Контракт Messenger выровнен для frontend codegen и параллельных WebSocket-команд.
Swagger теперь описывает response DTO `ConversationResponseDto`, `MessageResponseDto` и
`MessagePageResponseDto`, включая участников с `avatarUrl`, `lastMessage`, `unreadCount` и
cursor-параметры `limit`, `beforeId`, `afterId`. Старые страницы сообщений отдаются в порядке
oldest-to-newest, а `nextCursor` указывает на oldest item текущей страницы — повторов при
дальнейшем `beforeId` не возникает.

HTTP добавлены `POST /api/v1/conversations/:conversationId/messages/:messageId/read` как fallback
к `message.read` и `POST /api/v1/conversations/:conversationId/ownership` с `{ userId }` для
атомарной передачи OWNER существующему участнику группы. Создание/изменение чата, HTTP-команды
сообщений и read fallback публикуют актуальные realtime-события. `conversation.created` и
`conversation.updated` доставляются в персональную Socket.IO room каждого участника.

WebSocket `/messenger` требует UUID `requestId` в каждой команде. Успех и ошибка возвращаются
через ack с этим же `requestId`; ошибки больше не полагаются на глобальный `exception` event.
`presence.updated` теперь всегда содержит `conversationId`. CORS gateway использует тот же
allowlist `CORS_ORIGINS`, что и HTTP, вместо permissive `origin: true`.

Версионированный протокол зафиксирован в `docs/ASYNCAPI_MESSENGER_V1.yaml`: handshake,
client/server events, requestId ack/error и запрет бинарных payload в WebSocket. Дополнительно
`test:e2e:migrate` стал cross-platform через Node script для Windows/CI.

Миграции Prisma не требуются. Проверки: format check, lint, Prisma validate, build, полный Jest
41 suites / 158 tests, E2E 15/15 PASS после изолированного PostgreSQL и `prisma migrate deploy`.
Следующий срез: frontend может регенерировать OpenAPI-типы и подключать AsyncAPI contract; backend
дальше развивает message delivery/read UX только по подтверждённой продуктовой потребности.

# 2026-08-26 Ledger transaction media attachments

Для финансовых операций добавлена many-to-many связь `ledger_transaction_media`.
Она предназначена для чеков и подтверждающих изображений/документов, при этом повторное
прикрепление идемпотентно, а detach, reversal и удаление связи не удаляют S3-объект.

API:

- `GET /api/v1/families/me/ledger/:id/media` — media операции;
- `POST /api/v1/families/me/ledger/:id/media` с `{ "mediaId": "..." }` — attach;
- `DELETE /api/v1/families/me/ledger/:id/media/:mediaId` — detach.

Перед любой операцией повторно применяется существующая finance visibility policy: транзакция
доступна только если все её wallet entries видимы текущему пользователю. Media дополнительно
проверяется по `familyId`; чужие media и невидимые транзакции не раскрываются.
Основные ledger responses не изменены — подробные media выдаются отдельным endpoint.

Миграция: `20260826160000_add_ledger_transaction_media`.
Проверки: Prisma generate/validate, targeted 2/2, полный Jest 39 suites / 144 tests,
lint, format check, build и `git diff --check` PASS.
Следующий шаг: commit/push, production migration и isolated smoke attach/list/detach
на временных данных без затрагивания пользовательских финансовых записей.

# 2026-08-26 Recipe media attachments

Для семейных рецептов добавлена привязка media через новую таблицу
`recipe_media` с composite primary key и каскадным удалением только связи.
Удаление связи, архивация рецепта или удаление meal plan не удаляют S3-объект.
Meal plan использует media рецепта через уже существующую связь с `Recipe`, поэтому
отдельная дублирующая привязка к meal plan не нужна.

API:

- `GET /api/v1/families/me/recipes/:id/media` — список доступных семье media с
  metadata, preview/download URL;
- `POST /api/v1/families/me/recipes/:id/media` с `{ "mediaId": "..." }` — attach;
- `DELETE /api/v1/families/me/recipes/:id/media/:mediaId` — detach.

Чтение и изменение требуют active family membership; media и recipe должны принадлежать
той же семье. Прикреплять и откреплять можно только активный рецепт. Повторный attach
безопасен благодаря composite key и `skipDuplicates`. Существующие recipe/meal-plan
responses не ломались: подробные media возвращаются отдельным endpoint.

Миграция: `20260826150000_add_recipe_media`.
Проверки: targeted Meals Jest 17/17 и backend build PASS.
Контракт усилен: recipe/media route params проходят `ParseUUIDPipe`, Swagger описывает операции
и `404`; S3-объекты не удаляются при detach/archive.
Следующий шаг: полный lint/test/format/Prisma validation, затем production deploy с
migration и isolated smoke attach/list/detach на временных данных.

# 2026-08-20 Local Docker refresh

Обновлены базовые Docker-образы PostgreSQL и Mailpit, production-образ API
пересобран с `node:24.12.0-bookworm-slim`, локальный compose-стек перезапущен.
Применены все 48 Prisma migrations; после перезапуска API health проверен: API и
database доступны. Контейнеры `api`, `postgres`, `mailpit` находятся в healthy.

Локальные endpoints: API `http://localhost:5001`, Mailpit `http://localhost:8025`.
В процессе первого старта worker один раз получил ошибки из-за запуска до миграций;
после миграций API перезапущен, новых ошибок в логах нет. `npm ci` сообщил о 3 high
severity npm audit vulnerabilities и deprecated packages; зависимости не менялись.

Следом: выполнить финальную privacy/retention стабилизацию wellbeing, затем
санировать отсутствующие типы `nodemailer`/`supertest` и прогнать полный lint/test/build.

# 2026-08-20 Wellbeing retention hardening

Maintenance retention теперь атомарно удаляет все wellbeing consent grants,
где anonymized account является owner или recipient, непосредственно перед
анонимизацией пользователя. Это исключает сохранение приватных разрешений после
окончания deletion grace period; wellbeing family/shared records не удаляются.
Добавлен regression-тест на consent cleanup и update пользователя в одной
транзакции. Prisma schema/migrations не менялись; локальный Prisma Client
перегенерирован.

Проверки: targeted Maintenance Jest 2/2, ESLint, Prettier и `git diff --check`.
Следом: расширить retention review на связанные notification/integration artifacts
и затем исправить отсутствующие типы `nodemailer`/`supertest` перед полным build.

# 2026-08-20 Retention notification/integration cleanup

Retention maintenance теперь в одной транзакции с анонимизацией удаляет личные
notification/integration artifacts удалённого пользователя: inbox notifications,
notification preferences, Telegram connection и link tokens, а также pending
`telegram.notify` outbox events по `recipientUserId`. Processing events намеренно
не удаляются: outbox delivery повторно проверяет active connection и не отправит
сообщение после удаления connection. Family/shared сущности не затрагиваются.

Проверки: targeted Maintenance Jest 2/2, ESLint, Prettier и `git diff --check`.
Следом: исправить отсутствующие типы `nodemailer`/`supertest`, затем прогнать полный
lint/test/build.

# 2026-08-20 Full backend checks

Проверено, что `@types/nodemailer` и `@types/supertest` уже присутствуют в
`devDependencies`; изменения зависимостей не потребовались. После регенерации
Prisma Client полный набор локальных проверок проходит: `npm run build`,
`npm run lint`, `npm test` (34 suites, 124 tests), `npm run format:check` и
`git diff --check`.

Следом: провести релизный smoke/E2E-прогон на поднятом Docker backend и затем
подготовить следующий продуктовый срез wellbeing или frontend contract review.

# 2026-08-20 Wellbeing consent privacy hardening

Добавлена server-side проверка: `expiresAt` wellbeing consent должен быть в будущем; просроченные разрешения не создаются и не обновляются. Сохранены active family/owner filters для shared wellbeing read. Миграции не требуются.

Проверки: wellbeing Jest 9/9, targeted ESLint, Prettier и `git diff --check`. SMTP не затрагивался; E2E/staging не запускались.

Следом: при необходимости расширить privacy review на retention/anonymization maintenance-сценарии.

# 2026-08-20 Visibility/consent and lifecycle audit

Проверен backend lifecycle `archive/restore`: shopping, task-routines, meals и финансовые сущности имеют отдельные архивные выборки, восстановление, family ownership и optimistic concurrency где применимо. Для wellbeing усилен shared-consent boundary: данные выдаются только при активной семье, активном владельце и актуальном family membership владельца. Добавлен targeted regression-тест. Swagger-контракты остаются на контроллерах/response DTO; фронтенд и staging не затрагивались.

Проверки: wellbeing Jest 8/8, targeted ESLint, Prettier и `git diff --check` проходят. Полный TypeScript/build по-прежнему блокируется существующими отсутствующими типами `nodemailer` и `supertest`; E2E не запускается согласно правилам репозитория.

Следом: финальная privacy/retention стабилизация wellbeing и локальная Swagger/build-зависимостей санация.

# 2026-08-20 Shopping list lifecycle hardening

Shopping получил отдельный endpoint архивных списков и восстановление списка с проверкой семейного ownership и optional optimistic concurrency version. Архивация также принимает версию; добавлены audit-событие восстановления и targeted unit-тесты. Миграции не требуются. Следом: проверить оставшиеся домены на симметрию archive/restore и visibility consumers.

# 2026-08-20 Calendar child scope projection

Calendar response DTO и projection теперь передают nullable `childId` для child-scoped events/tasks; reminders остаются без child scope. Добавлен regression-тест на mapping и family-scoped query. Проверки: calendar Jest, targeted ESLint, Prettier и diff-check. Следом: backend visibility/consent audit и lifecycle hardening.

# My Love backend — статус реализации

Последняя сверка с кодом: 17 августа 2026 года.

Этот файл — обязательная точка входа для новых backend-агентов. Перед substantial
work сверять записи ниже с фактическими schema/controllers/tests. Frontend находится
в отдельном репозитории и доступен backend-агентам только для чтения контрактов.

## Текущий фокус

Актуально на 17 августа 2026 года: финансовый домен и wellbeing завершены в объёме текущего MVP. Этап 5 начат: реализованы профили детей, задачи и события с привязкой к ребёнку.

- Roadmap: этап 5 — дети, семейные рутины и питание.
- Последний завершённый продуктовый срез: Telegram auth и domain notifications.
- Последний завершённый инфраструктурный срез: production CI/CD через GitHub Actions,
  GHCR и Docker Compose на отдельном сервере.
- Этапы 0 и 1 закрыты в части auth, family foundation, invitations и базового
  календаря. Общая visibility/consent policy завершена и используется финансовым доменом.
- Этап 2 закрыт в текущем MVP-объёме: tasks, routines, shopping, inbox, reminders, dashboard
  и calendar projection доступны; базовые authorization/E2E-проверки и Swagger contracts усилены
  в рамках household hardening.
- Последний завершённый срез: timezone-aware quiet-hours scheduling для Telegram outbox
  при постановке и непосредственно перед delivery.
- Последний завершённый продуктовый срез: financial schema foundation — wallet и
  immutable balanced ledger по ADR 0006.
- Household hardening, scheduled routines, calendar projection и ADR visibility/consent
  завершены в текущем объёме.
- Финансовый MVP закрыт в backend: wallets, immutable ledger и reversal, categories/budgets,
  recurring payments, summary/analytics, goals/envelopes, meetings/decisions и
  partner-only expense statistics реализованы и покрыты targeted unit-тестами.
- Последний завершённый продуктовый срез: financial wallet API.
- Последний завершённый финансовый срез: paginated ledger history, transaction detail
  и idempotent reversal поверх income/expense/transfer-команд.
- Последний инфраструктурный hardening-срез: единый transactional notification producer
  для всех текущих domain events и due reminders.
- Последний завершённый финансовый срез: категории доходов/расходов и месячные
  budget limits с привязкой category к immutable income/expense ledger transaction.
- Последний завершённый финансовый срез: регулярные финансовые операции с forecast и
  Telegram/in-app reminders; они не создают ledger запись автоматически.
- Последний завершённый финансовый срез: visibility-safe monthly financial summary с
  фактическими доходами/расходами по категориям и остатком budget limit.
- Последний завершённый финансовый срез: financial goals/envelopes — выделенный wallet
  на цель, ledger-backed progress и идемпотентные пополнения.
- Последний завершённый финансовый срез: совместные financial meetings/decisions —
  планирование финансовой встречи и подтверждаемое вторым партнёром решение.
- Последний завершённый финансовый срез: фиксирование расходов уже работает через
  immutable ledger; добавлена статистика трат семьи по участникам/категориям за весь
  период или произвольный диапазон дат.
- Следующий срез: финальная privacy/retention стабилизация wellbeing.
  Production SMTP, security/privacy hardening, reliability-настройки и расширенное E2E/CI-покрытие
  сознательно отложены в самый последний этап стабилизации перед релизной готовностью.
  На текущие продуктовые backend-срезы production SMTP не влияет и отдельный акцент на нём
  до завершения остальных доменов не требуется.

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
- Telegram integration boundary: backend хранит linking/connection state, предоставляет
  защищённые integration endpoints и создаёт `telegram.notify` outbox events. Telegram
  transport, команды, polling/webhook и Bot API delivery принадлежат отдельному репозиторию
  `DinarSharipov/my-love-telegram`.
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
`20260817020000_fix_ledger_constraint_triggers`. Всего 32 миграции.

Financial foundation добавляет personal/family wallets, append-only ledger transactions/
entries, reversal link и `FinancialCommandResult`. Deferred PostgreSQL triggers требуют
минимум две balanced entries, совпадение family/currency/category и запрещают update/delete ledger.
Миграция `20260817020000_fix_ledger_constraint_triggers` заменяет общий deferred trigger
двумя обработчиками с точной структурой `NEW` каждой таблицы. Это исправляет production
500 при создании income/expense/transfer, сохраняя те же append-only и balance инварианты.
Миграция `20260816020000_add_budget_categories` добавляет family-shared категории
`INCOME`/`EXPENSE`, optional category к ledger transaction и budget лимит expense-category
на первый день календарного месяца. Бюджет — план, а не изменяемый баланс: его фактическая
сумма будет строиться из видимых immutable ledger entries в summary read model.

Миграция `20260816030000_add_recurring_payments` добавляет регулярные INCOME/EXPENSE
операции, их следующий forecast и отдельный claim состояния напоминания. Они привязаны
к доступному wallet и optional category, но намеренно не создают ledger transaction:
фактическая операция по-прежнему вносится пользователем явно.

Financial summary не хранит производные balances: `GET /api/v1/families/me/finance/summary`
строит выбранный месяц из immutable ledger только для целиком доступных текущему пользователю
wallet entries. Итоги категории сгруппированы по currency; limit и остаток budget считаются
в default currency семьи, поэтому FX conversion намеренно отсутствует.

Миграция `20260816040000_add_financial_goals` добавляет `FinancialGoal` и привязку
пополнения к immutable transfer. Каждая цель создаёт отдельный envelope wallet с теми же
type/visibility правилами, что и обычный wallet. Прогресс — сумма ledger entries этого
wallet; mutable balance не хранится. `POST .../contributions` атомарно создаёт balanced
transfer, contribution и command idempotency result. Private source wallet нельзя
перевести в family envelope, чтобы не раскрывать личную сумму через shared goal. При первом
достижении target автор получает `FINANCIAL_GOAL_ACHIEVED` через unified in-app/Telegram
producer. Активный goal защищает свой envelope от generic wallet archive; после archive
цели сам wallet остаётся доступным для истории и дальнейшего ручного управления.

Financial analytics — additive read model без новой persistence-проекции:
`GET /api/v1/families/me/finance/analytics?periodStart=YYYY-MM-01&months=1..12&forecastDays=1..365`.
Она возвращает фактические income/expense/net по месяцам и валютам, план активных
регулярных операций и projected balance. Фактическая часть и баланс используют тот же
predicate полной видимости ledger transaction, что и history; регулярные операции
ограничены видимыми wallet. Поэтому личные суммы и планы не попадают партнёру без
видимости кошелька. Значения — строки minor units; FX conversion отсутствует. Прогноз
не создаёт ledger transaction и не считает regular payment фактической операцией.

Expense statistics — отдельный partner-only read model без новой persistence-проекции:
`GET /api/v1/families/me/finance/expense-statistics?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`.
Без параметров он охватывает весь период; границы включительны. Отчёт строится только из
immutable `EXPENSE` и reversal таких расходов, группирует суммы minor units по валюте,
создателю исходной траты и категории. Reversal относится к автору исходного расхода, а
не к пользователю, который выполнил отмену. Его видят только партнёры, поскольку он
намеренно сводит все личные и семейные wallet семьи. Категорию теперь вправе создать
любой активный участник семьи; изменить/архивировать — её автор или партнёр.

Миграция `20260817010000_add_financial_meetings` добавляет partner-only сущности
`FinancialMeeting` и вложенные `FinancialDecision`. Встреча имеет расписание, заметки,
статус и version; решение создаётся в рамках встречи, а согласовать либо отклонить его
может только второй партнёр. Отменённая встреча не принимает новых решений. Все изменения
пишутся в audit; адресные уведомления второму партнёру или автору решения проходят через
единый in-app/Telegram producer в той же транзакции. Это отдельный coordination-домен:
он не раскрывает сумму, wallet или ledger data и не создаёт финансовую операцию.

## Проверки на момент сверки

- `npm run lint` — passed.
- `npm test -- --runInBand` — 29 suites / 82 tests passed.
- `npm run build` — passed.
- `npm run test:e2e:verify` — 10 scenarios passed на чистой БД; все 30 миграций
  последовательно применились.
- Production Docker image собран; backend entrypoint — `dist/main.js`. Telegram transport
  не входит в backend image.
- Рабочий Docker API: `http://localhost:5001`, health healthy, schema up to date.

## Известные пробелы и решения

- Отложено в самый последний этап стабилизации: production SMTP, не блокирующие основной
  функционал security/privacy улучшения, reliability hardening и расширение E2E/CI.
  Эти работы не должны прерывать реализацию продуктовых доменов и не являются текущим
  приоритетом без отдельного решения.

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
- Telegram transport вынесен в отдельный репозиторий `DinarSharipov/my-love-telegram`;
  его production deployment должен предоставить bot token, polling или публичный HTTPS
  webhook и secrets. Backend repository отвечает только за integration API и outbox.
- Quiet hours применяются к Telegram. Общий domain email notification producer не нужен
  по принятой channel policy; security email доставляется немедленно.
- Household ownership покрыт unit и общим cross-family E2E critical path; CI пока не
  запускает PostgreSQL E2E suite.
- Shopping check/uncheck принимает optional `If-Match` и проверяет соответствие item сегменту
  `listId`; tasks используют общий строгий parser concurrency header.
- Для запуска Telegram gateway на production всё ещё нужен bot token от BotFather; без него
  нельзя зарегистрировать webhook или выполнять реальные отправки через Telegram Bot API.
- Production Compose backend намеренно не запускает Telegram transport и не публикует webhook
  route. BotFather token, режим запуска, webhook/polling и внешний HTTPS настраиваются в
  `DinarSharipov/my-love-telegram`.
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
- Frontend follow-up (выполняет отдельный frontend-агент): добавить экран регулярных
  операций: `POST/GET/PATCH/DELETE /families/me/recurring-payments` и
  `GET /families/me/recurring-payments/:id/forecasts`. `amountMinor` передаётся и
  возвращается строкой; `nextDueAt` — ISO datetime; период — WEEKLY/MONTHLY с
  `interval`; получатели Telegram/in-app reminder задаются в `reminderRecipientIds`.
  Создание регулярной операции — это прогноз, а не автоматическое изменение баланса.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить monthly finance summary
  через `GET /families/me/finance/summary?periodStart=YYYY-MM-01`. `periodStart` optional
  (по умолчанию текущий UTC-месяц); суммы `actual[].amountMinor`, `budget.limitMinor`,
  `budget.actualMinor` и `budget.remainingMinor` — строки. Отображать `actual` раздельно
  по currency; budget remainder осмыслен только для `defaultCurrency` семьи, FX conversion
  backend намеренно не делает.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить goals/envelopes через
  `POST/GET/PATCH/DELETE /families/me/financial-goals` и пополнение
  `POST /families/me/financial-goals/:id/contributions`. Создание цели создаёт выделенный
  wallet: `type`/`visibility` имеют те же значения, что у wallet; `targetAmountMinor` и
  contribution `amountMinor` — строки, `targetDate` — optional `YYYY-MM-DD`. Для PATCH/DELETE
  передавать `If-Match` из `version`; для каждого пополнения — новый `Idempotency-Key`.
  Показывать `currentAmountMinor`/`remainingAmountMinor` как строки. В текущем frontend RTK
  Query этих endpoint ещё нет; существующие contracts wallets/ledger не изменены.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить finance analytics через
  `GET /families/me/finance/analytics?periodStart=YYYY-MM-01&months=1..12&forecastDays=1..365`.
  `cashFlow[].actual` — фактический поток, `cashFlow[].mandatory` — только план активных
  recurring payments; оба разделены по currency и содержат строковые `incomeMinor`,
  `expenseMinor`, `netMinor`. `balanceForecast` содержит доступный текущий остаток и
  прогноз на окно `forecastAsOf`–`forecastThrough`; это не банковская сверка и не
  auto-posting. Endpoint additive, текущие RTK Query contracts не изменены.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить создание категории
  через `POST /families/me/financial-categories` для активного участника семьи и экран
  partner-only статистики через `GET /families/me/finance/expense-statistics`. Параметры
  `dateFrom`/`dateTo` optional и имеют вид `YYYY-MM-DD`; без них отчёт охватывает всю
  историю. Все суммы `totals[].amountMinor` — строки minor units, breakdown идёт по
  `members[]` и их `categories[]`; FX conversion отсутствует.
- Frontend follow-up (выполняет отдельный frontend-агент): добавить partner-only экран
  финансовых встреч: `POST/GET/PATCH/DELETE /families/me/financial-meetings`,
  `POST /:id/complete`, создание решения `POST /:id/decisions` и ответ второго партнёра
  `POST /:meetingId/decisions/:decisionId/respond`. Для update/complete/delete/respond
  передавать `If-Match` из `version`; решение принимает только `AGREED` или `REJECTED`.
  В текущем frontend RTK Query этих endpoint нет; существующие contracts не изменены.

## Finance: MVP завершён

- Финансовый backend-срез завершён; отдельные frontend follow-up из раздела выше не являются
  backend-блокерами и выполняются frontend-агентом по актуальному Swagger-контракту.
- Проверка 17 августа 2026: 11 finance unit suites, 27 tests — passed.

## Wellbeing: private check-ins

- Добавлена миграция `20260817030000_add_wellbeing_check_ins` и модель `WellbeingCheckIn`.
- Добавлен owner-only API: `POST/GET /families/me/wellbeing/check-ins`, `GET/DELETE /:id`.
- Check-in хранит шкалы `mood`, `energy`, `stress` от 1 до 5, приватную заметку и `supportRequest`.
- Доступ требует active family membership; чужие записи не раскрываются и возвращают 404.
- Добавлен scoped consent API: `POST/GET /families/me/wellbeing/check-ins/consents`, отзыв через
  `DELETE /families/me/wellbeing/check-ins/consents/:id` и чтение разрешённых полей партнёра через
  `GET /families/me/wellbeing/check-ins/shared-with-me`.
- Consent выдаётся только активному партнёру той же семьи, поддерживает scopes `mood`, `energy`,
  `stress`, `supportRequest` и optional expiry; `note` намеренно не входит в публикуемые scopes.
- Grant хранится отдельной FK-backed моделью, повторная выдача обновляет существующий grant,
  отзыв делает его недействительным без удаления истории.
- Добавлен owner-only WHO-5 API: `POST/GET /families/me/wellbeing/check-ins/assessments`;
  принимаются ровно 5 ответов `0..5`, score вычисляется backend прозрачно как сумма.
- Добавлены owner-only `GET /trends` и `GET /export`, а также `DELETE /families/me/wellbeing/check-ins`
  для атомарного hard delete check-ins, assessments и consent grants владельца.
- Добавлена миграция `20260817060000_add_wellbeing_gratitudes` и API `POST/GET
/families/me/wellbeing/check-ins/gratitudes`, `DELETE /gratitudes/:id`: благодарность адресуется
  только активному partner той же семьи, видна участникам этой семьи и удаляется только автором.
  Уведомление нейтральное и не содержит текст благодарности.

Проверки: Prisma Client regenerated, targeted ESLint, wellbeing tests (6/6) и `git diff --check` пройдены.
Полный `tsc` сейчас блокируется существующими отсутствующими типами `nodemailer` и `supertest`, не связанными с wellbeing.

## Журнал backend-срезов

| Дата       | Срез                                      | Миграция/API                                                                                                                                                                                                                                                                          | Проверки                                                                                                                                  | Следующий шаг                                                                          |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 2026-08-15 | Foundation                                | roles/lifecycle/membership policy, DB partner limit                                                                                                                                                                                                                                   | lint, unit, e2e, build                                                                                                                    | API contracts                                                                          |
| 2026-08-15 | API contracts                             | error/request ID, pagination/date/time/money                                                                                                                                                                                                                                          | lint, unit, e2e, build                                                                                                                    | concurrency                                                                            |
| 2026-08-15 | Concurrency                               | version/If-Match для first-date/events                                                                                                                                                                                                                                                | generate, lint, unit, e2e, build                                                                                                          | idempotency                                                                            |
| 2026-08-15 | Idempotency                               | optional key, payload conflict, response replay                                                                                                                                                                                                                                       | generate, lint, unit, e2e, build                                                                                                          | closed invite                                                                          |
| 2026-08-15 | Closed invite                             | private email/link create/list/accept/revoke                                                                                                                                                                                                                                          | migration, unit, e2e, build                                                                                                               | profile                                                                                |
| 2026-08-15 | Profile                                   | `GET/PATCH /users/me`, locale/timezone/version                                                                                                                                                                                                                                        | migration, 24 unit, 3 e2e, build                                                                                                          | password/sessions                                                                      |
| 2026-08-15 | Password/sessions                         | metadata/list/revoke/revoke others, смена password с отзывом других JWT                                                                                                                                                                                                               | migration, 24 unit, 4 e2e, build                                                                                                          | outbox/email adapter                                                                   |
| 2026-08-15 | Outbox/email foundation                   | durable outbox, worker/retry/stale-lock recovery, безопасный logging email adapter                                                                                                                                                                                                    | migration, 24 unit, 5 e2e, build                                                                                                          | protected forgot/reset password                                                        |
| 2026-08-15 | Password reset                            | request/confirm, hash token, encrypted email outbox payload, session revocation                                                                                                                                                                                                       | migration, 24 unit, 6 e2e, build                                                                                                          | email confirmation/account lifecycle                                                   |
| 2026-08-15 | Local SMTP                                | Mailpit service, Nodemailer SMTP adapter, Compose SMTP wiring и inbox verification                                                                                                                                                                                                    | lint, unit, e2e, Docker build, SMTP smoke test                                                                                            | production SMTP credentials / email confirmation                                       |
| 2026-08-16 | Unified notifications                     | due task reminders переведены на `NotificationProducerService`; inbox и Telegram outbox создаются единообразно и атомарно с claim reminder                                                                                                                                            | lint, 22 unit suites / 64 tests, build                                                                                                    | financial ledger commands                                                              |
| 2026-08-16 | Family event reminders                    | миграция `20260816010000_add_family_event_reminders`; first offset, family recipients и exact repeat reminder, minute delivery worker через unified producer                                                                                                                          | generate, lint, 22 unit suites / 66 tests, build, diff-check                                                                              | frontend event reminder controls                                                       |
| 2026-08-15 | Email change                              | re-auth request, one-time hash token, encrypted confirmation email, email update и revocation всех sessions                                                                                                                                                                           | generate, lint, 24 unit, 7 e2e, build                                                                                                     | account lifecycle / cleanup jobs                                                       |
| 2026-08-15 | Account deactivation                      | re-auth request, configurable grace period, encrypted recovery link, session revocation, cancellation исходящих invitations и одноразовое восстановление                                                                                                                              | generate, lint, 24 unit, 8 e2e, build                                                                                                     | cleanup jobs / retention policy / account export                                       |
| 2026-08-15 | Cleanup worker                            | периодическая очистка истёкших sessions/tokens и перевод просроченных invitations в `EXPIRED`                                                                                                                                                                                         | lint, 25 unit, 8 e2e, build                                                                                                               | retention policy / account export                                                      |
| 2026-08-15 | Account export                            | `GET /api/v1/users/me/export`, безопасный JSON-экспорт профиля, family data и приглашений без секретов                                                                                                                                                                                | lint, 25 unit, build                                                                                                                      | retention policy для завершивших grace period аккаунтов                                |
| 2026-08-15 | Retention policy                          | новая миграция `20260815100000_add_retention_anonymized_at`, opt-in worker анонимизации истёкших аккаунтов с сохранением shared data                                                                                                                                                  | generate, lint, 25 unit, build                                                                                                            | полный family lifecycle API                                                            |
| 2026-08-15 | Family lifecycle                          | `DELETE /families/me/membership`, `POST /families/me/archive`, атомарная смена статуса и отмена pending invitations                                                                                                                                                                   | lint, 25 unit, build                                                                                                                      | подтверждение расформирования и audit events                                           |
| 2026-08-15 | Dissolution confirmation                  | миграция `20260815110000_add_family_dissolution_requests`, request/confirm/cancel API с обязательным вторым партнёром                                                                                                                                                                 | generate, lint, 25 unit, build                                                                                                            | audit events                                                                           |
| 2026-08-15 | Audit events                              | миграция `20260815120000_add_audit_events`, внутренний append-only журнал family lifecycle без секретов                                                                                                                                                                               | generate, lint, 25 unit, build, diff-check                                                                                                | полный family lifecycle API                                                            |
| 2026-08-15 | Family restore                            | `POST /families/me/restore`, партнёрская авторизация, атомарное возвращение `ARCHIVED` в `ACTIVE` и audit event                                                                                                                                                                       | lint, 25 unit, build, diff-check                                                                                                          | audit history read API                                                                 |
| 2026-08-15 | Audit history read                        | `GET /families/me/audit-events` с общей page/limit пагинацией и проверкой active membership                                                                                                                                                                                           | lint, 25 unit, build, diff-check                                                                                                          | административные family lifecycle сценарии                                             |
| 2026-08-15 | Audit history filters                     | фильтры `action` и `resourceType` без изменения базового endpoint/response contract                                                                                                                                                                                                   | lint, 25 unit, build, diff-check                                                                                                          | этап 2: tasks и task-routines                                                          |
| 2026-08-15 | Tasks                                     | миграция `20260815130000_add_tasks`, CRUD/complete/reopen/archive, family membership и optimistic concurrency                                                                                                                                                                         | generate, lint, 25 unit, build, diff-check                                                                                                | task-routines                                                                          |
| 2026-08-15 | Task routines                             | миграция `20260815140000_add_task_routines`, DAILY/WEEKLY шаблоны и атомарная генерация Task                                                                                                                                                                                          | generate, lint, 25 unit, build, diff-check                                                                                                | shopping lists                                                                         |
| 2026-08-15 | Shopping lists                            | миграция `20260815150000_add_shopping_lists`, family-scoped списки/позиции, check/uncheck и archive                                                                                                                                                                                   | generate, lint, 25 unit, build, diff-check                                                                                                | notifications и reminders                                                              |
| 2026-08-15 | Notifications inbox                       | миграция `20260815160000_add_notifications`, user/family-scoped inbox и mark read/read-all                                                                                                                                                                                            | generate, lint, 25 unit, build, diff-check                                                                                                | reminders и notification producers                                                     |
| 2026-08-15 | Task reminders                            | миграция `20260815170000_add_task_reminders`, task reminder API и atomic maintenance delivery в notifications                                                                                                                                                                         | generate, lint, 25 unit, build, diff-check                                                                                                | dashboard/cockpit агрегаты                                                             |
| 2026-08-15 | Dashboard aggregates                      | `GET /families/me/dashboard`, агрегаты tasks/shopping/notifications/events без новой миграции                                                                                                                                                                                         | lint, 25 unit, build, diff-check                                                                                                          | notification preferences и quiet hours                                                 |
| 2026-08-15 | Notification preferences                  | миграция `20260815180000_add_notification_preferences`, GET/PATCH preferences и HH:mm validation                                                                                                                                                                                      | generate, lint, 25 unit, build, diff-check                                                                                                | notification producers                                                                 |
| 2026-08-15 | Notification producers                    | общий producer для family members, события задач и shopping с учётом in-app preferences                                                                                                                                                                                               | generate, lint, unit, build, diff-check                                                                                                   | family events и email-канал                                                            |
| 2026-08-15 | Telegram delivery hardening               | validated DTO/Swagger, atomic single-use exchange, optional integration boundary, token cleanup, `telegram.notify` outbox и log/HTTP providers                                                                                                                                        | generate, lint, 28 unit, 9 e2e, build, 25 migrations on clean DB                                                                          | внешний Telegram bot/gateway и quiet-hours scheduling                                  |
| 2026-08-20 | Telegram transport ownership              | удалён дублирующий Nest gateway, webhook/Bot API client, команды и Compose profile; backend оставляет linking, integration API и outbox-контракт для `DinarSharipov/my-love-telegram`                                                                                                 | targeted TypeScript/build, Compose config, diff-check                                                                                     | внешний репозиторий отвечает за transport deployment                                   |
| 2026-08-15 | Production CI/CD                          | GitHub Actions test/build/GHCR/deploy pipeline, production Compose, отдельный deploy user/key, migration и health gates                                                                                                                                                               | lint, 32 unit, build, Compose config, server SSH/Docker smoke-check                                                                       | merge PR и проверить первый production workflow                                        |
| 2026-08-15 | Permanent Telegram authorization          | бессрочная `TelegramConnection` после одноразовой привязки; `/start` повторно использует активную связь без нового кода                                                                                                                                                               | targeted unit, lint, build                                                                                                                | quiet-hours scheduling для Telegram/email                                              |
| 2026-08-15 | Telegram auth and domain notifications    | `/auth`/`/link`/`/start` linking, persistent bot identity, direct/family notification producer; invitations, events, first date, lifecycle, tasks/routines, shopping и reminders создают Telegram outbox                                                                              | lint, 37 unit, 9 e2e, build, diff-check                                                                                                   | добавить BotFather token и включить gateway/webhook на production                      |
| 2026-08-16 | Documentation sync                        | статус и backend backlog сверены с 25 миграциями, controllers, tests и read-only frontend status; устранены устаревшие next-slice/gap записи                                                                                                                                          | diff-check                                                                                                                                | quiet-hours scheduling                                                                 |
| 2026-08-16 | Quiet-hours scheduling                    | timezone-aware расчёт `availableAt` для Telegram producers/reminders и повторная проверка preferences перед delivery; in-app остаётся мгновенным                                                                                                                                      | format, lint, 12 suites / 42 unit, build, diff-check                                                                                      | hardening tasks/shopping/notifications/reminders                                       |
| 2026-08-16 | Household hardening I                     | общий строгий `If-Match` для tasks, list/item scope и concurrency для shopping, валидные quiet-hours preferences, точные shopping Swagger DTO                                                                                                                                         | lint, 15 suites / 46 unit, build, diff-check                                                                                              | scheduled task routines                                                                |
| 2026-08-16 | Scheduled task routines                   | maintenance generation due DAILY/WEEKLY routines; атомарный CAS claim, task и audit, ограничение одного catch-up occurrence на routine за проход                                                                                                                                      | lint, 16 suites / 48 unit, 9 e2e на чистой БД, 25 migrations, build, diff-check                                                           | продолжить household hardening                                                         |
| 2026-08-16 | Household hardening II                    | ownership tests/E2E для tasks, shopping, notifications/reminders; additive `GET /notifications/page`; точные notification/reminder/dashboard DTO                                                                                                                                      | lint, 19 suites / 54 unit, 10 e2e, build, diff-check                                                                                      | calendar projection                                                                    |
| 2026-08-16 | Calendar projection                       | additive `GET /families/me/calendar`, family events + tasks + private reminders, local-date range до 93 дней, 500 entries + `truncated`                                                                                                                                               | lint, 20 suites / 56 unit, 10 e2e, build, diff-check                                                                                      | visibility/consent ADR                                                                 |
| 2026-08-16 | Visibility/consent foundation             | ADR 0005 и общая pure policy owner/same-family/scoped consent без premature polymorphic persistence                                                                                                                                                                                   | lint, 21 suites / 59 unit, build, diff-check                                                                                              | financial foundation                                                                   |
| 2026-08-16 | Financial schema foundation               | ADR 0006, migration `20260816000000_add_financial_foundation`: wallet, immutable balanced ledger, reversal и transactional command result                                                                                                                                             | generate, validate, lint, 21 suites / 59 unit, 10 e2e, 26 migrations, build, diff-check                                                   | wallet API и idempotent ledger commands                                                |
| 2026-08-16 | Financial wallet API                      | `POST/GET/PATCH/DELETE /families/me/wallets`; server-owned family/owner, PRIVATE/PARTNER/FAMILY reads, partner-only family wallet management, concurrency и audit                                                                                                                     | lint, 22 suites / 64 unit, build, diff-check                                                                                              | idempotent ledger commands                                                             |
| 2026-08-16 | Ledger commands                           | `POST /families/me/ledger/income`, `/expense`, `/transfer`; mandatory command-local idempotency, immutable balanced entries, wallet access/currency validation и safe string minor-unit response                                                                                      | generate, targeted unit, lint, build, diff-check                                                                                          | ledger history и reversal commands                                                     |
| 2026-08-16 | Ledger history и reversal                 | `GET /families/me/ledger`, `GET /:id`, `POST /:id/reversal`; paginated visibility-safe history, immutable inverse entries, idempotency и race-safe single reversal                                                                                                                    | 24 unit suites / 71 tests, lint, build, diff-check                                                                                        | budgets и recurring financial operations                                               |
| 2026-08-16 | Budget categories                         | миграция `20260816020000_add_budget_categories`; family income/expense categories, optional category в income/expense/reversal ledger, CRUD месячных expense budget limits с optimistic locking и audit                                                                               | generate, 25 unit suites / 74 tests, lint, чистый 28-migration E2E, build, diff-check                                                     | recurring payment forecast/reminders                                                   |
| 2026-08-16 | Recurring payments                        | миграция `20260816030000_add_recurring_payments`; wallet/category-scoped WEEKLY/MONTHLY forecast, CRUD/visibility/concurrency, durable claim и unified in-app/Telegram reminders; без auto-posting в ledger                                                                           | generate, lint, 26 unit suites / 76 tests, чистый 29-migration E2E, build, diff-check                                                     | financial summary и фактические budget totals                                          |
| 2026-08-16 | Financial summary                         | `GET /families/me/finance/summary`; monthly category totals из visibility-safe immutable ledger, budget actual/remaining в default currency и отдельные totals для каждой currency без FX                                                                                             | lint, targeted unit, build, diff-check                                                                                                    | financial goals/envelopes                                                              |
| 2026-08-17 | Financial goals/envelopes                 | миграция `20260816040000_add_financial_goals`; dedicated envelope wallet, ledger-derived progress, idempotent contribution transfer и achievement notification                                                                                                                        | generate, lint, 28 unit suites / 80 tests, чистый 30-migration E2E, build, diff-check                                                     | financial analytics                                                                    |
| 2026-08-17 | Financial analytics                       | `GET /families/me/finance/analytics`; visibility-safe multi-month actual cash flow, recurring mandatory plan и projected visible balances без новой projection/auto-posting                                                                                                           | targeted/full unit, lint, clean 30-migration E2E, build, diff-check                                                                       | financial meetings/decisions или wellbeing                                             |
| 2026-08-17 | Financial meetings/decisions              | Миграция `20260817010000_add_financial_meetings`; partner-only meetings, nested decisions, second-partner response и transactional Telegram/in-app notifications                                                                                                                      | targeted/full unit, lint, clean 31-migration E2E, build, diff-check                                                                       | wellbeing-домен                                                                        |
| 2026-08-17 | Expense recording and family statistics   | Existing idempotent `ledger/expense` confirmed; category creation for every member, author/partner management and additive partner-only `GET /finance/expense-statistics` for all-time/date-range member/category totals                                                              | targeted/full unit, lint, build, clean 31-migration E2E, diff-check                                                                       | wellbeing-домен                                                                        |
| 2026-08-17 | Ledger trigger correction                 | миграция `20260817020000_fix_ledger_constraint_triggers`: раздельные deferred handlers для transaction/entry исправляют 500 на финансовых командах; добавлен реальный E2E expense сценарий                                                                                            | lint, full unit, clean 32-migration E2E, build, diff-check                                                                                | wellbeing-домен                                                                        |
| 2026-08-17 | Wellbeing check-ins и consent             | миграция `20260817030000_add_wellbeing_check_ins` и `20260817040000_add_wellbeing_consent_grants`; private check-ins, scoped partner consent, expiry/revoke и shared read без `note`                                                                                                  | Prisma generate, targeted ESLint, wellbeing 3/3 unit, tsc ограничен отсутствующими `nodemailer`/`supertest`, diff-check                   | wellbeing hardening, retention/privacy и child profiles                                |
| 2026-08-17 | Wellbeing private completion              | миграция `20260817050000_add_wellbeing_assessments`; owner-only WHO-5, trends, export и атомарный hard delete wellbeing data                                                                                                                                                          | Prisma generate, targeted ESLint, wellbeing 5/5 unit, tsc ограничен отсутствующими `nodemailer`/`supertest`, diff-check                   | совместные wellbeing-сценарии и финальная privacy/retention стабилизация               |
| 2026-08-17 | Wellbeing gratitude                       | миграция `20260817060000_add_wellbeing_gratitudes`; адресные благодарности партнёру, family scope, author-only delete и нейтральное уведомление без текста                                                                                                                            | Prisma generate, targeted ESLint, wellbeing 6/6 unit, diff-check                                                                          | privacy/retention стабилизация wellbeing                                               |
| 2026-08-17 | Wellbeing support request                 | миграция `20260817070000_add_wellbeing_support_requests`; адресный запрос поддержки между партнёрами, статусы OPEN/ACKNOWLEDGED/CLOSED и нейтральное уведомление                                                                                                                      | Prisma generate, targeted ESLint, wellbeing 6/6 unit, diff-check                                                                          | privacy/retention стабилизация wellbeing                                               |
| 2026-08-17 | Wellbeing ritual                          | миграция `20260817080000_add_wellbeing_rituals`; семейные ритуалы с cadence/nextAt, активностью и авторским CRUD                                                                                                                                                                      | Prisma generate, targeted ESLint, wellbeing 6/6 unit, diff-check                                                                          | CoupleMeeting и privacy/retention                                                      |
| 2026-08-17 | Wellbeing CoupleMeeting                   | миграция `20260817090000_add_wellbeing_couple_meetings`; weekly-встречи с секциями, приватными ответами до publish и отдельным shared decision                                                                                                                                        | Prisma generate, targeted ESLint, wellbeing 6/6 unit, diff-check                                                                          | финальная privacy/retention стабилизация wellbeing                                     |
| 2026-08-17 | Wellbeing privacy/retention stabilization | wellbeing export расширен на все реализованные сущности с ownership/participant scope; hard delete удаляет личные и адресованные пользователю записи, а partner-owned rituals/meetings сохраняет                                                                                      | Prisma generate, targeted ESLint, wellbeing 7/7 unit, diff-check                                                                          | следующий slice по roadmap                                                             |
| 2026-08-17 | Child profiles: этап 5, первый срез       | миграция `20260817100000_add_child_profiles`; `POST/GET/PATCH/DELETE /families/me/children`, профили принадлежат семье, управляются только `PARTNER`, читаются любым активным членом; credentials и sensitive medical/school notes не добавляются                                     | Prisma format/generate/validate, targeted ESLint, child profile 4/4 unit, diff-check; полный build блокируется отсутствующим `nodemailer` | child-scoped tasks/events и privacy policy для чувствительных полей                    |
| 2026-08-17 | Child-scoped tasks                        | миграция `20260817110000_add_child_to_tasks`; additive `childId` в task create/update/response, серверная проверка принадлежности ребёнка текущей семье и индекс family/child/status                                                                                                  | Prisma format/generate/validate, tasks 3/3 unit, targeted ESLint, diff-check                                                              | child-scoped events и privacy policy для чувствительных полей                          |
| 2026-08-17 | Child-scoped family events                | миграция `20260817120000_add_child_to_family_events`; additive `childId` в create/update/response, server-side family ownership check и индекс family/child/scheduledAt                                                                                                               | Prisma format/generate/validate, family-events 7/7 unit, targeted ESLint, diff-check                                                      | privacy policy для чувствительных детских полей                                        |
| 2026-08-17 | Child privacy-safe export                 | `GET /families/me/children/:id/export` для активного члена семьи; экспортирует только минимальный профиль, child-scoped tasks и неудалённые child-scoped events; sensitive medical/school/credentials поля отсутствуют, удаление профиля отвязывает связанные записи через `SET NULL` | Prisma generate, targeted ESLint, child profile 5/5 unit, diff-check                                                                      | семейные routines и meals; отдельная legal/privacy review перед чувствительными полями |
| 2026-08-16 | Notification channel policy               | domain notifications только in-app/Telegram; email только security/account recovery; production bot readiness checklist                                                                                                                                                               | code/config audit                                                                                                                         | production gateway wiring после получения hostname/token/secrets                       |
| 2026-08-16 | Приоритизация roadmap                     | основной пользовательский функционал впереди; SMTP, hardening и расширенные E2E/CI отложены до финальной стабилизации                                                                                                                                                                 | status review                                                                                                                             | idempotent financial ledger commands                                                   |

| 2026-08-17 | Child-scoped task routines | migration 20260817130000_add_child_to_task_routines; optional childId with server-side family ownership validation, generated tasks retain child scope, SET NULL on child deletion | Prisma format/generate, task-routines 2/2 unit, targeted ESLint, diff-check | meals and household hardening |

| 2026-08-17 | Meals: family recipes | migration 20260817140000_add_recipes; family-scoped recipe CRUD with ingredients, no allergy/medical fields, archive preserves history | Prisma format/generate, targeted ESLint, diff-check | meal plans and idempotent shopping generation |

| 2026-08-17 | Meals: meal plans and shopping generation | migration 20260817150000_add_meal_plans; family-scoped meal plans by local date/slot and recipe, `POST /families/me/recipes/plans/:id/generate-shopping`; unique source keys make retries idempotent and preserve manual shopping items | Prisma format/generate, targeted ESLint, diff-check; TypeScript limited by existing nodemailer/supertest dependencies | dietary labels and explicit meal-plan listing/update |

| 2026-08-17 | Meals: meal-plan listing/update | `GET /families/me/recipes/plans?from=&to=` and `PATCH /families/me/recipes/plans/:id`; date-range ordering, family-scoped ownership and active-recipe validation, DB uniqueness for family/date/slot conflicts | Prisma format/generate, targeted ESLint, diff-check; TypeScript remains limited by existing nodemailer/supertest dependencies | dietary labels and meal-domain authorization tests |

| 2026-08-17 | Meals: dietary labels | migration `20260817160000_add_recipe_dietary_labels`; normalized, family-inherited recipe labels with deduplication and bounded validation; labels are descriptive only and do not represent allergy or medical advice | Prisma format/generate, targeted ESLint, diff-check; TypeScript remains limited by existing nodemailer/supertest dependencies | meal-domain authorization tests and frontend contract adoption |

| 2026-08-17 | Meals: contract hardening | explicit validated `from`/`to` query DTO for meal-plan listing; meal-plan updates now return dietary labels consistently; family and active-recipe checks remain server-side | Prisma format/generate, targeted ESLint, diff-check; TypeScript remains limited by existing nodemailer/supertest dependencies | meal-domain authorization tests and frontend contract adoption |
| 2026-08-20 | Meals: authorization regression hardening | добавлен `meals.service.spec.ts` с проверками family ownership для создания плана, обновления плана и генерации shopping; проверены archive boundary рецептов через family-scoped queries и нормализация/deduplication dietary labels | targeted Jest 4/4, Prettier, ESLint, `git diff --check` | frontend contract adoption и meal-domain E2E authorization |
| 2026-08-20 | Meals: E2E authorization coverage | добавлен E2E-сценарий family boundary для recipes, meal plans, dietary labels, archived recipes и shopping generation | Prisma migrations на чистой E2E-БД применены; запуск E2E заблокирован отсутствующим runtime `nodemailer` и отсутствующими типами `supertest` в текущем checkout; Unix-style npm scripts также требуют PowerShell-эквивалента на Windows | после восстановления зависимостей повторить E2E; затем privacy/legal review детских данных |
| 2026-08-20 | Child privacy export hardening | экспорт child profile переведён на явный allowlist полей для профиля, child-scoped tasks и неудалённых events; будущие sensitive/служебные поля не попадут в API автоматически | targeted Jest 5/5, Prettier; E2E не является обязательным CI-gate | семейные routines и meals hardening |
| 2026-08-20 | Family task-routine lifecycle hardening | `PATCH /families/me/task-routines/:id` с validated partial DTO, active-family scope, проверкой assignee/child и optional `If-Match` optimistic concurrency; update пишет audit и family notification | task-routines Jest 5/5, targeted ESLint, Prettier, diff-check; E2E не является обязательным CI-gate | meals hardening или дальнейшее расширение семейных routines |
| 2026-08-20 | Meals: meal-plan concurrency hardening | migration `20260820000000_add_meal_plan_version`; `PATCH /families/me/recipes/plans/:id` поддерживает optional `If-Match`, атомарно инкрементирует version и возвращает 409 при stale update; конфликт уникального family/date/slot также нормализован в 409 | Prisma format/generate/validate, meals Jest 6/6, targeted ESLint, diff-check; E2E не является обязательным CI-gate | lifecycle meal plans или дальнейшее расширение семейных routines |
| 2026-08-20 | Meals: meal-plan cancellation | `DELETE /families/me/recipes/plans/:id` удаляет только plan в scope активной семьи и не раскрывает foreign ID; уже сгенерированные shopping items намеренно сохраняются как пользовательское состояние списка | meals Jest 8/8, targeted ESLint, Prettier, diff-check; E2E не является обязательным CI-gate | дальнейшее расширение семейных routines или meal recipes lifecycle |
| 2026-08-20 | Meals: recipe lifecycle update | migration `20260820010000_add_recipe_version`; `PATCH /families/me/recipes/:id` частично обновляет рецепт, атомарно заменяет явно переданные ingredients и dietary labels и поддерживает optional `If-Match` optimistic concurrency. Рецепт является live source для существующих meal plans; уже сгенерированные shopping items не изменяются, чтобы сохранить ручные правки | Prisma format/generate/validate, meals Jest 11/11, targeted ESLint, Prettier, diff-check; E2E не является обязательным CI-gate | frontend contract adoption; при продуктовой необходимости — restore/archive policy recipe |
| 2026-08-20 | Meals: recipe archive lifecycle | additive `GET /families/me/recipes/archived` и `POST /families/me/recipes/:id/restore`; archive и restore поддерживают optional `If-Match`, меняют version и не раскрывают foreign ID. `RecipeResponseDto` теперь явно содержит `archived`; восстановленный рецепт снова доступен для планирования | meals Jest 14/14, targeted ESLint, Prettier, diff-check; E2E не является обязательным CI-gate | backend meal-domain audit/notifications либо дальнейшее расширение семейных routines |
| 2026-08-20 | Meals: audit and notifications | recipes создают audit/notification при create/update/archive/restore; meal plans — при create/update/cancel. Генерация shopping из плана фиксируется в audit без отдельного уведомления, чтобы не создавать шум; получатели — только другие члены семьи через общий preference-aware in-app/Telegram producer | meals Jest 14/14 с audit/notification assertions, targeted ESLint, Prettier, diff-check; E2E не является обязательным CI-gate | дальнейшее расширение семейных routines |
| 2026-08-20 | Family task-routine archive lifecycle | Активные и архивные рутины разделены; additive `GET /families/me/task-routines/archived` и `POST /families/me/task-routines/:id/restore` используют family scope и optional `If-Match`. Archive также принимает `If-Match`; restore сохраняет `nextRunAt`, пишет audit и отправляет family notification | task-routines Jest 10/10, targeted ESLint и Prettier; E2E не является обязательным CI-gate | policy исполнения рутин и обработка просроченного backlog |
| 2026-08-20 | Task-routine overdue backlog policy | Генерация создаёт одну текущую задачу для просроченной рутины, переводит `nextRunAt` сразу за `now` и пропускает исторические occurrences; это предотвращает постепенное накопление catch-up backlog после восстановления | task-routines Jest 11/11, targeted ESLint, Prettier и `git diff --check`; E2E не является обязательным CI-gate | frontend contract adoption и дальнейшая операционная наблюдаемость maintenance |
| 2026-08-20 | Maintenance operational observability | worker пишет структурированные success-события для cleanup/generation/retention/reminders с duration и counters; ошибки сохраняют отдельные error-события; публичные сервисные контракты не изменены | targeted ESLint, Prettier и `git diff --check`; E2E не является обязательным CI-gate | pagination/response DTO hardening и calendar projection |

# 2026-08-20 Notifications response DTO hardening

Обычный и paginated inbox маппят Prisma Notification в явный NotificationResponseDto; scope пользователя и семьи сохранён. Проверки: notifications Jest, targeted ESLint, Prettier и diff-check. Следом: calendar projection и visibility/consent policy.

# 2026-08-20 Financial category lifecycle hardening

Финансовые категории получили endpoint архивных записей и восстановление с семейной проверкой ownership, optimistic concurrency по `version` и audit-событием `financial_category.restored`. Миграции не требуются; добавлены targeted unit-тесты. Следом: проверить симметрию restore для остальных архивируемых финансовых сущностей.

# 2026-08-20 Financial wallet archive lifecycle

Добавлены `GET /families/me/wallets/archived` и `POST /families/me/wallets/:id/restore`. Оба сценария ограничены семейным ownership и visibility policy; restore поддерживает `If-Match`/version, атомарное восстановление и audit-событие `wallet.restored`. Архивный кошелёк нельзя восстановить партнёру для чужого personal wallet; envelope wallet по-прежнему защищён от архивации при активной финансовой цели. Проверки: wallets Jest 6/6, targeted ESLint, Prettier и `git diff --check`; полный lint остаётся заблокирован существующими проблемами зависимостей/типов `nodemailer`, `supertest` и e2e-файлов. Следом: симметричный restore/archive hardening для recurring payments и financial goals.

# 2026-08-20 Financial recurring payments and goals archive lifecycle

- Реализованы backend-операции `GET /families/me/recurring-payments/archived` и `POST /families/me/recurring-payments/:id/restore`.
- Реализованы backend-операции `GET /families/me/financial-goals/archived` и `POST /families/me/financial-goals/:id/restore`.
- Для архивных списков сохранены family ownership и visibility-проверки; восстановление доступно владельцу personal-ресурса или партнёру для family-ресурса.
- Восстановление использует `If-Match`/version, атомарный update и не восстанавливает запись при архивном связанном wallet.
- Добавлены audit-события `recurring_payment.restored` и `financial_goal.restored`; recurring payment при восстановлении снова становится active.
- Prisma migration не требуется.
- Проверки: targeted Jest — 2 suites, 4 tests passed; targeted ESLint, TypeScript и Prettier — успешно; E2E/staging не запускались согласно правилам репозитория.
- Следующий срез: унифицировать архивный lifecycle для финансовых категорий и проверить связанные API-контракты/Swagger.

# 2026-08-21 Media S3 storage

Добавлен приватный Selectel S3 media API: `POST /api/v1/media/upload`, `GET /api/v1/media/:id`, `GET /api/v1/media` с pagination и фильтрами `name`, `dateFrom`, `dateTo`, а также `DELETE /api/v1/media/:id`. Доступ ограничен JWT и владельцем metadata; для чтения возвращается короткоживущая presigned URL.

Добавлена Prisma-модель `Media` и миграция `20260821110531_add_media`. Файлы загружаются через временный файл на диске, изображения ограничены 10 MB, видео — 500 MB; бинарные данные в PostgreSQL не сохраняются. S3 credentials читаются из env и не логируются.

Проверки: Prisma format/validate/generate, `npm run build`, `npm run lint`, `npm test` (35 suites / 126 tests), targeted media tests, `git diff --check`; Docker health, migration deploy и Selectel `HeadBucket` smoke test прошли. Frontend follow-up: использовать multipart поле `file`, затем `downloadUrl` для приватного просмотра.

Следом: frontend adoption и при необходимости привязка media к domain entities (children, memories, recipes), включая retention/delete policy.

## 2026-08-21 Media family visibility and previews

Media теперь привязана к `familyId`, который берётся только из активного membership текущего
пользователя. `GET /api/v1/media` и `GET /api/v1/media/:id` возвращают медиа всех членов этой
семьи; `DELETE` сохраняет owner-only правило. Для изображений создаётся отдельный private S3
preview object в WebP, ограниченный 320px по большей стороне и quality 82; ответ содержит
короткоживущие `downloadUrl` и `previewUrl`, для видео `previewUrl: null`. Добавлена миграция с
backfill `family_id` через `family_members`; orphan media останавливают миграцию явной ошибкой.

Добавлена runtime-зависимость `sharp`. Проверки: media Jest 3/3, lint, format check, build и
`git diff --check` проходят. Frontend contract follow-up: использовать `previewUrl` только для
изображений и обновить описание list/detail как family-shared.

Следом: после проверки frontend-контракта применить миграцию на staging/production и выполнить
smoke upload/list/detail для двух пользователей одной семьи.

# 2026-08-21 Media kind separation, multipart upload and streaming

Media теперь имеет `kind`: `IMAGE`, `VIDEO`, `AUDIO`; новые S3 object keys идут в `images/`, `videos/`, `audio/` по family-префиксу. Миграция классифицирует существующие objects по MIME type.

Добавлен direct S3 multipart flow: `POST /api/v1/media/uploads/initiate`, `GET /api/v1/media/uploads/:id/status`, `POST /api/v1/media/uploads/:id/complete`, `DELETE /api/v1/media/uploads/:id`. Backend хранит upload session metadata в Prisma, выдаёт presigned part URLs, проверяет family membership, MIME, declared/actual size и cleanup.

Добавлены family-scoped endpoints `GET /api/v1/media/videos/:id/stream`, `GET /api/v1/media/videos/:id/download` и аналогичные `audio` endpoints. Streaming поддерживает HTTP Range/206 для seek/playback; download возвращает attachment. Legacy multipart endpoint сохранён для compatibility и принимает audio.

Лимиты: image 10 MB, video 500 MB, audio 100 MB; multipart part 10 MB. Все S3 objects private. Selectel bucket CORS должен разрешать PUT с клиентского origin и expose `ETag`. Frontend follow-up: XHR/fetch progress, complete с ETags, player через stream endpoint.

Проверки: Prisma format/validate/generate, build, lint, targeted media Jest 3/3, format check и `git diff --check` PASS; полный Jest/staging smoke будет отдельным прогоном.
Verification update: full Jest 35 suites / 127 tests, lint, format check and git diff check PASS after final cleanup; build and Prisma generate PASS.

# 2026-08-21 Deployment incident: S3 environment source of truth

Root cause: production API requires `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`, but GitHub Actions `production/PRODUCTION_ENV` did not contain them. Earlier deploy logic overwrote `/opt/my-love/.env` without S3 values; the root-owned `.env.bak-*` recovery path was unreadable to the deploy user and led to repeated recovery/quoting failures.

Permanent fix: store S3 values as separate GitHub Environment `production` secrets (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, optional `S3_PRESIGNED_URL_EXPIRES_IN`). The workflow injects these secrets directly into the temporary production env and validates required values before SSH. `PRODUCTION_ENV` remains for non-S3 settings; server backup files are not a configuration source of truth.

Runbook: on `Config validation error: S3_* is required`, check GitHub Environment secrets first; do not hard-code credentials, commit `.env`, or add Docker-based backup recovery. Update the environment secrets, rerun the workflow, then verify migration, API health, and container health.

# 2026-08-21 Local Swagger and API container refresh

Swagger contract обновлён для avatar preview и media streaming/download: добавлены query/header
описания для capability token и HTTP Range, а также media response content types.
Runtime-контракт доступен по `GET /docs-json` и `GET /docs-yaml`, UI остаётся на `/docs`.
Локальный API-контейнер пересобран из текущего исходного кода; frontend может подтягивать JSON с `http://localhost:5000/docs-json`.
Локальный `api` теперь перед стартом выполняет идемпотентный `prisma migrate deploy`, поэтому новые миграции не остаются неприменёнными после `docker compose up`.

Проверки: build, lint, format check и `git diff --check`; после пересборки — Docker health, migration status и Swagger endpoint smoke.
Следом: frontend agent может обновить клиент из `/docs-json`; фронтенд-репозиторий backend-агентом не изменяется.

# 2026-08-21 User avatars in private S3

Зафиксировано backend-only правило: frontend не изучается и не изменяется backend-агентами; frontend contract adoption выполняется отдельным frontend-проектом/агентом.

Добавлена Prisma migration `20260821130000_add_user_avatar` с private S3 metadata в `User`: original object key, preview object key, MIME type и размер. `POST /api/v1/users/me/avatar` принимает только изображения до 5 MB, сохраняет оригинал в `avatars/{userId}/`, создаёт WebP preview 320x320 quality 82 в `avatar-previews/{userId}/`, а `DELETE /api/v1/users/me/avatar` удаляет avatar metadata и оба объекта. Оригинал не выдаётся API.

`avatarUrl` — стабильный application preview endpoint `/api/v1/users/{id}/avatar`, который отдаёт только private WebP preview и поддерживает Range. Поле добавлено в current/public user DTO, список пользователей, auth/family/event/first-date user representations и account export profile. S3 bucket остаётся private; storage keys наружу не раскрываются.

Проверки: Prisma format/validate/generate, build, lint, full Jest 35 suites / 127 tests, format check и `git diff --check` PASS. Frontend follow-up: подключить multipart upload и использовать `avatarUrl`; frontend repository не изменялся.

Следом: frontend adoption отдельным агентом и production smoke upload/replace/delete avatar.

# 2026-08-21 CI follow-up

После первого push CI обнаружил устаревший `User` mock в `family-events.service.spec.ts`; добавлены nullable avatar-поля. Локально повторно подтверждены 35 suites / 127 tests, lint, build и `git diff --check`.

# 2026-08-25 S3 lifecycle and direct-upload hardening

Добавлены миграции `20260825090000_add_object_storage_cleanup_tasks` и
`20260825093000_add_media_upload_failed_status`, а также durable очередь очистки
private S3: при временной ошибке удаления объекта или abort multipart upload задача сохраняется в
PostgreSQL с deduplication, lock и exponential retry. Удаление media/avatar metadata теперь не
блокируется недоступностью S3: объект становится недоступен через API сразу, а cleanup worker
удаляет его немедленно или повторяет позже. Retention-анонимизация также очищает private avatar
metadata и ставит в очередь original/preview объекты.

Maintenance worker отменяет истёкшие multipart upload sessions, ставит S3 abort в retry-очередь и
периодически удаляет старые terminal session records. Новый env:
`S3_MULTIPART_UPLOAD_SESSION_RETENTION_MS`, default 7 days.
Завершённая, но невалидная загрузка получает terminal status `FAILED`; ошибка выпуска presigned
read URL не удаляет уже сохранённый объект и metadata.
Исправлено существовавшее Prisma mapping-несоответствие `MediaUploadSession.objectKey` ->
`media_upload_sessions.object_key`; worker теперь корректно обрабатывает upload sessions в живой БД.

Selectel bucket CORS настроен без раскрытия credential: разрешены `GET`, `HEAD`, `PUT` для
локального и production frontend origins; `ETag`, `Content-Length`, `Content-Range`,
`Accept-Ranges` доступны клиенту, max age 3600 seconds.

Проверки: Prisma format/generate, build, lint, Jest 36 suites / 130 tests, format check и
`git diff --check`. Следом: применить migration на production через обычный CI deploy и выполнить
smoke direct multipart upload/abort/retry; frontend repository не изменяется backend-агентом.

# 2026-08-25 Selectel direct-upload CORS fix

Выявлено, что Selectel отдаёт CORS preflight только для Virtual-Hosted адресации. Backend больше не
использует `forcePathStyle` при создании S3 client, поэтому presigned multipart URLs имеют вид
`<bucket>.<endpoint>/...`, а не path-style `/<bucket>/...`. Реальная проверка OPTIONS с origin
`http://localhost:5174` вернула `200` и CORS headers; origin `http://localhost:5174` добавлен в
bucket CORS. Миграция не нужна. Frontend должен повторить `initiate` после перезапуска локального API:
старые path-style presigned URLs останутся неработоспособны в браузере.

# 2026-08-25 Backend-only boundary and S3 production CORS

Этот репозиторий реализует только backend. Frontend-код, его сборка, конфигурация и деплой здесь не
изучаются и не изменяются; frontend допускается только как внешний клиент для проверки совместимости
существующего API. Необходимые действия frontend-команды фиксируются в статусе, но выполняются в её
отдельном репозитории.

В CORS private Selectel bucket добавлен production origin `http://185.227.144.160`. Для него, как и
для ранее разрешённых origins, доступны `GET`, `HEAD` и `PUT`, необходимые для direct multipart upload
и чтения ответов; credential и S3-ключи не раскрываются. При смене production origin его требуется
явно добавить в bucket CORS до выпуска frontend-клиента.

# 2026-08-25 Wellbeing static route ordering repair

## 2026-08-25 Telegram gateway deployment ownership repair

Production обнаружил crash loop `telegram-bot`: compose пытался выполнить
`dist/telegram-gateway/main.js`, хотя gateway был ранее намеренно удалён из этого
backend-репозитория. Устаревшие service `telegram-bot`, Caddy virtual host и автоматическая
регистрация webhook удалены из backend deployment. Обычный API и outbox остаются здесь;
Telegram Bot API transport, его webhook и секреты разворачиваются и ротируются только в
выделенном transport-репозитории/окружении.

Это предотвращает повторное создание несуществующего контейнера при каждом backend deploy.
Ротация `TELEGRAM_INTEGRATION_SECRET` по-прежнему требует одной согласованной замены в GitHub
Environment `production` backend и в конфигурации внешнего transport до следующего deploy.

## 2026-08-25 CI environment-independent log redaction test

Workflow для `eb89398` остановился на unit-тестах до сборки образа: новый тест импортировал
`AppModule`, поэтому в GitHub CI без локального `.env` запускалась production-валидация
обязательных S3-настроек. Константа `HTTP_LOG_REDACT_PATHS` вынесена в независимый модуль
`src/common/logging/http-log-redaction.ts`; unit-тест больше не создаёт Nest ConfigModule и не
зависит от deployment secrets. Проверки после исправления: Jest 37/37, lint, build, format-check
и diff-check PASS.

Правило: конфигурационные константы, которые проверяются unit-тестом, не должны импортироваться
из composition root (`AppModule`), если их можно вынести в чистый модуль.

## 2026-08-25 Direct S3 multipart smoke

Добавлен ручной `npm run test:s3:smoke` для локального API. Скрипт намеренно допускает
только loopback URL, создаёт временную семью и проверяет реальный private Selectel S3:
multipart upload image/video/audio, статус загруженной части, WebP preview, доступ другого
члена семьи, HTTP Range `206`, download attachment и abort незавершённой сессии. Он удаляет
созданные media через API; временные записи пользователей и семьи после прогона должны быть
удалены из локальной БД по префиксу `s3-smoke-`.

Проверка 2026-08-25: smoke PASS. Тестовые семьи и пользователи удалены, S3-объекты удалены
через штатные API/cleanup paths. В Swagger исправлен enum `MediaUploadStatusDto`: добавлен
реальный terminal status `FAILED`.

Следом: атомарно ротировать `TELEGRAM_INTEGRATION_SECRET` в GitHub Environment production и
внешнем Telegram transport, затем выполнить обычный deploy. Нельзя менять только серверный
`.env`: это разорвёт интеграцию до следующей синхронизации конфигурации.

## 2026-08-25 Логи, E2E wellbeing и S3 smoke

- Pino больше не записывает `Cookie` и `x-telegram-integration-secret`; список redaction вынесен в `HTTP_LOG_REDACT_PATHS` и покрыт unit-тестом.
- Добавлен E2E-регрессионный тест для статических wellbeing-маршрутов: `consents`, `shared-with-me`, `assessments`, `trends`, `gratitudes`, `support-requests`, `rituals`, `couple-meetings`. Catch-all `:id` больше не может перехватить их без падения теста.
- E2E-запуск изолирован от локального `.env`, использует отдельную БД `localhost:55432` и теперь работает одинаково в PowerShell и POSIX-оболочках через `npm run test:e2e`.
- Read-only smoke из работающего API-контейнера подтвердил доступ к приватному Selectel S3 бакету (`HeadBucket`). Для destructive smoke multipart upload/abort/retry, preview и video/audio range-streaming нужна отдельная временная учётная запись и последующее удаление всех созданных объектов; этот прогон не должен выполняться на пользовательских данных.
- Ротация `TELEGRAM_INTEGRATION_SECRET` должна быть атомарной: сначала обновить GitHub Environment `production` и внешний Telegram transport одним значением, затем развернуть API. Нельзя менять только API `.env`, иначе интеграция станет недоступна до следующего deploy.

Проверки: `npm run test:e2e` — 13/13, targeted Jest — 10/10, S3 `HeadBucket` — PASS. Рекомендуемый следующий шаг: выполнить destructive S3 smoke из временной учётной записи после подтверждения изоляции тестовых данных; затем атомарно ротировать Telegram secret во всех двух владельцах конфигурации.

Исправлен production-500 для wellbeing read endpoints. В Express динамические маршруты
`GET`/`DELETE /check-ins/:id`, объявленные перед статическими, перехватывали сегменты
`shared-with-me`, `consents`, `assessments`, `trends`, `gratitudes`, `support-requests`,
`rituals` и `couple-meetings` как идентификаторы check-in. PostgreSQL пытался привести
эти строки к UUID, что приводило к 500. Catch-all маршруты перемещены в конец
контроллера; статические endpoints теперь регистрируются первыми. Миграции не требуются.

## 2026-08-25 Separate Telegram TLS transport

Telegram Bot API transport остаётся в отдельном репозитории и на отдельном сервере. Его
выделенный Caddy container обслуживает HTTPS
`https://bot.185.227.144.160.sslip.io/internal/telegram/deliver`; frontend Nginx на том же
хосте не изменяется. Backend production deploy передаёт Telegram outbox только по этому URL
через `TELEGRAM_PROVIDER=http`. Общий `TELEGRAM_INTEGRATION_SECRET` остаётся единственной
границей credentials между сервисами и должен ротироваться атомарно в обоих GitHub environments.

## 2026-08-25 Telegram HTTP delivery contract hardening

Добавлены unit-тесты `HttpTelegramProvider`: проверяются точный POST-контракт versioned delivery
envelope, Bearer-аутентификация, обработка неуспешного HTTP-ответа как retryable ошибки outbox и
fail-closed поведение при отсутствующей конфигурации. Реальные Telegram/S3 credentials в тестах не
используются и не изменялись.

Проверки: targeted Jest 3/3, полный Jest 38 suites / 134 tests, ESLint, Prettier, build и
`git diff --check` — PASS.

Следующий безопасный операционный шаг: выполнить отдельную end-to-end доставку через временную
привязку тестового Telegram-аккаунта и проверить итоговый статус outbox. Ротация
`TELEGRAM_INTEGRATION_SECRET` отложена по явному решению пользователя.

## 2026-08-26 Telegram production end-to-end delivery

Проверена фактическая production-цепочка для уже привязанного аккаунта: backend outbox → HTTPS
transport → Telegram Bot API. Тестовое событие `TELEGRAM_E2E_PROBE` получило статус `DELIVERED`
без retry и без ошибки; transport записал `telegram_delivery_sent`. После проверки временная
учётная запись и тестовая outbox-запись удалены. Secrets и настройки пользователей не менялись.

Во время проверки на сервере отдельного Telegram transport был заполнен системный диск 8.8 GB.
Безопасно очищены архивные systemd journals и неиспользуемые Docker images; frontend, активные
контейнеры и PostgreSQL volume не затрагивались. После очистки свободно около 415 MB — перед
следующим image deploy требуется увеличить диск либо настроить постоянные лимиты journal/Docker
cache, иначе возможна повторная остановка контейнерных операций.

## 2026-08-26 Family event media attachments

Добавлена many-to-many связь `family_event_media` между семейными событиями и Media.
Медиафайл можно использовать в нескольких событиях; удаление связи или soft-delete события не удаляет объект S3.

API:

- `GET /api/v1/family-events/:id/media` — список прикреплённых медиа с метаданными и short-lived URL;
- `POST /api/v1/family-events/:id/media` с `{ "mediaId": "..." }` — прикрепление;
- `DELETE /api/v1/family-events/:id/media/:mediaId` — открепление.

Операции прикрепления и открепления доступны только создателю события. Просмотр доступен обоим партнёрам активной семьи.
Чужие медиа не проходят проверку family scope. Ответы событий дополнены `mediaIds`.

Миграция: `20260826130000_add_family_event_media`. Удаление Media каскадно убирает связи, но отдельная media-запись не вызывает S3 cleanup.

Проверки: `prisma generate`, `prisma validate`, Jest 38 suites / 136 tests, format check, lint, build и `git diff --check` PASS.
Следующий шаг: production deploy с миграцией и smoke attach/list/detach на временных тестовых данных.

## 2026-08-26 Child profiles: private S3 avatar binding

Профиль ребёнка теперь может ссылаться на уже загруженный family-scoped image через
`avatarMediaId`. Миграция `20260826120000_add_child_profile_s3_avatar` хранит nullable ссылку на
`Media` и отдельный отзывный capability token. `POST` и `PATCH /families/me/children` принимают
optional `avatarMediaId`; назначать можно только IMAGE той же активной семьи с private WebP preview.
Чужие объекты, видео, аудио и изображения без preview отклоняются. Ответы create/list/update/export
содержат `avatarMediaId` и стабильный application `avatarUrl`, ведущий на
`GET /families/me/children/:id/avatar?token=...`; endpoint отдаёт только WebP preview с Range,
оригинал остаётся доступен лишь через защищённый media API. При удалении `Media` ссылка ребёнка
сбрасывается каскадным `ON DELETE SET NULL`; stale capability перестаёт работать.

Старое поле `avatarUrl` сохранено для обратной совместимости внешних avatar URL и возвращается
только пока private `avatarMediaId` не назначен. Frontend в этом репозитории не изменялся.

Проверки: `prisma generate`, `prisma validate`, полный Jest — 38 suites / 136 tests, format check,
lint, build и `git diff --check` прошли. Следом: применить migration через обычный production deploy
и выполнить isolated smoke: image upload → assignment к child profile → preview → media deletion.

# 2026-08-26 Messenger WebSocket foundation

Реализован первый backend-срез Messenger. Добавлены Prisma-модели и миграция `20260826170000_add_messenger_core` для семейных `Conversation`, участников, сообщений и связей `MessageMedia`. Реализованы HTTP endpoints: создание direct/group чата, список и получение чата, пагинированная история сообщений и отправка сообщения. Доступ проверяется через активное членство пользователя в семье; media разрешены только из той же семьи и с соответствующим типом IMAGE/VIDEO/AUDIO.

Добавлен Socket.IO Gateway в namespace `/messenger` с JWT/session authentication: `conversation.join`, `conversation.leave`, `message.send`, `message.read`; сервер публикует `message.created` и `message.read` только в комнату авторизованного чата. Отправка файлов через WebSocket запрещена архитектурно: сначала используется существующий multipart S3 upload, затем в сообщение передаются `mediaIds`.

Проверки: Prisma format/validate/generate, миграция внутри актуально пересобранного локального Docker API, `npm run lint`, `npm run build`, полный Jest 39 suites / 144 tests, `git diff --check` — PASS. Локальный API-контейнер пересобран и запущен; миграция применена, health проверяется контейнером.

Ограничения текущего среза: ещё не реализованы Redis adapter, message-specific media download authorization и E2E/load tests. Следующий срез — Redis fan-out, message media endpoints и integration tests.

# 2026-08-26 Messenger groups and message lifecycle

Расширен Messenger: добавлены group membership endpoints (`PATCH /conversations/:id`, `POST/DELETE /conversations/:id/members`, `POST /conversations/:id/leave`) с ролями OWNER/ADMIN/MEMBER и запретом удаления владельца. Добавлены HTTP и WebSocket операции edit/delete сообщений; изменять и удалять может только автор, удаление soft-delete сохраняет запись и media-связи.

WebSocket payloads для join/leave/send/read/edit/delete теперь валидируются вложенным `ValidationPipe`. Добавлены события `message.updated` и `message.deleted`. Media по-прежнему проверяется по familyId и соответствию типа сообщения.

Проверки: Messenger Jest 4/4, lint, build и `git diff --check` — PASS. Следующий срез: typing/presence, replay после reconnect, Redis adapter и integration/E2E WebSocket tests.

# 2026-08-26 Messenger message-scoped media access

Добавлены message-scoped endpoints для вложений Messenger: `GET /conversations/:conversationId/messages/:messageId/media`, а также `stream` и `download` для конкретного `mediaId`. Каждый запрос сначала проверяет активное членство пользователя в чате и наличие точной связи `MessageMedia`; затем применяется стандартная family-проверка MediaService. Внешние object keys не раскрываются, приватный S3 сохраняется.

Добавлены unit-тесты на выдачу только вложений сообщения и отказ в потоковой выдаче несвязанного media. Проверки: Prettier, ESLint, полный Jest 40 suites / 150 tests, build и `git diff --check` — PASS.

Следующий срез: Redis adapter для fan-out между несколькими API-инстансами и integration/load tests WebSocket.

# 2026-08-26 Messenger Redis adapter

Добавлен опциональный Redis adapter для Socket.IO. При наличии `MESSENGER_REDIS_URL` приложение подключает отдельные pub/sub Redis-клиенты и fan-out между API-инстансами; без этой переменной сохраняется текущий single-instance режим. Redis подключается на старте fail-fast и закрывается вместе с WebSocket adapter. Секреты и URL в репозиторий не добавлялись.

Добавлены зависимости `@socket.io/redis-adapter` и `redis`, конфигурация `MESSENGER_REDIS_URL` принимает только `redis://` или `rediss://`. Проверки: ESLint, build, полный Jest 40 suites / 150 tests и `git diff --check` — PASS.

Остаётся: задать Redis endpoint в окружении deployment и добавить integration/load tests для multi-instance fan-out.

# 2026-08-26 Messenger WebSocket contract tests

Добавлены автоматические тесты `MessengerGateway`: проверка JWT и активной сессии при подключении, отказ для невалидной сессии,
membership-check перед `conversation.join`, порядок `persist -> message.created`, автоматическое завершение typing через 5 секунд и
единый контракт ошибок WebSocket. Тесты не требуют реального Redis или S3 и не затрагивают frontend.

Проверка: targeted Jest MessengerGateway — 1 suite / 6 tests PASS; полный Jest — 41 suite / 156 tests PASS. Следующий срез: отдельный E2E-тест подключения Socket.IO с реальной
тестовой PostgreSQL-сессией и проверка multi-instance fan-out при наличии Redis в окружении.

# 2026-08-26 Messenger Socket.IO E2E и race-condition fix

Добавлен реальный E2E-сценарий с временной PostgreSQL: два пользователя одной семьи проходят JWT/session authentication,
подключаются к namespace `/messenger`, входят в group conversation, один отправляет сообщение, второй получает `message.created`,
после чего сообщение проверяется через HTTP history endpoint.

В ходе E2E обнаружена и устранена гонка: `handleConnection` выполнял session lookup асинхронно, пока клиент уже мог отправить первый
command. Gateway теперь хранит promise аутентификации socket и перед каждым command дожидается его завершения; invalid session по-прежнему
немедленно отключается. Добавлена dev-зависимость `socket.io-client`. Frontend не изменялся.

Проверки: E2E 1 suite / 14 tests PASS, targeted Gateway Jest 1 suite / 6 tests PASS, lint и build PASS. Следующий срез: Redis
multi-instance fan-out integration/load test при наличии Redis endpoint.

# 2026-08-26 Messenger Redis multi-instance fan-out

Добавлен отдельный integration test `test/messenger-redis-fanout.e2e-spec.ts` и script `test:messenger:redis`. Harness поднимает два
Socket.IO-инстанса с `RedisIoAdapter`, подключает клиентов к одной комнате и проверяет доставку `message.created` с instance A на instance B
через Redis pub/sub. Без `MESSENGER_REDIS_URL` тест корректно skipped; production secrets и frontend не затрагивались.

Проверки: реальный Redis 7 в временном контейнере — 1 test PASS; без Redis — 1 suite skipped; lint PASS. Следующий срез: добавить
операционную конфигурацию Redis в deployment только после предоставления отдельного Redis endpoint/credentials и выполнить нагрузочный smoke.

# 2026-08-26 Messenger Redis load smoke

Добавлен `test/messenger-redis-load.e2e-spec.ts` и script `test:messenger:redis:load`. Тест поднимает два Socket.IO-инстанса,
подключает несколько клиентов к каждому, отправляет burst `message.created` и проверяет полный fan-out на обоих
инстансах. Параметры ограничены: `MESSENGER_REDIS_LOAD_CLIENTS` (default 2, max 10) и
`MESSENGER_REDIS_LOAD_MESSAGES` (default 100, max 1000). Без `MESSENGER_REDIS_URL` smoke корректно skipped;
production Redis endpoint/credentials не изменялись.

В Compose добавлен отдельный Redis 7 с AOF volume, паролем, `maxmemory=192mb`, `noeviction` и healthcheck; Redis-порт
не публикуется наружу. API получает внутренний `MESSENGER_REDIS_URL=redis://:...@redis:6379`. Production workflow требует
GitHub Environment secret `REDIS_PASSWORD` и записывает его в серверный `.env` без вывода значения. Без этого secret
deployment блокируется намеренно.

Локальный `.env` пока не содержит `REDIS_PASSWORD`, поэтому Redis локально не запускался до добавления владельцем
секретного URL-safe значения.

Проверки: реальный Redis 7 load smoke — 1/1 PASS; без Redis — 1 suite skipped; полный Jest — 41 suite / 156 tests PASS;
format check, lint, build, Prisma validate и `git diff --check` — PASS.

Следующий срез: выдать Redis deployment configuration после получения отдельного endpoint/credentials и прогнать
smoke в целевой среде.

# 2026-08-26 Messenger presence, typing and reconnect cursor

Добавлены ephemeral-события `presence.updated` и `typing.updated` с автоматическим завершением typing через 5 секунд, очисткой при leave/disconnect и проверкой active family membership. Presence публикуется только в комнате авторизованной беседы; глобальная публикация статусов не используется.

История сообщений получила cursor `afterId` для восстановления новых сообщений после reconnect, а также `nextCursor` и защиту от одновременного использования `beforeId`/`afterId`. PostgreSQL остаётся источником истины, бинарные данные через WebSocket не передаются.

Проверки: lint, build и `git diff --check` — PASS. Полный Jest после этого среза требуется повторить перед commit/push. Следующий срез — Redis adapter для нескольких API-инстансов и integration/E2E WebSocket tests.
