CREATE TABLE "task_reminders" (
  "id" UUID NOT NULL, "task_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "remind_at" TIMESTAMP(3) NOT NULL, "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_reminders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_reminders_remind_at_sent_at_idx" ON "task_reminders"("remind_at", "sent_at");
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
