-- CreateEnum
CREATE TYPE "Species" AS ENUM ('BOVINE', 'PORCINE', 'OVINE', 'CAPRINE', 'EQUINE', 'OTHER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'QUARANTINE', 'READY_FOR_SALE', 'SOLD', 'DECEASED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('PASTURE', 'PEN', 'CORRAL', 'BARN', 'QUARANTINE_AREA', 'PADDOCK');

-- CreateEnum
CREATE TYPE "HealthEventType" AS ENUM ('VACCINATION', 'DEWORMING', 'TREATMENT', 'SURGERY', 'CHECKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "WeightSource" AS ENUM ('MANUAL', 'SCALE', 'IOT_SENSOR', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('ROTATION', 'OVERGRAZING_PREVENTION', 'MEDICAL', 'WEANING', 'SALE_PREPARATION', 'REGROUPING', 'OTHER');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "animals" (
    "id" UUID NOT NULL,
    "tag_id" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "birth_date" DATE NOT NULL,
    "initial_weight_kg" DECIMAL(7,2) NOT NULL,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "mother_id" UUID,
    "father_id" UUID,
    "current_location_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_history" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "weight_kg" DECIMAL(7,2) NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "source" "WeightSource" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_records" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "event_type" "HealthEventType" NOT NULL,
    "medication" TEXT,
    "dosage" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL,
    "withdrawal_days" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_until" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "capacity" INTEGER,
    "area_hectares" DECIMAL(8,2),
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_movements" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID NOT NULL,
    "reason" "MovementReason",
    "moved_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animals_tag_id_key" ON "animals"("tag_id");

-- CreateIndex
CREATE INDEX "animals_status_idx" ON "animals"("status");

-- CreateIndex
CREATE INDEX "animals_species_idx" ON "animals"("species");

-- CreateIndex
CREATE INDEX "animals_current_location_id_idx" ON "animals"("current_location_id");

-- CreateIndex
CREATE INDEX "animals_mother_id_idx" ON "animals"("mother_id");

-- CreateIndex
CREATE INDEX "animals_father_id_idx" ON "animals"("father_id");

-- CreateIndex
CREATE INDEX "weight_history_animal_id_measured_at_idx" ON "weight_history"("animal_id", "measured_at");

-- CreateIndex
CREATE INDEX "health_records_animal_id_applied_at_idx" ON "health_records"("animal_id", "applied_at");

-- CreateIndex
CREATE INDEX "health_records_withdrawal_until_idx" ON "health_records"("withdrawal_until");

-- CreateIndex
CREATE INDEX "health_records_event_type_idx" ON "health_records"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- CreateIndex
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE INDEX "animal_movements_animal_id_moved_at_idx" ON "animal_movements"("animal_id", "moved_at");

-- CreateIndex
CREATE INDEX "animal_movements_to_location_id_idx" ON "animal_movements"("to_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_occurred_at_idx" ON "outbox_events"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_father_id_fkey" FOREIGN KEY ("father_id") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_movements" ADD CONSTRAINT "animal_movements_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_movements" ADD CONSTRAINT "animal_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_movements" ADD CONSTRAINT "animal_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
