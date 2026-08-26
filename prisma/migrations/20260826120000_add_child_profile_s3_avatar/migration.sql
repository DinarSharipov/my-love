ALTER TABLE "child_profiles"
  ADD COLUMN "avatar_media_id" UUID,
  ADD COLUMN "avatar_preview_token" VARCHAR(64);

CREATE UNIQUE INDEX "child_profiles_avatar_preview_token_key"
  ON "child_profiles"("avatar_preview_token");

CREATE INDEX "child_profiles_avatar_media_id_idx"
  ON "child_profiles"("avatar_media_id");

ALTER TABLE "child_profiles"
  ADD CONSTRAINT "child_profiles_avatar_media_id_fkey"
  FOREIGN KEY ("avatar_media_id") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
