CREATE TYPE "FamilyInvitationStatus" AS ENUM (
    'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'
);

CREATE TABLE "families" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "family_members" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "family_invitations" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "status" "FamilyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "family_invitations_different_users_check" CHECK ("sender_id" <> "recipient_id")
);

CREATE UNIQUE INDEX "family_members_user_id_key" ON "family_members"("user_id");
CREATE UNIQUE INDEX "family_members_family_id_user_id_key" ON "family_members"("family_id", "user_id");
CREATE INDEX "family_members_family_id_idx" ON "family_members"("family_id");
CREATE INDEX "family_invitations_sender_id_status_idx" ON "family_invitations"("sender_id", "status");
CREATE INDEX "family_invitations_recipient_id_status_idx" ON "family_invitations"("recipient_id", "status");
CREATE INDEX "family_invitations_expires_at_status_idx" ON "family_invitations"("expires_at", "status");

-- Prevent duplicate pending invitations between the same users in either direction.
CREATE UNIQUE INDEX "family_invitations_pending_pair_key"
ON "family_invitations" (LEAST("sender_id", "recipient_id"), GREATEST("sender_id", "recipient_id"))
WHERE "status" = 'PENDING';

ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_fkey"
FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
