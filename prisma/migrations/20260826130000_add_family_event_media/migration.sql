CREATE TABLE "family_event_media" (
    "family_event_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_event_media_pkey" PRIMARY KEY ("family_event_id", "media_id")
);
CREATE INDEX "family_event_media_media_id_idx" ON "family_event_media"("media_id");
ALTER TABLE "family_event_media" ADD CONSTRAINT "family_event_media_family_event_id_fkey"
  FOREIGN KEY ("family_event_id") REFERENCES "family_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_event_media" ADD CONSTRAINT "family_event_media_media_id_fkey"
  FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
