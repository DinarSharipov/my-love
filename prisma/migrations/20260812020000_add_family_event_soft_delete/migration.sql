-- AlterTable
ALTER TABLE "family_events"
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_id" UUID;

-- Keep deletion audit fields consistent and ensure only the proposer is recorded as deleter.
ALTER TABLE "family_events"
ADD CONSTRAINT "family_events_deletion_consistency_check" CHECK (
  ("deleted_at" IS NULL AND "deleted_by_id" IS NULL)
  OR
  ("deleted_at" IS NOT NULL AND "deleted_by_id" = "proposed_by_id")
);

-- CreateIndex
CREATE INDEX "family_events_family_id_deleted_at_scheduled_at_idx"
ON "family_events"("family_id", "deleted_at", "scheduled_at");

-- AddForeignKey
ALTER TABLE "family_events"
ADD CONSTRAINT "family_events_deleted_by_id_fkey"
FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
