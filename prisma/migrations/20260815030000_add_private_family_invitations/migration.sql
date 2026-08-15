CREATE TABLE "private_family_invitations" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "accepted_by_id" UUID,
    "recipient_email" VARCHAR(320) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" "FamilyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "private_family_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "private_family_invitations_use_count_check"
      CHECK ("max_uses" > 0 AND "use_count" >= 0 AND "use_count" <= "max_uses")
);

CREATE UNIQUE INDEX "private_family_invitations_token_hash_key"
ON "private_family_invitations"("token_hash");

CREATE INDEX "private_family_invitations_sender_id_status_idx"
ON "private_family_invitations"("sender_id", "status");

CREATE INDEX "private_family_invitations_recipient_email_status_idx"
ON "private_family_invitations"("recipient_email", "status");

CREATE INDEX "private_family_invitations_expires_at_status_idx"
ON "private_family_invitations"("expires_at", "status");

ALTER TABLE "private_family_invitations"
ADD CONSTRAINT "private_family_invitations_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "private_family_invitations"
ADD CONSTRAINT "private_family_invitations_accepted_by_id_fkey"
FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
