# My Love — план развития backend

Актуально на 16 августа 2026 года. План составлен по `PRODUCT_ROADMAP.md`,
`IMPLEMENTATION_STATUS.md` frontend-проекта и текущему состоянию backend.

## Статус реализации

- [x] ADR семейного фундамента: роли, lifecycle, настройки и судьба shared data.
- [x] `FamilyStatus`, `FamilyMemberRole`, timezone/locale/default currency и
      database-level лимит двух партнёров с backfill существующих данных.
- [x] Общий `FamilyMembershipService`; `families`, `family-events` и `first-date`
      переведены на единую policy, события используют timezone семьи.
- [x] Unit-тесты membership policy и чистая воспроизводимая Docker-сборка.
- [x] Изолированный E2E harness и security regression critical path для auth,
      registry, invitations, family ownership, events и session revocation.
- [x] Совместимые error envelope/request ID и общие pagination/date/money contracts.
- [x] Opt-in optimistic concurrency для `first-date` и `family-events` через `version`/`If-Match`.
- [x] Opt-in idempotency с payload hash/result replay для существующих критических команд.
- [x] Закрытые одноразовые приглашения по точному email: hash-токен, cooldown, revoke и accept после регистрации.
- [x] `GET/PATCH /users/me`: настройки профиля и opt-in optimistic concurrency.
- [x] Смена пароля с проверкой текущего и управление отзываемыми сессиями с metadata/last-seen.
- [x] Transactional outbox с PostgreSQL worker/retry и безопасным development email adapter.
- [x] Forgot/reset password: enumeration-safe request, one-time hash token, encrypted outbox link и отзыв всех сессий.
- [x] Локальный SMTP через Mailpit и SMTP adapter для outbox; production provider требует отдельных credentials.
- [x] Смена email: re-auth текущим паролем, одноразовое подтверждение нового адреса через encrypted outbox link и отзыв всех sessions.
- [x] Базовый family lifecycle: выход участника и архивирование активной семьи
      партнёром с сохранением shared data.
- [ ] Cursor pagination; финансовые команды должны связывать domain write и idempotency result одной транзакцией.
- [x] Audit log и transactional outbox.
- [x] Tasks, task routines, shopping lists, notification inbox/preferences/reminders
      и базовый family dashboard.
- [x] Telegram linking, outbox delivery transport и отдельный bot/gateway.
- [x] Quiet-hours scheduling для Telegram при enqueue и повторной проверке перед delivery.
- [x] Политика каналов: product/domain notifications доставляются только в in-app inbox
      и связанный Telegram; email зарезервирован для security/account recovery flows.
- [x] ADR и общая visibility/consent policy перед finance и wellbeing; FK-backed grants
      добавляются внутри первого sensitive domain consumer.
- [x] Additive calendar projection для events, tasks и private reminders.
- [x] Financial schema foundation: wallet, immutable balanced ledger, reversal и
      transactional command result.
- [x] Wallet API с server-owned scope, visibility, concurrency и audit; следующий
      финансовый срез — idempotent ledger commands.

## 1. Целевая модель и границы

Backend обслуживает приватное пространство уже знакомой семьи: не более двух
взрослых партнёров и их управляемые детские профили. Другие родственники не
становятся членами семьи и могут существовать только как контакты или записи
календаря.

Обязательные продуктовые ограничения:

- любой доступ к семейным данным проверяется на сервере по текущей сессии;
- личные финансовые и wellbeing-данные закрыты по умолчанию;
- sharing требует явного согласия владельца и имеет историю изменений;
- приложение не вычисляет рейтинг семьи, настроение партнёра или диагноз;
- деньги хранятся целыми значениями в minor units с ISO-кодом валюты;
- календарные даты, моменты времени и timezone имеют разные явные контракты;
- совместные записи нельзя безвозвратно удалить одним партнёром без заранее
  определённого правила;
- чувствительные изменения попадают в audit log;
- внешние эффекты отправляются через transactional outbox, а не внутри основной
  транзакции HTTP-запроса.

До этапа детей предполагаются только взрослые аккаунты. Самостоятельный вход
ребёнка, bank sync, AI-рекомендации и открытый dating-каталог не входят в этот
план первой версии.

