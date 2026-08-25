-- Generated meal items are idempotent within a meal-plan and destination shopping list.
-- Preserve existing item rows and user edits while making historical keys match the new scope.
UPDATE "shopping_items"
SET "source_key" = format(
  'meal-plan:%s:list:%s:ingredient:%s',
  split_part("source_key", ':', 2),
  "list_id"::text,
  split_part("source_key", ':', 4)
)
WHERE "source_key" ~ '^meal-plan:[0-9A-Fa-f-]{36}:ingredient:[0-9A-Fa-f-]{36}$';
