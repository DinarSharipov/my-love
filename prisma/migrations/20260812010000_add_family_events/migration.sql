-- CreateEnum
CREATE TYPE "FamilyEventDecisionStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "family_events" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "responded_by_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(500) NOT NULL,
    "status" "FamilyEventDecisionStatus" NOT NULL DEFAULT 'PROPOSED',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "family_events_response_consistency_check" CHECK (
      ("status" = 'PROPOSED' AND "responded_by_id" IS NULL AND "responded_at" IS NULL)
      OR
      ("status" IN ('CONFIRMED', 'REJECTED') AND "responded_by_id" IS NOT NULL AND "responded_at" IS NOT NULL)
    ),
    CONSTRAINT "family_events_responder_differs_check" CHECK (
      "responded_by_id" IS NULL OR "responded_by_id" <> "proposed_by_id"
    )
);

-- CreateIndex
CREATE INDEX "family_events_family_id_scheduled_at_idx" ON "family_events"("family_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "family_events_proposed_by_id_idx" ON "family_events"("proposed_by_id");

-- AddForeignKey
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