## 2. Что уже реализовано

### Инфраструктура

- NestJS, Prisma, PostgreSQL, конфигурация через Nest Config и Joi;
- URI API versioning `/api/v1`, Swagger, DTO validation, Helmet, CORS;
- Pino-логи с сокрытием authorization/password, глобальный rate limit;
- health-check приложения и базы, Docker Compose, миграции и CI/CD-основа.

### Домены

- `auth`: регистрация, login, logout, Argon2id, JWT и отзыв текущей серверной
  сессии;
- `users`: активные пользователи, поиск, пагинация и публичный профиль;
- `families`: приглашение по user ID, incoming/outgoing, accept/reject/cancel,
  атомарное создание семьи из двух пользователей;
- `family-events`: создание, список с диапазоном дат, чтение, решение партнёра,
  soft delete создателем и вычисляемые календарные статусы;
- `first-date`: create/read/update/delete одной записи на семью;
- базовые unit-тесты auth, первой встречи и вычисления статусов/дат событий.

### Пробелы текущего ядра

- у `FamilyMember` нет роли; лимит двух партнёров обеспечивается use case, но не
  целостной доменной политикой и не constraint/locking-стратегией для всех будущих
  операций;
- нет выхода из семьи, расформирования, архивации и правил судьбы общих данных;
- проверки membership скопированы в сервисах;
- глобальная timezone одна на приложение, а не настройка семьи/пользователя;
- invitation expiration выполняется лениво при запросах, фоновых jobs нет;
- нет refresh-token rotation, восстановления пароля, подтверждения email,
  изменения профиля/пароля/email и управления всеми сессиями;
- нет integration/e2e-тестов API и тестов authorization для большей части
  сервисов;
- публичный реестр пользователей противоречит рекомендуемому закрытому onboarding.

## 3. Порядок работы над каждым вертикальным срезом

Для каждой capability соблюдать один порядок:

1. Зафиксировать invariants, ownership и access matrix.
2. Добавить Prisma schema, новую миграцию, constraints и индексы.
3. Реализовать domain module: DTO → controller → service/use cases → persistence.
4. Описать success/error contracts в Swagger и не раскрывать существование чужих
   приватных объектов через различимые ответы.
5. Добавить unit-тесты бизнес-правил, integration-тесты транзакций и e2e критического
   пути/authorization.
6. Выполнить `prisma:generate`, validate/format/lint/test/build и проверить миграцию
   на пустой и существующей базе.
7. Обновить OpenAPI и только затем генерировать RTK Query frontend-клиент.

Новые endpoint/DTO перед merge обязательно сверять с фактическим использованием в
`my-love-frontend`.

## 4. Этап 0 — контракты и фундамент (P0)

Этот этап нужно закончить до задач, финансов, wellbeing и детей.

### 0.1. Семейное членство и lifecycle

- Ввести `FamilyMemberRole`: `PARTNER`, `CHILD`; ребёнка лучше моделировать
  отдельным dependent profile и не связывать с `User` до появления child accounts.
- Добавить статус семьи (`ACTIVE`, `ARCHIVED`, `DISSOLVED`), timezone, locale,
  default currency, timestamps архивации/расформирования.
- Выделить `FamilyMembershipService`/policy с операциями `requireMembership`,
  `requirePartner`, `requireSameFamily`, `getFamilyContext`; подключать его из
  сервисов, не переносить бизнес-логику в guards.
- Гарантировать максимум двух активных партнёров транзакцией с подходящей
  блокировкой/счётчиком и database constraint, где это возможно.
- Определить lifecycle API: получить семью, выйти, запросить/подтвердить
  расформирование, отменить запрос. Для совместных данных выбрать архивирование,
  доступ обоим к экспорту и запрет одностороннего hard delete.
- При изменении состава семьи атомарно отменять pending invitations и предложения,
  пересчитывать доступ, отзывать семейные share links и писать audit event.

Критерий: невозможно создать третьего партнёра или получить данные другой семьи
ни через API, ни при конкурентных запросах.

### 0.2. Единые API-контракты

