CREATE TABLE "wellbeing_gratitudes" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wellbeing_gratitudes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wellbeing_gratitudes_family_id_created_at_idx" ON "wellbeing_gratitudes"("family_id", "created_at");
CREATE INDEX "wellbeing_gratitudes_recipient_id_created_at_idx" ON "wellbeing_gratitudes"("recipient_id", "created_at");

ALTER TABLE "wellbeing_gratitudes" ADD CONSTRAINT "wellbeing_gratitudes_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_gratitudes" ADD CONSTRAINT "wellbeing_gratitudes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_gratitudes" ADD CONSTRAINT "wellbeing_gratitudes_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
