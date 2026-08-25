CREATE TABLE "emergency_contacts" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "relationship" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "email" VARCHAR(320),
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "archived_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "emergency_contacts_family_id_archived_updated_at_idx"
  ON "emergency_contacts"("family_id", "archived", "updated_at");
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
