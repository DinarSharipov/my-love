ALTER TABLE "first_dates"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "family_events"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "first_dates"
ADD CONSTRAINT "first_dates_version_positive_check" CHECK ("version" > 0);

ALTER TABLE "family_events"
ADD CONSTRAINT "family_events_version_positive_check" CHECK ("version" > 0);
