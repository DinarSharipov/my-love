# My Love Backend — Plan v2.0

Это единственный рабочий план после завершения `v1.0`. План относится только к
backend-репозиторию. Frontend, его код, сборка, генерация типов и deployment остаются
зоной отдельного frontend-репозитория и frontend-агента.

## Цель v2.0

Перевести MVP из состояния «функционально готов» в состояние устойчивого продукта:
закрыть эксплуатационные риски, усилить контракты и privacy, затем добавлять новые
backend-возможности небольшими вертикальными срезами.

## Приоритет 1 — эксплуатационная устойчивость

- Зафиксировать production limits для Docker logs, images и диска; добавить безопасную
  профилактику заполнения диска.
- Проверить production SMTP и все обязательные environment secrets без вывода значений.
- Добавить наблюдаемость outbox: backlog, retry, exhausted events и delivery latency.
- Добавить runbook для deploy, rollback, migration recovery, S3 outage и Telegram outage.
- Выполнять production smoke после каждого schema/deployment-среза на изолированных данных.

## Приоритет 2 — API и данные

- Провести controller-first аудит Swagger: response DTO, error responses, UUID/date/money
  форматы и pagination contracts.
- Унифицировать pagination/filter/sort там, где это требуется клиентам; cursor pagination
  вводить только для действительно больших коллекций.
- Добавить integration tests для Prisma migrations, transactional writes и authorization
  boundary критичных доменов.
- Проверить индексы и query plans для family-scoped списков, notifications, outbox и media.

## Приоритет 3 — privacy и lifecycle

- Провести единый аудит archive/restore/delete/retention для всех доменов и media attachments.
- Зафиксировать правила orphan media, failed uploads, expired multipart sessions и S3 cleanup.
- Проверить export/delete semantics для user, child, family, wellbeing, finance и Telegram
  artifacts.
- Добавить regression tests на cross-family access, revoked membership и deleted accounts.

## Приоритет 4 — S3 и media v2

- Завершить production smoke для image/video/audio upload, preview, Range, download и cleanup.
- Добавить безопасную идемпотентность повторных complete/abort и защиту от зависших uploads.
- Проверить антивирусную/типовую валидацию и ограничения форматов до расширения списка media.
- При подтверждённой продуктовой необходимости добавлять media attachments к новым доменным
  сущностям через отдельную Prisma-связь и отдельные endpoints.
- Не создавать новые media-привязки без подтверждённой domain-потребности.

## Приоритет 5 — Messenger: чаты и realtime-события

Создать отдельный backend-модуль `messenger` с текстовыми сообщениями, изображениями,
видео и voice-сообщениями. Реализацию строить на NestJS Gateway с Socket.IO и явной
версией событий. Gateway использует существующую JWT-аутентификацию и проверяет
family membership на каждом действии; WebSocket-соединение не является границей
авторизации.

### Доменная модель

- `Conversation`: семейный или групповой чат, тип, название, avatar/media reference,
  creator, timestamps, archived state.
- `ConversationMember`: conversation/user, роль, статус, joined/left timestamps, last-read
  message cursor; уникальность `(conversationId, userId)`.
- `Message`: immutable sender/conversation record, client idempotency key, sequence/order,
  type `TEXT|IMAGE|VIDEO|VOICE`, text, reply reference, edited/deleted timestamps.
- `MessageMedia`: связь сообщения с существующей `Media`, порядок, роль attachment и
  metadata snapshot; один файл может быть связан только в рамках разрешённой family scope.
- PostgreSQL constraints и индексы для `(conversationId, createdAt, id)`, membership lookup,
  unread/read cursor и idempotency `(senderId, clientMessageId)`.

### HTTP-контракт

- Создание, список, получение и архивирование чатов.
- Создание групп, изменение названия/avatar, добавление/удаление участников и выход.
- Пагинация истории сообщений, фильтры и unread/read state через HTTP как источник истины.
- Media upload для сообщений проходит через существующий multipart S3 pipeline; в БД
  сохраняются только metadata и связи, бинарные данные — в private Selectel S3.

### WebSocket-контракт

- Версионированные client events: `conversation.join`, `conversation.leave`,
  `message.send`, `message.edit`, `message.delete`, `message.read`, `typing.start/stop`.
- Версионированные server events: `conversation.updated`, `message.created`,
  `message.updated`, `message.deleted`, `message.read`, `typing.updated`, `presence.updated`.
- Каждый command получает acknowledgement с результатом или структурированной ошибкой;
  broadcast выполняется только после успешного commit транзакции.
- Доставка считается подтверждённой на уровне БД: сообщение сначала атомарно сохраняется,
  затем событие публикуется в room чата. Reconnect восстанавливает пропущенные события по
  `lastEventId`/message cursor через HTTP или replay endpoint; WebSocket не используется
  как единственное хранилище истории.
- Для нескольких API-инстансов предусмотреть Redis adapter/pub-sub и sticky-session либо
  отключить polling, не полагаясь на один процесс памяти.

### Media и безопасность

- Все изображения, видео и voice-файлы хранятся в private S3 в существующих раздельных
  media-префиксах; в сообщениях хранятся ссылки на `Media`, а не публичные URL.
- Для image сохраняется preview WebP; video/voice выдаются через существующие Range/stream
  endpoints с family authorization. Для voice зафиксировать MIME/codec/size allowlist.
- Запретить доступ к conversation/message/media при отсутствии active membership, включая
  reconnect, replay, download и group membership changes.
- Ограничить размер/частоту сообщений, санитизировать text metadata, добавить rate limit,
  idempotency и защиту от повторной отправки; edit/delete policy должна быть явной.
- Не помещать бинарные данные в WebSocket payload: сначала S3 multipart upload, затем
  отправка `mediaId` в `message.send`.

### Критерии готовности

- Prisma migration, DTO/Swagger для HTTP, Gateway events schema и unit/integration/e2e tests.
- Проверены family isolation, group roles, duplicate send, reconnect/replay, read cursors,
  transaction rollback, S3 cleanup и concurrent membership changes.
- Нагрузочный smoke для message fan-out и reconnect; outbox/observability расширены для
  realtime delivery failures.

## Приоритет 6 — продуктовые backend-возможности

Новые возможности выбирать только после закрытия эксплуатационных и privacy-блокеров:

- расширение семейных reminders и notification preferences;
- расширенные отчёты и агрегаты финансов без нарушения wallet visibility;
- дополнительные family-scoped сущности, если они появились в согласованном продуктовом
  roadmap;
- подготовка backend-контрактов для мобильного клиента без изменения frontend-репозитория.

## Правила выполнения v2.0

Каждый срез должен включать: access matrix и invariants, Prisma migration при изменении
схемы, DTO/controller/service, Swagger, unit/integration tests, обновление
`docs/IMPLEMENTATION_STATUS.md`, локальные format/lint/test/build/Prisma checks и
изолированный smoke, если затрагивается production или S3.

Порядок срезов: сначала Приоритет 1, затем Приоритеты 2–3, затем Приоритет 4, Messenger
и остальные product slices. Messenger может стартовать после базового operational/security
аудита, но не должен обходить privacy и S3 правила.
План пересматривается только отдельным решением и с фиксацией новой версии документа.
