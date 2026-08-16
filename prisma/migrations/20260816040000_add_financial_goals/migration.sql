CREATE TABLE "financial_goals" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "target_amount_minor" BIGINT NOT NULL,
  "target_date" DATE,
  "achieved_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_goals_target_amount_minor_check" CHECK ("target_amount_minor" > 0)
);

CREATE TABLE "financial_goal_contributions" (
  "id" UUID NOT NULL,
  "goal_id" UUID NOT NULL,
  "transaction_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_goal_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_goals_wallet_id_key" ON "financial_goals"("wallet_id");
CREATE INDEX "financial_goals_family_id_archived_at_created_at_idx" ON "financial_goals"("family_id", "archived_at", "created_at");
CREATE UNIQUE INDEX "financial_goal_contributions_transaction_id_key" ON "financial_goal_contributions"("transaction_id");
CREATE INDEX "financial_goal_contributions_goal_id_created_at_idx" ON "financial_goal_contributions"("goal_id", "created_at");

ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_goal_contributions" ADD CONSTRAINT "financial_goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "financial_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_goal_contributions" ADD CONSTRAINT "financial_goal_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_goal_contributions" ADD CONSTRAINT "financial_goal_contributions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
