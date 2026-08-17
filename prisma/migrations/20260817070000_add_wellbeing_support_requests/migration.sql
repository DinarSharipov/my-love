CREATE TYPE "WellbeingSupportRequestStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

CREATE TABLE "wellbeing_support_requests" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "message" TEXT,
    "status" "WellbeingSupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wellbeing_support_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wellbeing_support_requests_family_id_created_at_idx" ON "wellbeing_support_requests"("family_id", "created_at");
CREATE INDEX "wellbeing_support_requests_recipient_id_status_created_at_idx" ON "wellbeing_support_requests"("recipient_id", "status", "created_at");
ALTER TABLE "wellbeing_support_requests" ADD CONSTRAINT "wellbeing_support_requests_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_support_requests" ADD CONSTRAINT "wellbeing_support_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_support_requests" ADD CONSTRAINT "wellbeing_support_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