- Ввести стабильный error envelope: `code`, `message`, `details`, `requestId`;
  каталог машинных error codes и единый exception filter.
- Унифицировать pagination (`data`, `page`, `limit`, `total`, `totalPages`) и
  предусмотреть cursor pagination для timeline/inbox/audit.
- Ввести типы/валидаторы `LocalDate`, ISO instant, IANA timezone, `Money` в minor
  units + ISO 4217 currency; убрать зависимость доменной логики от глобальной
  `APP_TIMEZONE`.
- Добавить optimistic concurrency (`version` или `updatedAt` precondition) для
  редактируемых совместных сущностей.
- Определить `Idempotency-Key`, хранение результата и конфликт payload hash для
  финансовых и других критических команд.
- Исправить nullable Swagger metadata, чтобы generated client не получал `object`
  вместо `string | null`.

### 0.3. Privacy, consent и audit

- Реализовать общую policy-модель видимости: `PRIVATE`, `PARTNER`, `FAMILY` с
  владельцем ресурса и запретом расширения доступа без явной команды владельца.
- Для wellbeing sharing хранить scope, `grantedAt`, optional `expiresAt`,
  `revokedAt`; отзыв должен действовать немедленно.
- Добавить append-only `AuditEvent`: actor, family, action, resource type/id,
  безопасные metadata, timestamp, requestId. Не писать туда пароль, токены,
  свободный текст check-in и медицинские заметки.
- Аудировать login/security events, роли, lifecycle семьи, видимость, бюджетные
  правила, экспорт и удаление.

### 0.4. Outbox, jobs и уведомления

- Добавить `OutboxEvent`, атомарно создаваемый с доменной транзакцией;
- выбрать очередь/планировщик (для первой версии допустим PostgreSQL worker;
  BullMQ/Redis — при необходимости масштаба), retries с backoff, dead-letter и
  идемпотентных consumers;
- перенести expiration приглашений в scheduled job, оставив проверку срока в
  командах как защиту;
- каналы product notifications — `IN_APP` и `TELEGRAM`; email использовать только для
  reset/change password, подтверждения смены email и recovery аккаунта. Security email
  не зависит от пользовательского toggle и quiet hours;
- добавить operational endpoints/metrics для backlog, ошибок и повторного запуска.

### 0.5. Тестовая и эксплуатационная база

- Поднять отдельную PostgreSQL для integration/e2e, мигрировать перед suite и
  изолировать тестовые данные;
- добавить e2e auth → invite → accept → family → event и негативные сценарии
  cross-family access;
- покрыть invitations/users/family-events unit и integration-тестами, включая
  self-invite, исключение текущего пользователя, гонки accept и soft delete;
- добавить request ID, structured domain/audit logging, error/latency metrics и
  readiness/liveness отдельно.

## 5. Этап 1 — закрыть уже начатые сценарии (P0)

### 1.1. Закрытый onboarding пары

- Основной API: приглашение по нормализованному точному email или одноразовой
  криптографически стойкой ссылке; хранить только hash токена, expiry, max uses.
- Не подтверждать постороннему, зарегистрирован ли email; отправка письма всегда
  возвращает одинаковый ответ.
- Поддержать принятие после регистрации, повторную отправку с cooldown и revoke.
- Ограничить abuse по actor/IP/recipient и аудитить события.
- После миграции frontend удалить/закрыть публичный каталог либо оставить его за
  feature flag с отдельным privacy-решением.

### 1.2. Полный auth/profile lifecycle

- `me`: чтение и редактирование имени, даты рождения, телефона, описания, locale,
  timezone; optimistic concurrency.
- Смена пароля с проверкой текущего пароля и отзывом остальных сессий.
- Forgot/reset password: одноразовый hash-токен, короткий TTL, single use,
  одинаковый ответ для существующего/несуществующего email, письмо через outbox,
  после reset — отзыв всех сессий.
- [x] Смена email через подтверждение нового адреса; уникальность и нормализация email.
- Список сессий с device/IP/lastSeenAt, отзыв одной и всех остальных сессий;
  очистка истёкших сессий job-ом.
