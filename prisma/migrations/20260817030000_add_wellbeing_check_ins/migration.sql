CREATE TABLE "wellbeing_check_ins" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "mood" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "note" TEXT,
    "support_request" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wellbeing_check_ins_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wellbeing_check_ins_owner_id_created_at_idx" ON "wellbeing_check_ins"("owner_id", "created_at");
CREATE INDEX "wellbeing_check_ins_family_id_created_at_idx" ON "wellbeing_check_ins"("family_id", "created_at");
ALTER TABLE "wellbeing_check_ins" ADD CONSTRAINT "wellbeing_check_ins_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_check_ins" ADD CONSTRAINT "wellbeing_check_ins_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_check_ins" ADD CONSTRAINT "wellbeing_check_ins_scale_check" CHECK ("mood" BETWEEN 1 AND 5 AND "energy" BETWEEN 1 AND 5 AND "stress" BETWEEN 1 AND 5);
