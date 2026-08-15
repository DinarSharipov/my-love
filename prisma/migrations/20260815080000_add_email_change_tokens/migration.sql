CREATE TABLE "email_change_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_email" VARCHAR(320) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_change_tokens_token_hash_key"
ON "email_change_tokens"("token_hash");

CREATE INDEX "email_change_tokens_user_id_used_at_idx"
ON "email_change_tokens"("user_id", "used_at");

CREATE INDEX "email_change_tokens_expires_at_idx"
ON "email_change_tokens"("expires_at");

ALTER TABLE "email_change_tokens"
ADD CONSTRAINT "email_change_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