- Перейти к короткому access token + rotating refresh token family с reuse
  detection либо явно принять текущую длительную JWT-модель как временный риск.
- [x] Деактивация аккаунта: re-auth, configurable grace period, одноразовая отмена
      удаления по email и безопасное поведение membership (сохраняется во время grace period).
- [x] Account export текущего пользователя без секретов; opt-in анонимизация
      после grace period с сохранением shared data и явной policy
  для shared data после окончания grace period.
- [x] Периодический cleanup истёкших sessions, одноразовых auth-токенов и
  invitations с защитой от overlapping runs.

### 1.3. Единый календарный backend

- Обобщить календарную модель, не смешивая исходные домены: calendar projection
  объединяет family events, задачи, платежи, ритуалы, детские события и памятные
  даты в единый read API.
- Расширить family events: update/reschedule, all-day, timezone, type/color,
  участники, reminders, recurrence rule/exceptions, контакт родственника без
  membership, история решения партнёра.
- Определить политику изменения уже подтверждённого события: существенное изменение
  создаёт новое предложение/сбрасывает подтверждение.
- Реализовать range query с ограниченной шириной диапазона, cursor/page contract и
  индексами `(familyId, startsAt)`; корректно обработать DST.
- iCal export/subscription отложить до стабилизации модели и permissions.

Критерий этапа 1: пользователь может безопасно восстановить доступ, управлять
профилем/сессиями, создать закрытую пару и вместе вести календарь.

## 6. Этап 2 — семейный cockpit и бытовой MVP (P0/P1)

### 2.1. Tasks и routines

- Сущности: `Task`, `TaskAssignment`, `TaskChecklistItem`, `TaskCompletion`,
  `TaskRoutine`, recurrence/exceptions, reschedule history.
- Поддержать разовую/повторяемую задачу, due date/timezone, priority, estimate,
  mental-load marker, assignee partner/child/both/unassigned, checklist.
- Команды create/update/complete/reopen/reschedule/archive; перенос сохраняет причину
  без штрафа, completion — actor и время.
- Ротация генерирует назначения детерминированно и безопасно при retry; изменение
  шаблона не переписывает историю выполненного.
- Недельный обзор возвращает агрегаты нагрузки и отдельный добровольный ответ о
  воспринимаемой справедливости, но не score/leaderboard.

### 2.2. Shopping

- `ShoppingList`, items, category, quantity/unit, assignee, checkedBy/checkedAt,
  optimistic concurrency и архив;
- несколько списков на семью, быстрый add, bulk reorder/check и шаблоны;
- realtime можно добавить позже; сначала обеспечить конфликтоустойчивый REST.

### 2.3. Notifications и dashboard read model

- In-app inbox: actionable notification, read/dismissed state, deep-link payload
  фиксированной схемы;
- preferences по типу/каналу, timezone и quiet hours, digest/deduplication;
- reminders задач/событий и pending decisions через outbox/jobs;
- `GET /dashboard`: today/week, overdue tasks, pending decisions, ближайшие платежи,
  goal progress, только явно опубликованный partner check-in;
- хранить предпочтения порядка/видимости виджетов пользователя;
- не строить один огромный синхронный join: начать с параллельных domain queries,
  затем при измеренной необходимости добавить projection/cache.

## 7. Этап 3 — финансовый MVP (P0)

До разработки утвердить access matrix личных и общих денег, правила расставания,
одну или несколько валют и неизменяемость истории операций.

### Модель и операции

- `Wallet` (`PERSONAL`/`FAMILY`, owner, visibility, currency), `Category`, `Tag`;
- immutable ledger `Transaction` + entries для income/expense/transfer; корректнее
  double-entry либо как минимум отдельные transfer legs в одной транзакции;
- `Budget`/category limits по месяцу, `RecurringPayment`, `FinancialGoal` и
  contributions, `FinancialMeeting`/decisions;
- суммы только `BigInt` minor units, валюта обязательна; конвертацию не выполнять
  без явного FX-домена;
- create/update by compensating/reversal, transfer и goal contribution — атомарно,
  с idempotency key и optimistic locking;
- attachment хранит metadata и ссылку на media, но не публичный URL.

