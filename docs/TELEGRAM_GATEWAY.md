# Telegram bot/gateway

Gateway запускается отдельным процессом из того же production image и не имеет
доступа к PostgreSQL. Он принимает webhook Telegram, вызывает защищённые integration
endpoints backend и принимает delivery-команды от transactional outbox.

## Конфигурация

Сгенерируйте разные случайные значения для `TELEGRAM_INTEGRATION_SECRET` и
`TELEGRAM_WEBHOOK_SECRET`. Первый secret должен совпадать у API и gateway.

```dotenv
TELEGRAM_INTEGRATION_ENABLED=true
TELEGRAM_PROVIDER=http
TELEGRAM_DELIVERY_URL=http://telegram-bot:3000/internal/notifications
TELEGRAM_INTEGRATION_SECRET=<shared-api-gateway-secret>

BACKEND_API_URL=http://api:5000/api/v1
TELEGRAM_BOT_TOKEN=<token-from-BotFather>
TELEGRAM_WEBHOOK_SECRET=<telegram-webhook-secret>
```

Локальный Compose-профиль запускается командой:

```bash
docker compose --profile telegram up -d --build
```

Gateway слушает `TELEGRAM_GATEWAY_PORT_HOST` (по умолчанию `3000`) и предоставляет
`GET /health`. Для production webhook endpoint должен быть доступен Telegram по HTTPS.

## Регистрация webhook

Webhook регистрируется один раз при deployment. Не передавайте bot token или secret
в логи и историю shell; пример ниже содержит только placeholders:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H 'content-type: application/json' \
  -d '{"url":"https://<PUBLIC_GATEWAY_HOST>/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

Telegram передаёт secret в `X-Telegram-Bot-Api-Secret-Token`; gateway отклоняет
запросы без точного совпадения. Internal delivery требует
`Authorization: Bearer <TELEGRAM_INTEGRATION_SECRET>`.

## Команды

- `/start КОД` или `/link КОД` — обмен одноразового кода из приложения;
- `/status` — состояние связи;
- `/notifications` — до 20 непрочитанных уведомлений;
- `/unlink` — отзыв связи и выключение Telegram-канала.

Команды обрабатываются только в private chat. Gateway не логирует token, chat ID,
Telegram user ID или текст уведомления. Отправка через Bot API имеет timeout 10 секунд;
ошибка internal delivery возвращается backend, после чего outbox применяет существующий
retry/backoff и dead-letter policy.
