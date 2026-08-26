-- A deterministic, sorted pair key makes a direct conversation unique within a family.
ALTER TABLE "conversations" ADD COLUMN "direct_key" VARCHAR(73);

-- Preserve historical duplicate conversations, but archive all except the earliest active
-- conversation for a pair before creating the unique index.
WITH direct_pairs AS (
    SELECT
        c."id",
        string_agg(cm."user_id"::text, ':' ORDER BY cm."user_id"::text) AS "direct_key",
        COUNT(*) AS "member_count"
    FROM "conversations" c
    JOIN "conversation_members" cm ON cm."conversation_id" = c."id"
    WHERE c."type" = 'DIRECT'
    GROUP BY c."id"
), ranked_direct_pairs AS (
    SELECT
        dp."id",
        dp."direct_key",
        ROW_NUMBER() OVER (
            PARTITION BY c."family_id", dp."direct_key"
            ORDER BY (c."status" = 'ACTIVE') DESC, c."created_at" ASC, c."id" ASC
        ) AS "pair_rank"
    FROM direct_pairs dp
    JOIN "conversations" c ON c."id" = dp."id"
    WHERE dp."member_count" = 2
)
UPDATE "conversations" c
SET
    "direct_key" = CASE WHEN r."pair_rank" = 1 THEN r."direct_key" ELSE NULL END,
    "status" = CASE WHEN r."pair_rank" = 1 THEN c."status" ELSE 'ARCHIVED'::"ConversationStatus" END
FROM ranked_direct_pairs r
WHERE c."id" = r."id";

CREATE UNIQUE INDEX "conversations_family_id_direct_key_key"
ON "conversations"("family_id", "direct_key");
