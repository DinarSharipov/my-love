CREATE TYPE "TaskRoutineFrequency" AS ENUM ('DAILY', 'WEEKLY');
CREATE TABLE "task_routines" (
  "id" UUID NOT NULL, "family_id" UUID NOT NULL, "created_by_id" UUID NOT NULL,
  "assigned_to_id" UUID, "title" VARCHAR(200) NOT NULL, "description" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL', "frequency" "TaskRoutineFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1, "next_run_at" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_routines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_routines_family_id_active_next_run_at_idx" ON "task_routines"("family_id", "active", "next_run_at");
ALTER TABLE "task_routines" ADD CONSTRAINT "task_routines_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_routines" ADD CONSTRAINT "task_routines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_routines" ADD CONSTRAINT "task_routines_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
