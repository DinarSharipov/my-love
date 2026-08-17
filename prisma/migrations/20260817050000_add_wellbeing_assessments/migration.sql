CREATE TABLE "wellbeing_assessments" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "answers" INTEGER[] NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wellbeing_assessments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wellbeing_assessments_owner_id_created_at_idx" ON "wellbeing_assessments"("owner_id", "created_at");
ALTER TABLE "wellbeing_assessments" ADD CONSTRAINT "wellbeing_assessments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_assessments" ADD CONSTRAINT "wellbeing_assessments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
