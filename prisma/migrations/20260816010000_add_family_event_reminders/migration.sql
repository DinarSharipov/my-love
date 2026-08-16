ALTER TABLE "family_events"
  ADD COLUMN "reminder_offset_minutes" INTEGER,
  ADD COLUMN "reminder_recipient_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "reminder_at" TIMESTAMP(3),
  ADD COLUMN "reminder_sent_at" TIMESTAMP(3),
  ADD COLUMN "repeat_reminder_at" TIMESTAMP(3),
  ADD COLUMN "repeat_reminder_sent_at" TIMESTAMP(3);

CREATE INDEX "family_events_reminder_at_reminder_sent_at_idx"
  ON "family_events"("reminder_at", "reminder_sent_at");

CREATE INDEX "family_events_repeat_reminder_at_repeat_reminder_sent_at_idx"
  ON "family_events"("repeat_reminder_at", "repeat_reminder_sent_at");
