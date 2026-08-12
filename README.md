# My Love API

Расширяемый backend на NestJS, Prisma ORM и PostgreSQL. API работает на порту `5000`, Swagger доступен по адресу `http://localhost:5000/docs`.

## Возможности

- регистрация, login и logout через JWT access token;
- срок жизни токена по умолчанию — 7 дней (`JWT_ACCESS_EXPIRES_IN=7d`);
- реальный отзыв текущего токена при logout через серверную сессию;
- Argon2id для паролей, в БД нет открытых паролей и токенов;
- DTO-валидация, CORS, Helmet, rate limiting и JSON-логи с сокрытием секретных полей;
- URI versioning (`/api/v1`), Swagger/OpenAPI и health-check;
- production multi-stage Docker image, PostgreSQL с persistent volume;
- CI: Prisma validation, format, lint, tests, build; CD: GHCR, миграции, Docker Compose.

## Быстрый запуск

Требуются Docker и Docker Compose:

```bash
cp .env.example .env
docker compose up -d postgres
docker compose run --rm api npx prisma migrate deploy
docker compose up -d
```

Для локальной разработки без контейнера приложения укажите в `DATABASE_URL` хост `localhost`, затем:

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

Основные маршруты:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout` — требует `Authorization: Bearer <token>`
- `GET /api/v1/users?search=...&page=1&limit=20` — безопасный реестр пользователей
- `GET /api/v1/users/:id` — публичный профиль пользователя
- `POST /api/v1/family-invitations` — отправить приглашение
- `GET /api/v1/family-invitations/incoming` — входящие приглашения
- `GET /api/v1/family-invitations/outgoing` — исходящие приглашения
- `PATCH /api/v1/family-invitations/:id/accept` — принять приглашение
- `PATCH /api/v1/family-invitations/:id/reject` — отклонить приглашение
- `PATCH /api/v1/family-invitations/:id/cancel` — отменить приглашение
- `GET /api/v1/families/me` — получить свою семью
- `GET /api/v1/health`
- `GET /docs`

## Переменные окружения

Полный шаблон находится в `.env.example`.

| Переменная | Назначение |
|---|---|
| `NODE_ENV` | `development`, `test` или `production` |
| `PORT` | внешний порт API, по умолчанию `5000` |
| `API_PREFIX` | префикс, по умолчанию `api` |
| `CORS_ORIGINS` | разрешённые origin через запятую |
| `LOG_LEVEL` | уровень логирования |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | PostgreSQL в Compose |
| `DATABASE_URL` | Prisma connection string |
| `JWT_ACCESS_SECRET` | случайная строка не короче 32 символов |
| `JWT_ACCESS_EXPIRES_IN` | срок JWT (`7d`, `12h`, `30m`) |
| `FAMILY_INVITATION_EXPIRES_IN` | срок действия приглашения, по умолчанию `7d` |
| `APP_IMAGE` | Docker image/tag для локального запуска или CD |

Сгенерировать секрет можно командой `openssl rand -base64 48`. Production `.env` не коммитится и должен находиться в `${DEPLOY_PATH}/.env` на сервере с ограниченными правами доступа.

## GitHub Actions и сервер

Добавьте в GitHub Environment `production` следующие secrets:

| Secret | Назначение |
|---|---|
| `DEPLOY_HOST` | IP/домен сервера |
| `DEPLOY_USER` | SSH-пользователь с доступом к Docker |
| `DEPLOY_SSH_KEY` | приватный SSH-ключ |
| `DEPLOY_PORT` | SSH-порт (если не указан, 22) |
| `DEPLOY_PATH` | абсолютный каталог сервиса на сервере |
| `GHCR_PAT` | GitHub token с `read:packages` для скачивания private image |

Автоматические проверки и сборка Docker image выполняются после каждого merge в `main`. Деплой по умолчанию отключён, чтобы workflow не падал до подготовки сервера. Для его включения создайте repository variable `DEPLOY_ENABLED=true` в `Settings → Secrets and variables → Actions → Variables`.

На сервере должны быть установлены Docker и Compose plugin, создан `DEPLOY_PATH`, а в нём — production `.env`. Push в `main` после успешных проверок публикует immutable image в GHCR, копирует Compose-файл, применяет Prisma migrations и обновляет сервис.

## Архитектурные решения и развитие

Функции сгруппированы в независимые модули (`auth`, `users`, `families`, `health`), доступ к данным изолирован в глобальном `DatabaseModule`. Таблица `AuthSession` уже позволяет поддержать несколько устройств, принудительный logout и последующую реализацию списка сессий.

Для следующего этапа рекомендованы refresh-токены с ротацией (тогда access token лучше сократить до 10–15 минут), подтверждение email/телефона, восстановление пароля, RBAC/permissions и аудит важных действий. Google OAuth следует добавлять как отдельную identity-сущность, не привязывая провайдера напрямую к `User`; очереди уведомлений — через BullMQ/Redis и transactional outbox. WebSocket gateway также лучше держать отдельным модулем и авторизовывать тем же token validation service.
