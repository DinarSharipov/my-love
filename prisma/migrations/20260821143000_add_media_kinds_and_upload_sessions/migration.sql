CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');
CREATE TYPE "MediaUploadStatus" AS ENUM ('INITIATED', 'COMPLETED', 'ABORTED');

ALTER TABLE "media" ADD COLUMN "kind" "MediaKind";
UPDATE "media"
SET "kind" = CASE
  WHEN "mime_type" LIKE 'image/%' THEN 'IMAGE'::"MediaKind"
  WHEN "mime_type" LIKE 'video/%' THEN 'VIDEO'::"MediaKind"
  WHEN "mime_type" LIKE 'audio/%' THEN 'AUDIO'::"MediaKind"
  ELSE NULL
END;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "media" WHERE "kind" IS NULL) THEN
    RAISE EXCEPTION 'Cannot classify existing media by MIME type';
  END IF;
END $$;
ALTER TABLE "media" ALTER COLUMN "kind" SET NOT NULL;
CREATE INDEX "media_family_id_kind_created_at_idx" ON "media"("family_id", "kind", "created_at");

CREATE TABLE "media_upload_sessions" (
  "id" UUID NOT NULL,
  "upload_id" VARCHAR(256) NOT NULL,
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "object_key" VARCHAR(512) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(127) NOT NULL,
  "kind" "MediaKind" NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "status" "MediaUploadStatus" NOT NULL DEFAULT 'INITIATED',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_upload_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "media_upload_sessions_upload_id_key" ON "media_upload_sessions"("upload_id");
CREATE INDEX "media_upload_sessions_user_id_status_created_at_idx" ON "media_upload_sessions"("user_id", "status", "created_at");
CREATE INDEX "media_upload_sessions_family_id_status_created_at_idx" ON "media_upload_sessions"("family_id", "status", "created_at");
ALTER TABLE "media_upload_sessions" ADD CONSTRAINT "media_upload_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_upload_sessions" ADD CONSTRAINT "media_upload_sessions_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
