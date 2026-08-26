CREATE TABLE "recipe_media" (
    "recipe_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_media_pkey" PRIMARY KEY ("recipe_id", "media_id")
);

CREATE INDEX "recipe_media_media_id_idx" ON "recipe_media"("media_id");

ALTER TABLE "recipe_media" ADD CONSTRAINT "recipe_media_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_media" ADD CONSTRAINT "recipe_media_media_id_fkey"
    FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
