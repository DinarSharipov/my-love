CREATE TABLE "wellbeing_couple_meetings" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "sections" JSONB NOT NULL,
  "responses" JSONB NOT NULL DEFAULT '{}',
  "published_at" TIMESTAMP(3),
  "shared_decision" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wellbeing_couple_meetings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wellbeing_couple_meetings_family_id_scheduled_at_idx" ON "wellbeing_couple_meetings"("family_id", "scheduled_at");
ALTER TABLE "wellbeing_couple_meetings" ADD CONSTRAINT "wellbeing_couple_meetings_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_couple_meetings" ADD CONSTRAINT "wellbeing_couple_meetings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
