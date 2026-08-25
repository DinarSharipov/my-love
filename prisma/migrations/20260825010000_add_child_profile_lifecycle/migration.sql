ALTER TABLE "child_profiles"
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "child_profiles_family_id_archived_updated_at_idx"
  ON "child_profiles"("family_id", "archived", "updated_at");
