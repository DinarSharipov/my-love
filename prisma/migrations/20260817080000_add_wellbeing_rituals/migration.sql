CREATE TABLE "wellbeing_rituals" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "cadence" VARCHAR(50) NOT NULL,
  "next_at" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wellbeing_rituals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wellbeing_rituals_family_id_is_active_next_at_idx" ON "wellbeing_rituals"("family_id", "is_active", "next_at");
ALTER TABLE "wellbeing_rituals" ADD CONSTRAINT "wellbeing_rituals_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_rituals" ADD CONSTRAINT "wellbeing_rituals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
