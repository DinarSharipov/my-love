ALTER TABLE "auth_sessions"
ADD COLUMN "ip_address" VARCHAR(45),
ADD COLUMN "user_agent" VARCHAR(512),
ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "auth_sessions_user_id_created_at_idx"
ON "auth_sessions"("user_id", "created_at" DESC);
