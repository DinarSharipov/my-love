CREATE TABLE "child_profiles" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "birth_date" DATE NOT NULL,
    "avatar_url" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "child_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "child_profiles_family_id_first_name_idx" ON "child_profiles"("family_id", "first_name");
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
