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
| 2026-08-20 | Telegram transport ownership              | удалён дублирующий Nest gateway, webhook/Bot API client, команды и Compose profile; backend оставляет linking, integration API и outbox-контракт для `DinarSharipov/my-love-telegram`                                                                                       | targeted TypeScript/build, Compose config, diff-check                                                                                     | внешний репозиторий отвечает за transport deployment                                    |
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
