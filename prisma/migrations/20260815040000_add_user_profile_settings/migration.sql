ALTER TABLE "users"
ADD COLUMN "locale" VARCHAR(35) NOT NULL DEFAULT 'ru-RU',
ADD COLUMN "time_zone" VARCHAR(100) NOT NULL DEFAULT 'Europe/Moscow',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "users"
ADD CONSTRAINT "users_version_positive_check" CHECK ("version" > 0);
