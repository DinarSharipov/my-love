CREATE TABLE "wellbeing_consent_grants" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wellbeing_consent_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wellbeing_consent_grants_owner_id_recipient_id_key" ON "wellbeing_consent_grants"("owner_id", "recipient_id");
CREATE INDEX "wellbeing_consent_grants_family_id_recipient_id_revoked_at_idx" ON "wellbeing_consent_grants"("family_id", "recipient_id", "revoked_at");
ALTER TABLE "wellbeing_consent_grants" ADD CONSTRAINT "wellbeing_consent_grants_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_consent_grants" ADD CONSTRAINT "wellbeing_consent_grants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wellbeing_consent_grants" ADD CONSTRAINT "wellbeing_consent_grants_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
