CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISSOLVED');
CREATE TYPE "FamilyMemberRole" AS ENUM ('PARTNER', 'CHILD');

ALTER TABLE "families"
ADD COLUMN "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "time_zone" VARCHAR(100) NOT NULL DEFAULT 'Europe/Moscow',
ADD COLUMN "locale" VARCHAR(35) NOT NULL DEFAULT 'ru-RU',
ADD COLUMN "default_currency" CHAR(3) NOT NULL DEFAULT 'RUB',
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "dissolved_at" TIMESTAMP(3),
ADD CONSTRAINT "families_default_currency_check"
  CHECK ("default_currency" ~ '^[A-Z]{3}$'),
ADD CONSTRAINT "families_lifecycle_timestamps_check"
  CHECK (
    ("status" = 'ACTIVE' AND "archived_at" IS NULL AND "dissolved_at" IS NULL)
    OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL AND "dissolved_at" IS NULL)
    OR ("status" = 'DISSOLVED' AND "dissolved_at" IS NOT NULL)
  );

ALTER TABLE "family_members"
ADD COLUMN "role" "FamilyMemberRole" NOT NULL DEFAULT 'PARTNER';

CREATE INDEX "family_members_family_id_role_idx"
ON "family_members"("family_id", "role");

-- This trigger is the database-level backstop. Application writes also lock the
-- family row before checking capacity so concurrent partner additions serialize.
CREATE FUNCTION enforce_family_partner_limit() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "families" WHERE "id" = NEW."family_id" FOR UPDATE;
  IF NEW."role" = 'PARTNER' AND (
    SELECT COUNT(*)
    FROM "family_members"
    WHERE "family_id" = NEW."family_id"
      AND "role" = 'PARTNER'
      AND "id" <> NEW."id"
  ) >= 2 THEN
    RAISE EXCEPTION 'A family cannot have more than two partners'
      USING ERRCODE = '23514', CONSTRAINT = 'family_members_partner_limit_check';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "family_members_partner_limit_trigger"
BEFORE INSERT OR UPDATE OF "family_id", "role" ON "family_members"
FOR EACH ROW EXECUTE FUNCTION enforce_family_partner_limit();
