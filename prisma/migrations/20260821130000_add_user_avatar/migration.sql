ALTER TABLE "users"
  ADD COLUMN "avatar_object_key" VARCHAR(512),
  ADD COLUMN "avatar_preview_object_key" VARCHAR(512),
  ADD COLUMN "avatar_preview_token" VARCHAR(64),
  ADD COLUMN "avatar_mime_type" VARCHAR(127),
  ADD COLUMN "avatar_size_bytes" BIGINT;

CREATE UNIQUE INDEX "users_avatar_object_key_key"
  ON "users"("avatar_object_key");

CREATE UNIQUE INDEX "users_avatar_preview_object_key_key"
  ON "users"("avatar_preview_object_key");

CREATE UNIQUE INDEX "users_avatar_preview_token_key"
  ON "users"("avatar_preview_token");
