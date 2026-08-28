CREATE TYPE "MediaScope" AS ENUM ('ALBUM', 'CHAT', 'RECIPE', 'FAMILY_EVENT', 'LEDGER', 'USER_AVATAR', 'CHILD_AVATAR');

ALTER TABLE "media" ADD COLUMN "scope" "MediaScope" NOT NULL DEFAULT 'ALBUM';
ALTER TABLE "media_upload_sessions" ADD COLUMN "scope" "MediaScope" NOT NULL DEFAULT 'ALBUM';

CREATE INDEX "media_family_id_scope_created_at_idx" ON "media"("family_id", "scope", "created_at");
CREATE INDEX "media_user_id_scope_created_at_idx" ON "media"("user_id", "scope", "created_at");
