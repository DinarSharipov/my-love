CREATE TABLE "recipe_dietary_labels" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    CONSTRAINT "recipe_dietary_labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_dietary_labels_recipe_id_label_key" ON "recipe_dietary_labels"("recipe_id", "label");
CREATE INDEX "recipe_dietary_labels_recipe_id_idx" ON "recipe_dietary_labels"("recipe_id");
ALTER TABLE "recipe_dietary_labels" ADD CONSTRAINT "recipe_dietary_labels_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
