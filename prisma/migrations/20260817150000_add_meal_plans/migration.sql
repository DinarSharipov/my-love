CREATE TABLE "meal_plans" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "planned_for" DATE NOT NULL,
    "meal_slot" VARCHAR(40) NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "shopping_items" ADD COLUMN "source_key" VARCHAR(180);
CREATE UNIQUE INDEX "shopping_items_source_key_key" ON "shopping_items"("source_key");
CREATE UNIQUE INDEX "meal_plans_family_id_planned_for_meal_slot_key" ON "meal_plans"("family_id", "planned_for", "meal_slot");
CREATE INDEX "meal_plans_family_id_planned_for_idx" ON "meal_plans"("family_id", "planned_for");
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
