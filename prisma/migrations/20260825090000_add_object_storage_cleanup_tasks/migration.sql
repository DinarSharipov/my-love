CREATE TYPE "ObjectStorageCleanupAction" AS ENUM ('DELETE_OBJECT', 'ABORT_MULTIPART_UPLOAD');

CREATE TABLE "object_storage_cleanup_tasks" (
  "id" UUID NOT NULL,
  "dedupe_key" VARCHAR(1024) NOT NULL,
  "action" "ObjectStorageCleanupAction" NOT NULL,
  "object_key" VARCHAR(512) NOT NULL,
  "upload_id" VARCHAR(256),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMP(3),
  "last_error" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "object_storage_cleanup_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "object_storage_cleanup_tasks_dedupe_key_key"
  ON "object_storage_cleanup_tasks"("dedupe_key");

CREATE INDEX "object_storage_cleanup_tasks_next_attempt_at_locked_until_idx"
  ON "object_storage_cleanup_tasks"("next_attempt_at", "locked_until");
