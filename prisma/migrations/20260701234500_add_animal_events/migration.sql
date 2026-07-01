-- Bitácora general del animal (recorridas diarias, condición corporal, notas...).
CREATE TYPE "AnimalEventType" AS ENUM ('NOTA', 'CONDICION_CORPORAL', 'PARTO', 'ABORTO', 'MUERTE', 'TRATAMIENTO', 'CAMBIO_LOTE', 'OTRO');

CREATE TABLE "animal_events" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "AnimalEventType" NOT NULL,
    "note" TEXT,
    "score" DECIMAL(3,1),
    "weight_kg" DECIMAL(7,2),
    "data" JSONB NOT NULL DEFAULT '{}',
    "animal_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "animal_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "animal_events_establishment_id_idx" ON "animal_events"("establishment_id");
CREATE INDEX "animal_events_animal_id_date_idx" ON "animal_events"("animal_id", "date");
CREATE INDEX "animal_events_type_idx" ON "animal_events"("type");

ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
