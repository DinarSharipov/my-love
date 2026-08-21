ALTER TABLE "media" ADD COLUMN "family_id" UUID;
ALTER TABLE "media" ADD COLUMN "preview_object_key" VARCHAR(512);

UPDATE "media" AS m
SET "family_id" = fm."family_id"
FROM "family_members" AS fm
WHERE fm."user_id" = m."user_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "media" WHERE "family_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill media.family_id: media owner has no family membership';
  END IF;
END $$;

ALTER TABLE "media" ALTER COLUMN "family_id" SET NOT NULL;
ALTER TABLE "media" ADD CONSTRAINT "media_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "media_user_id_created_at_idx";
DROP INDEX "media_user_id_original_name_idx";
CREATE INDEX "media_family_id_created_at_idx" ON "media"("family_id", "created_at");
CREATE INDEX "media_family_id_original_name_idx" ON "media"("family_id", "original_name");
CREATE INDEX "media_user_id_created_at_idx" ON "media"("user_id", "created_at");
