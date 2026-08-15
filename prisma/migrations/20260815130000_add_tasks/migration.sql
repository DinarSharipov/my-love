CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TABLE "tasks" (
  "id" UUID NOT NULL, "family_id" UUID NOT NULL, "created_by_id" UUID NOT NULL,
  "assigned_to_id" UUID, "completed_by_id" UUID, "title" VARCHAR(200) NOT NULL,
  "description" TEXT, "due_at" TIMESTAMP(3), "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN', "version" INTEGER NOT NULL DEFAULT 1,
  "completed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_family_id_status_due_at_idx" ON "tasks"("family_id", "status", "due_at");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
