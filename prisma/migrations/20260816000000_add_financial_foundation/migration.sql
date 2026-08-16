CREATE TYPE "WalletType" AS ENUM ('PERSONAL', 'FAMILY');
CREATE TYPE "WalletVisibility" AS ENUM ('PRIVATE', 'PARTNER', 'FAMILY');
CREATE TYPE "LedgerTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'REVERSAL');

CREATE TABLE "wallets" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "owner_id" UUID,
  "created_by_id" UUID NOT NULL,
  "type" "WalletType" NOT NULL,
  "visibility" "WalletVisibility" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallets_type_owner_visibility_check" CHECK (
    ("type" = 'PERSONAL' AND "owner_id" IS NOT NULL AND "visibility" IN ('PRIVATE', 'PARTNER')) OR
    ("type" = 'FAMILY' AND "owner_id" IS NULL AND "visibility" = 'FAMILY')
  ),
  CONSTRAINT "wallets_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "ledger_transactions" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "type" "LedgerTransactionType" NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "note" VARCHAR(500),
  "reverses_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_transactions_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "ledger_entries" (
  "id" UUID NOT NULL,
  "transaction_id" UUID NOT NULL,
  "wallet_id" UUID,
  "amount_minor" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_nonzero_check" CHECK ("amount_minor" <> 0)
);

CREATE TABLE "financial_command_results" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "scope" VARCHAR(100) NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "transaction_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_command_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wallets_family_id_archived_at_idx" ON "wallets"("family_id", "archived_at");
CREATE INDEX "wallets_owner_id_archived_at_idx" ON "wallets"("owner_id", "archived_at");
CREATE UNIQUE INDEX "ledger_transactions_reverses_id_key" ON "ledger_transactions"("reverses_id");
CREATE INDEX "ledger_transactions_family_id_occurred_at_id_idx" ON "ledger_transactions"("family_id", "occurred_at", "id");
CREATE INDEX "ledger_entries_wallet_id_created_at_idx" ON "ledger_entries"("wallet_id", "created_at");
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");
CREATE UNIQUE INDEX "financial_command_results_transaction_id_key" ON "financial_command_results"("transaction_id");
CREATE UNIQUE INDEX "financial_command_results_user_id_scope_key_key" ON "financial_command_results"("user_id", "scope", "key");

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_command_results" ADD CONSTRAINT "financial_command_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_command_results" ADD CONSTRAINT "financial_command_results_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_balanced_ledger_transaction() RETURNS trigger AS $$
DECLARE
  target_id UUID;
  entry_count INTEGER;
  entry_sum NUMERIC;
  invalid_wallet_count INTEGER;
BEGIN
  target_id := CASE WHEN TG_TABLE_NAME = 'ledger_transactions' THEN NEW.id ELSE NEW.transaction_id END;
  SELECT COUNT(*), COALESCE(SUM("amount_minor"), 0)
    INTO entry_count, entry_sum FROM "ledger_entries" WHERE "transaction_id" = target_id;
  IF entry_count < 2 OR entry_sum <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % must contain at least two balanced entries', target_id;
  END IF;
  SELECT COUNT(*) INTO invalid_wallet_count
  FROM "ledger_entries" entry
  JOIN "wallets" wallet ON wallet.id = entry.wallet_id
  JOIN "ledger_transactions" transaction ON transaction.id = entry.transaction_id
  WHERE entry.transaction_id = target_id
    AND (wallet.family_id <> transaction.family_id OR wallet.currency <> transaction.currency);
  IF invalid_wallet_count > 0 THEN
    RAISE EXCEPTION 'ledger transaction % contains a wallet from another family or currency', target_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ledger_transaction_balanced_on_transaction"
AFTER INSERT ON "ledger_transactions" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction();
CREATE CONSTRAINT TRIGGER "ledger_transaction_balanced_on_entry"
AFTER INSERT ON "ledger_entries" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction();

CREATE FUNCTION prevent_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_transactions_no_update_delete" BEFORE UPDATE OR DELETE ON "ledger_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER "ledger_entries_no_update_delete" BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
