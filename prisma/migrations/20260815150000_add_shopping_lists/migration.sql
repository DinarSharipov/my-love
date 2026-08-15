CREATE TABLE "shopping_lists" (
  "id" UUID NOT NULL, "family_id" UUID NOT NULL, "created_by_id" UUID NOT NULL,
  "name" VARCHAR(150) NOT NULL, "archived" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "shopping_items" (
  "id" UUID NOT NULL, "list_id" UUID NOT NULL, "added_by_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL, "quantity" VARCHAR(80), "checked" BOOLEAN NOT NULL DEFAULT false,
  "checked_by_id" UUID, "checked_at" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shopping_lists_family_id_archived_updated_at_idx" ON "shopping_lists"("family_id", "archived", "updated_at");
CREATE INDEX "shopping_items_list_id_checked_created_at_idx" ON "shopping_items"("list_id", "checked", "created_at");
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
