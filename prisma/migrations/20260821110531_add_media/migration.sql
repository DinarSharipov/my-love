CREATE TABLE "media" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "object_key" VARCHAR(512) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(127) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_object_key_key" ON "media"("object_key");
CREATE INDEX "media_user_id_created_at_idx" ON "media"("user_id", "created_at");
CREATE INDEX "media_user_id_original_name_idx" ON "media"("user_id", "original_name");

ALTER TABLE "media" ADD CONSTRAINT "media_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
