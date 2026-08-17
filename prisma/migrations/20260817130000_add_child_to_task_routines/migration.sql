ALTER TABLE "task_routines" ADD COLUMN "child_id" UUID;

CREATE INDEX "task_routines_family_id_child_id_active_next_run_at_idx"
ON "task_routines"("family_id", "child_id", "active", "next_run_at");

ALTER TABLE "task_routines"
ADD CONSTRAINT "task_routines_child_id_fkey"
FOREIGN KEY ("child_id") REFERENCES "child_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
