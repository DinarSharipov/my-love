CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');

CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope" VARCHAR(150) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_records_response_check" CHECK (
      ("status" = 'PROCESSING' AND "response_status" IS NULL) OR
      ("status" = 'COMPLETED' AND "response_status" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "idempotency_records_user_id_scope_key_key"
ON "idempotency_records"("user_id", "scope", "key");

CREATE INDEX "idempotency_records_expires_at_status_idx"
ON "idempotency_records"("expires_at", "status");

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
