CREATE TYPE "IntimacyMood" AS ENUM ('SEX', 'TENDERNESS', 'CLOSENESS', 'EXPERIMENT', 'NOT_TODAY', 'UNSURE');

CREATE TYPE "IntimacyPreference" AS ENUM ('KISSING', 'MASSAGE', 'SEX', 'SHOWER', 'ROMANTIC', 'EXPERIMENT', 'OTHER');

CREATE TYPE "IntimacyRating" AS ENUM ('GREAT', 'GOOD', 'NEUTRAL');

CREATE TABLE "intimacy_check_ins" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "mood" "IntimacyMood" NOT NULL,
    "desire_level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intimacy_check_ins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "intimacy_check_ins_desire_level_check" CHECK ("desire_level" BETWEEN 1 AND 5)
);

CREATE TABLE "intimacy_check_in_preferences" (
    "check_in_id" UUID NOT NULL,
    "preference" "IntimacyPreference" NOT NULL,
    CONSTRAINT "intimacy_check_in_preferences_pkey" PRIMARY KEY ("check_in_id", "preference")
);

CREATE TABLE "intimacy_events" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "occurred" BOOLEAN NOT NULL,
    "rating" "IntimacyRating",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intimacy_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intimacy_check_ins_user_id_date_key" ON "intimacy_check_ins"("user_id", "date");
CREATE INDEX "intimacy_check_ins_family_id_date_idx" ON "intimacy_check_ins"("family_id", "date");
CREATE INDEX "intimacy_check_ins_family_id_user_id_date_idx" ON "intimacy_check_ins"("family_id", "user_id", "date");
CREATE UNIQUE INDEX "intimacy_events_family_id_date_key" ON "intimacy_events"("family_id", "date");
CREATE INDEX "intimacy_events_family_id_created_by_user_id_idx" ON "intimacy_events"("family_id", "created_by_user_id");

ALTER TABLE "intimacy_check_ins" ADD CONSTRAINT "intimacy_check_ins_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intimacy_check_ins" ADD CONSTRAINT "intimacy_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intimacy_check_in_preferences" ADD CONSTRAINT "intimacy_check_in_preferences_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "intimacy_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intimacy_events" ADD CONSTRAINT "intimacy_events_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intimacy_events" ADD CONSTRAINT "intimacy_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
