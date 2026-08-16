CREATE TYPE "RecurringPaymentFrequency" AS ENUM ('WEEKLY', 'MONTHLY');
CREATE TYPE "RecurringPaymentType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "recurring_payments" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "category_id" UUID,
  "created_by_id" UUID NOT NULL,
  "type" "RecurringPaymentType" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "note" VARCHAR(500),
  "amount_minor" BIGINT NOT NULL,
  "frequency" "RecurringPaymentFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "next_due_at" TIMESTAMP(3) NOT NULL,
  "reminder_offset_minutes" INTEGER,
  "reminder_recipient_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_payments_amount_minor_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "recurring_payments_interval_check" CHECK ("interval" > 0),
  CONSTRAINT "recurring_payments_reminder_offset_check" CHECK ("reminder_offset_minutes" IS NULL OR "reminder_offset_minutes" >= 0)
);

CREATE TABLE "recurring_payment_forecasts" (
  "id" UUID NOT NULL,
  "recurring_payment_id" UUID NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "reminder_at" TIMESTAMP(3) NOT NULL,
  "reminder_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_payment_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recurring_payment_forecasts_recurring_payment_id_due_at_key" ON "recurring_payment_forecasts"("recurring_payment_id", "due_at");
CREATE INDEX "recurring_payments_family_id_active_next_due_at_idx" ON "recurring_payments"("family_id", "active", "next_due_at");
CREATE INDEX "recurring_payments_wallet_id_active_idx" ON "recurring_payments"("wallet_id", "active");
CREATE INDEX "recurring_payment_forecasts_reminder_at_reminder_sent_at_idx" ON "recurring_payment_forecasts"("reminder_at", "reminder_sent_at");

ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_payment_forecasts" ADD CONSTRAINT "recurring_payment_forecasts_recurring_payment_id_fkey" FOREIGN KEY ("recurring_payment_id") REFERENCES "recurring_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
