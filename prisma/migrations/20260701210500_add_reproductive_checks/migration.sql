-- Diagnóstico reproductivo (tacto / ecografía) en la manga.
-- El valor de BD de PregnancyStatus conserva el acento ("PREÑADA");
-- el cliente Prisma lo expone como PRENADA (@map).
CREATE TYPE "CheckType" AS ENUM ('TACTO', 'ECOGRAFIA');
CREATE TYPE "PregnancyStatus" AS ENUM ('PREÑADA', 'VACIA');

CREATE TABLE "reproductive_checks" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "CheckType" NOT NULL,
    "result" "PregnancyStatus" NOT NULL,
    "observations" TEXT,
    "animal_id" UUID NOT NULL,
    "potrero_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reproductive_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reproductive_checks_establishment_id_idx" ON "reproductive_checks"("establishment_id");
CREATE INDEX "reproductive_checks_potrero_id_idx" ON "reproductive_checks"("potrero_id");
CREATE INDEX "reproductive_checks_animal_id_idx" ON "reproductive_checks"("animal_id");

ALTER TABLE "reproductive_checks" ADD CONSTRAINT "reproductive_checks_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reproductive_checks" ADD CONSTRAINT "reproductive_checks_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
