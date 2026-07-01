-- Ciclo reproductivo (servicio, parición, destete): serie temporal por animal.
CREATE TYPE "ReproEventType" AS ENUM ('SERVICIO', 'PARICION', 'DESTETE');

CREATE TABLE "reproductive_events" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ReproEventType" NOT NULL,
    "observations" TEXT,
    "sire_tag_id" TEXT,
    "offspring_tag_id" TEXT,
    "animal_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reproductive_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reproductive_events_establishment_id_idx" ON "reproductive_events"("establishment_id");
CREATE INDEX "reproductive_events_animal_id_date_idx" ON "reproductive_events"("animal_id", "date");
CREATE INDEX "reproductive_events_type_idx" ON "reproductive_events"("type");

ALTER TABLE "reproductive_events" ADD CONSTRAINT "reproductive_events_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reproductive_events" ADD CONSTRAINT "reproductive_events_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
