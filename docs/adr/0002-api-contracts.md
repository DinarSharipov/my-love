# ADR 0002: базовые API-контракты

- Статус: принято
- Дата: 2026-08-15

## Контекст

Frontend уже зависит от NestJS-полей ошибок `statusCode`, `message`, `error` и от
плоской пагинации `data`, `page`, `limit`, `total`, `totalPages`. Полная замена
этих форм создала бы несовместимое изменение generated RTK Query клиента.

## Решение

- Error response расширяется полями `code`, optional `details` и `requestId`.
  Существующие поля и специальные поля доменных ответов сохраняются.
- Validation errors сохраняют массив `message`; тот же массив доступен как
  `details.messages`. Код ошибки — `VALIDATION_FAILED`.
- Каждый HTTP-ответ получает `x-request-id`. Корректный входящий идентификатор
  (`[A-Za-z0-9._:-]`, максимум 128 символов) продолжается, иначе создаётся UUID.
- Offset pagination сохраняет плоский публичный контракт. Общие DTO и расчёт
  metadata устраняют расхождения между модулями.
- `LocalDate` передаётся как `YYYY-MM-DD`, instant — ISO 8601, timezone — IANA ID.
- Деньги в API передаются как decimal string `amountMinor`, ISO 4217 `currency`
  и `scale`. Строка не теряет точность при будущей сериализации PostgreSQL BigInt.

## Последствия

Изменение обратно совместимо с текущим frontend error parser и pagination UI.
Новые клиенты могут принимать решения по `code` и передавать `requestId` в
обращениях поддержки. Cursor pagination, optimistic concurrency и idempotency
остаются отдельными следующими срезами и не добавляются преждевременно.
