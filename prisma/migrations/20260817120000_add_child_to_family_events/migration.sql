ALTER TABLE "family_events" ADD COLUMN "child_id" UUID;

CREATE INDEX "family_events_family_id_child_id_scheduled_at_idx"
  ON "family_events"("family_id", "child_id", "scheduled_at");

ALTER TABLE "family_events" ADD CONSTRAINT "family_events_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
