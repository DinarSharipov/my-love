CREATE TABLE "recipes" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "instructions" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "recipe_ingredients" (
  "id" UUID NOT NULL,
  "recipe_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "quantity" VARCHAR(80),
  CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recipes_family_id_archived_updated_at_idx" ON "recipes"("family_id", "archived", "updated_at");
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
