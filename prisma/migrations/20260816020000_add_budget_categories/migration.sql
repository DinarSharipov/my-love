CREATE TYPE "FinancialCategoryKind" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "financial_categories" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "kind" "FinancialCategoryKind" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budgets" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "limit_minor" BIGINT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "budgets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "budgets_limit_minor_check" CHECK ("limit_minor" > 0),
  CONSTRAINT "budgets_period_start_first_day_check" CHECK (EXTRACT(DAY FROM "period_start") = 1)
);

ALTER TABLE "ledger_transactions" ADD COLUMN "category_id" UUID;

CREATE INDEX "financial_categories_family_id_kind_archived_at_idx" ON "financial_categories"("family_id", "kind", "archived_at");
CREATE UNIQUE INDEX "budgets_category_id_period_start_key" ON "budgets"("category_id", "period_start");
CREATE INDEX "budgets_family_id_period_start_idx" ON "budgets"("family_id", "period_start");
CREATE INDEX "ledger_transactions_category_id_occurred_at_idx" ON "ledger_transactions"("category_id", "occurred_at");

ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_balanced_ledger_transaction() RETURNS trigger AS $$
DECLARE
  target_id UUID;
  entry_count INTEGER;
  entry_sum NUMERIC;
  invalid_wallet_count INTEGER;
  invalid_category_count INTEGER;
BEGIN
  target_id := CASE WHEN TG_TABLE_NAME = 'ledger_transactions' THEN NEW.id ELSE NEW.transaction_id END;
  SELECT COUNT(*), COALESCE(SUM("amount_minor"), 0)
    INTO entry_count, entry_sum FROM "ledger_entries" WHERE "transaction_id" = target_id;
  IF entry_count < 2 OR entry_sum <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % must contain at least two balanced entries', target_id;
  END IF;
  SELECT COUNT(*) INTO invalid_wallet_count FROM "ledger_entries" entry JOIN "wallets" wallet ON wallet.id = entry.wallet_id JOIN "ledger_transactions" transaction ON transaction.id = entry.transaction_id WHERE entry.transaction_id = target_id AND (wallet.family_id <> transaction.family_id OR wallet.currency <> transaction.currency);
  IF invalid_wallet_count > 0 THEN RAISE EXCEPTION 'ledger transaction % contains a wallet from another family or currency', target_id; END IF;
  SELECT COUNT(*) INTO invalid_category_count FROM "ledger_transactions" transaction JOIN "financial_categories" category ON category.id = transaction.category_id WHERE transaction.id = target_id AND category.family_id <> transaction.family_id;
  IF invalid_category_count > 0 THEN RAISE EXCEPTION 'ledger transaction % contains a category from another family', target_id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
