-- CreateTable
CREATE TABLE "first_dates" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "first_dates_pkey" PRIMARY KEY ("id")
);

-- A family can have only one first-date record.
CREATE UNIQUE INDEX "first_dates_family_id_key" ON "first_dates"("family_id");

CREATE INDEX "first_dates_created_by_id_idx" ON "first_dates"("created_by_id");

ALTER TABLE "first_dates"
ADD CONSTRAINT "first_dates_family_id_fkey"
FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "first_dates"
ADD CONSTRAINT "first_dates_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
