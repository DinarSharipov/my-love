CREATE TYPE "FamilyDissolutionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TABLE "family_dissolution_requests" (
  "id" UUID NOT NULL, "family_id" UUID NOT NULL, "requested_by_id" UUID NOT NULL,
  "confirmed_by_id" UUID, "status" "FamilyDissolutionStatus" NOT NULL DEFAULT 'PENDING',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  CONSTRAINT "family_dissolution_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "family_dissolution_requests_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "family_dissolution_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "family_dissolution_requests_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "family_dissolution_requests_family_id_status_idx" ON "family_dissolution_requests"("family_id", "status");