### API и безопасность

- CRUD кошельков/категорий, ledger query/filter, бюджеты, recurring payments, goals,
  monthly summary/cash flow/category breakdown;
- сервер всегда применяет wallet visibility; запрещено выводить личные суммы в
  dashboard, audit или notification партнёра;
- регулярный платёж сначала создаёт forecast/reminder; автоматическое проведение
  требует отдельного явного решения;
- CSV export экранирует formula injection, учитывает locale/timezone и содержит
  только доступные запросившему данные;
- audit всех изменений правил/общих операций, тесты rounding boundaries,
  overflow, duplicate request, concurrent update и cross-family access.

Критерий: общая картина воспроизводима из ledger, повтор запроса не удваивает
операцию, личные кошельки не раскрываются партнёру.

## 8. Этап 4 — wellbeing и гармония (P0/P1)

### Private-by-default модель

- `CheckIn`: owner, mood/energy/stress по ограниченной шкале, encrypted/private
  note, support request, createdAt; по умолчанию доступен только owner;
- публикация партнёру — отдельная `ConsentGrant` с выбранными полями и expiry;
- `WHO5Assessment` и ответы видит только владелец; результат вычисляется прозрачно,
  не становится family score и не используется для рекомендаций/retention;
- owner-only trends, export и hard delete согласно retention policy.

### Совместные сценарии

- `SupportRequest`, `Gratitude`, `CoupleMeeting` с секциями и совместными решениями,
  `SharedActivityIdea`, `Ritual`;
- weekly meeting хранит ответы каждого раздельно до явной публикации и итоговое
  совместное решение отдельно;
- activity/ritual можно запланировать через календарный domain event;
- уведомления нейтральны, учитывают quiet hours и не раскрывают sensitive content
  на lock screen/email subject;
- кризисные ресурсы конфигурируются по стране; формулировки до запуска проходят
  профессиональную и legal/privacy проверку.

## 9. Этап 5 — дети, семейные рутины и питание (P1/P2)

### Managed child profiles

- `ChildProfile` принадлежит семье, не имеет credentials/session, содержит имя,
  birth date, avatar и минимально необходимые данные;
- оба партнёра управляют профилем по определённой policy; чувствительные medical/
  school notes получают отдельную visibility и audit;
- детские задачи/события с возрастными ограничениями, без сравнительных рейтингов;
- emergency/family contacts — записи семьи, не `FamilyMember` и не `User`;
- export/delete ребёнка и судьба данных при распаде семьи должны быть определены до
  сбора данных.

### Meals и recipes

- `MealPlan`, `Recipe`, ingredients, dietary labels и связь с shopping items;
- генерация shopping items идемпотентна и не удаляет пользовательские изменения;
- medical allergy нельзя выводить из предпочтений; если хранится — это отдельное
  sensitive поле с минимальным доступом.

Самостоятельные child accounts допускаются только отдельным проектом после выбора
стран запуска, проверки возраста согласия, parental consent и abuse/reporting flows.

## 10. Этап 6 — воспоминания и долгосрочная ценность (P1)

- `Memory`, `Milestone`, `TimeCapsule`, timeline projection и selected recap items;
- object storage adapter, presigned upload/download, проверка MIME/размера,
  malware scan, stripping metadata/EXIF, thumbnails и quotas;
- доступ к blob всегда проверяется через metadata ownership, bucket не публичный;
- time capsule недоступна до `opensAt` даже по прямому object key;
- lifecycle originals/derivatives, retryable deletion, backup policy и portable
  archive export с manifest/checksums;
- yearly recap создаётся только из выбранных пользователями данных, без скрытого
  ранжирования отношений или членов семьи.

## 11. Этап 7 — готовность к production (P0 перед публичным запуском)

### Security и privacy

- threat model отдельно для auth, семьи/расставания, финансов, детей, wellbeing и
  media; проверить IDOR, privilege escalation, enumeration, token leakage и abuse;
- secret rotation, dependency/container scanning, CSP/CORS/rate-limit review,
  payload/file limits, encrypted transport/storage и минимальные DB privileges;
