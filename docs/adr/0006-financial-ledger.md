# ADR 0006: financial wallet и immutable ledger

- Статус: принято
- Дата: 2026-08-16

## Контекст

Финансовая история должна воспроизводиться, не раскрываться партнёру через побочные
read models и не создавать дубль после повторного запроса. Обновляемый `balance` и
разрушающий CRUD транзакций не дают таких гарантий.

## Решение

- `Wallet` бывает `PERSONAL` или `FAMILY`. Personal wallet имеет owner и visibility
  `PRIVATE`/`PARTNER`; family wallet не имеет owner и всегда `FAMILY`.
- Валюта wallet обязательна и хранится ISO 4217 кодом. FX conversion отсутствует;
  transfer разрешается только между wallet одной валюты и семьи.
- `LedgerTransaction` и `LedgerEntry` append-only. Баланс вычисляется суммой signed
  `amountMinor`; каждая транзакция имеет минимум две entry, сумма которых равна нулю.
  Income/expense используют external entry с nullable `walletId`, transfer — две wallet entries.
- Исправление выполняется новой `REVERSAL`, связанной с исходной транзакцией. Одну
  транзакцию нельзя отменить дважды.
- Database deferred triggers проверяют баланс entries, family/currency wallet и запрещают
  update/delete ledger rows. Shared history не удаляется каскадом при удалении пользователя.
- Финансовые команды используют обязательный `Idempotency-Key`. Domain transaction,
  entries и `FinancialCommandResult` с request hash создаются одной Prisma transaction.
  Общий HTTP idempotency interceptor для ledger-команд не используется.
- Personal wallet read всегда проходит visibility policy ADR 0005. Dashboard,
  notifications, audit metadata и exports не раскрывают недоступные суммы.
- Суммы API — decimal string `amountMinor`; JSON number для денег запрещён.

## Последствия

Balance и summary сначала вычисляются SQL aggregate по доступным entries; projection
добавляется только после измерения. Категории, бюджеты, recurring payments и goals идут
отдельными миграциями после wallet/ledger critical path и cross-family/idempotency E2E.
