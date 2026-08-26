CREATE TABLE "ledger_transaction_media" (
    "transaction_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transaction_media_pkey" PRIMARY KEY ("transaction_id", "media_id")
);

CREATE INDEX "ledger_transaction_media_media_id_idx" ON "ledger_transaction_media"("media_id");

ALTER TABLE "ledger_transaction_media" ADD CONSTRAINT "ledger_transaction_media_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_transaction_media" ADD CONSTRAINT "ledger_transaction_media_media_id_fkey"
    FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