- privacy policy, consent history, retention schedule, data inventory, export/delete
  SLA и incident response с учётом выбранных стран;
- запрет рекламных trackers и передачи sensitive content в analytics/logs.

### Надёжность и эксплуатация

- backup + point-in-time recovery и регулярные restore drills;
- zero-downtime expand/migrate/contract strategy, rollback/runbooks;
- OpenTelemetry/metrics/traces, SLO и alerts для API, DB pool, queue/outbox, jobs,
  email и object storage;
- нагрузочные тесты dashboard/calendar/ledger, анализ query plans и индексов;
- worker retries, poison-message isolation, graceful shutdown и health probes;
- e2e critical paths: account recovery, pair lifecycle, permissions, calendar,
  tasks, finance idempotency, consent revoke, child privacy, export/delete.

## 12. Рекомендуемая последовательность релизов

1. **Foundation release / этап 0:** роли/lifecycle, policies, contracts, audit,
   outbox/jobs, e2e foundation.
2. **Couple core release / этап 1:** закрытый invite, account security и полноценный
   календарь; frontend завершает уже существующие first-date/events flows.
3. **Daily coordination release / этап 2:** задачи, покупки, notifications,
   настоящий dashboard.
4. **Finance release / этап 3:** ручной ledger, бюджеты, платежи и цели.
5. **Safe wellbeing release / этап 4:** consent-first check-ins и совместные ритуалы.
6. **Family expansion release / этап 5:** managed children, routines, затем meals.
7. **Long-term value release / этап 6:** memories/media/capsules/recap.
8. **Public launch gate / этап 7:** security/privacy/restore проверки являются блокирующими,
   а не необязательной полировкой.

Этапы 0 и 1 нельзя откладывать ради feature work. После них этапы 2 и 3 можно вести
параллельными вертикальными срезами при сохранении единой policy/outbox модели;
wellbeing и children следует начинать только после готовности privacy/consent/audit.

## 13. Ближайший backend backlog

Небольшие задачи в общем с frontend порядке:

1. [x] ADR семейного lifecycle, роли/settings и судьба shared data.
2. [x] Миграция family role/status/timezone/locale/currency и DB-лимит партнёров.
3. [x] Общий membership policy для `families`, `family-events`, `first-date`.
4. [x] E2E harness и security regression suite существующих endpoints.
5. [x] Error/request ID/pagination/date/money, concurrency и базовая idempotency.
6. [ ] Следующий вертикальный срез этапа 1: закрытое email/link invitation;
       внутри него добавить минимальный transactional outbox и email provider contract.
7. [ ] Forgot/reset password через тот же outbox.
8. [ ] Profile/password/email/session-management API.
9. [x] Reminders/recurrence и единая calendar projection для готового frontend-календаря
       пока ограничены существующими family events; расширение переносится в этап 2.
10. [x] Завершить общие visibility/audit/jobs задачи этапа 0 до финансов и wellbeing.

### Следующие вертикальные срезы

Минимальный этап 2 уже включает `tasks`, `task-routines`, shopping, notification
inbox/preferences/reminders и dashboard. Дальнейший порядок:

1. Quiet-hours scheduling для Telegram/email через `OutboxEvent.availableAt`.
2. Authorization/unit/E2E hardening бытовых доменов, пагинация inbox и полные
   Swagger response DTO.
3. [x] Scheduled idempotent generation task routines.
4. Ограниченная calendar/dashboard projection для events, tasks и reminders.
5. ADR и минимальная visibility/consent policy.
6. [x] Financial schema foundation: wallet visibility и immutable ledger.
7. [x] Wallet API: server-owned family/owner scope, visibility, optimistic concurrency
   и audit.
8. [x] Idempotent income/expense/transfer ledger commands и ledger query/history с reversal.
9. Production Telegram gateway: отдельный HTTPS hostname/route, secrets, BotFather
   token, webhook registration и delivery/linking smoke tests.

Wellbeing и child profiles не начинать до visibility/consent/retention foundation.

После каждой задачи обновлять `IMPLEMENTATION_STATUS.md`, OpenAPI и generated
frontend client. Не объединять весь этап в одну миграцию или один pull request.
