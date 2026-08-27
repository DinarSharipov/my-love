CREATE TYPE "FamilyWishImplementationStatus" AS ENUM ('NOT_REALIZED', 'REALIZED');
CREATE TYPE "FamilyWishApprovalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "FamilyWishRealizationConfirmationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "family_wishes" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "implementation_status" "FamilyWishImplementationStatus" NOT NULL DEFAULT 'NOT_REALIZED',
    "partner_approval_status" "FamilyWishApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "realization_confirmation_status" "FamilyWishRealizationConfirmationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "realized_by_id" UUID,
    "realized_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_wishes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "family_wishes_status_check" CHECK (
      ("partner_approval_status" = 'PENDING' AND "implementation_status" = 'NOT_REALIZED' AND "realization_confirmation_status" = 'NOT_REQUESTED')
      OR ("partner_approval_status" = 'REJECTED' AND "implementation_status" = 'NOT_REALIZED' AND "realization_confirmation_status" = 'NOT_REQUESTED')
      OR ("partner_approval_status" = 'ACCEPTED' AND "implementation_status" = 'NOT_REALIZED' AND "realization_confirmation_status" IN ('NOT_REQUESTED', 'REJECTED'))
      OR ("partner_approval_status" = 'ACCEPTED' AND "implementation_status" = 'REALIZED' AND "realization_confirmation_status" IN ('PENDING', 'ACCEPTED'))
    )
);

CREATE INDEX "family_wishes_family_id_created_at_id_idx" ON "family_wishes"("family_id", "created_at", "id");
CREATE INDEX "family_wishes_family_id_implementation_status_created_at_idx" ON "family_wishes"("family_id", "implementation_status", "created_at");
CREATE INDEX "family_wishes_partner_id_partner_approval_status_created_at_idx" ON "family_wishes"("partner_id", "partner_approval_status", "created_at");
CREATE INDEX "family_wishes_created_by_id_created_at_idx" ON "family_wishes"("created_by_id", "created_at");

ALTER TABLE "family_wishes" ADD CONSTRAINT "family_wishes_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_wishes" ADD CONSTRAINT "family_wishes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_wishes" ADD CONSTRAINT "family_wishes_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_wishes" ADD CONSTRAINT "family_wishes_realized_by_id_fkey" FOREIGN KEY ("realized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
