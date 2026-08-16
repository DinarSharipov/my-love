CREATE TYPE "FinancialMeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FinancialDecisionStatus" AS ENUM ('PROPOSED', 'AGREED', 'REJECTED');

CREATE TABLE "financial_meetings" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" "FinancialMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_meetings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_decisions" (
  "id" UUID NOT NULL,
  "meeting_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "responded_by_id" UUID,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "status" "FinancialDecisionStatus" NOT NULL DEFAULT 'PROPOSED',
  "responded_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_meetings_family_id_status_scheduled_at_idx" ON "financial_meetings"("family_id", "status", "scheduled_at");
CREATE INDEX "financial_decisions_meeting_id_status_created_at_idx" ON "financial_decisions"("meeting_id", "status", "created_at");

ALTER TABLE "financial_meetings" ADD CONSTRAINT "financial_meetings_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_meetings" ADD CONSTRAINT "financial_meetings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "financial_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_decisions" ADD CONSTRAINT "financial_decisions_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
