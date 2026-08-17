ALTER TABLE "tasks" ADD COLUMN "child_id" UUID;

CREATE INDEX "tasks_family_id_child_id_status_idx" ON "tasks"("family_id", "child_id", "status");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
