ALTER TABLE "users"
ADD COLUMN "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN "deletion_scheduled_at" TIMESTAMP(3);

CREATE INDEX "users_deletion_scheduled_at_idx"
ON "users"("deletion_scheduled_at");

CREATE TABLE "account_deletion_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletion_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_deletion_tokens_token_hash_key"
ON "account_deletion_tokens"("token_hash");

CREATE INDEX "account_deletion_tokens_user_id_used_at_idx"
ON "account_deletion_tokens"("user_id", "used_at");

CREATE INDEX "account_deletion_tokens_expires_at_idx"
ON "account_deletion_tokens"("expires_at");

ALTER TABLE "account_deletion_tokens"
ADD CONSTRAINT "account_deletion_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
