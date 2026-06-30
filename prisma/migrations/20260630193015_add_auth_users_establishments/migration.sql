-- Multi-tenancy + autenticación: introduce User y Establishment, y vincula
-- Animal/Location a un establecimiento. Migración segura para datos existentes:
-- crea un establecimiento "legacy" y backfillea las filas previas antes de
-- imponer NOT NULL.

-- 1) Tablas de identidad ------------------------------------------------------
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "establishments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "establishments_owner_id_idx" ON "establishments"("owner_id");

ALTER TABLE "establishments"
  ADD CONSTRAINT "establishments_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Columnas de tenant (nullable temporalmente) ------------------------------
DROP INDEX IF EXISTS "animals_tag_id_key";
DROP INDEX IF EXISTS "locations_name_key";
ALTER TABLE "animals" ADD COLUMN "establishment_id" UUID;
ALTER TABLE "locations" ADD COLUMN "establishment_id" UUID;

-- 3) Backfill de datos previos a un establecimiento "legacy" ------------------
DO $$
DECLARE
  legacy_user uuid := '00000000-0000-0000-0000-000000000001';
  legacy_est  uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  IF EXISTS (SELECT 1 FROM "animals") OR EXISTS (SELECT 1 FROM "locations") THEN
    INSERT INTO "users" ("id", "google_id", "email", "name", "created_at", "updated_at")
      VALUES (legacy_user, 'legacy', 'legacy@local', 'Datos previos', now(), now())
      ON CONFLICT DO NOTHING;
    INSERT INTO "establishments" ("id", "name", "owner_id", "created_at", "updated_at")
      VALUES (legacy_est, 'Establecimiento (datos previos)', legacy_user, now(), now())
      ON CONFLICT DO NOTHING;
    UPDATE "animals" SET "establishment_id" = legacy_est WHERE "establishment_id" IS NULL;
    UPDATE "locations" SET "establishment_id" = legacy_est WHERE "establishment_id" IS NULL;
  END IF;
END $$;

-- 4) Imponer NOT NULL ---------------------------------------------------------
ALTER TABLE "animals" ALTER COLUMN "establishment_id" SET NOT NULL;
ALTER TABLE "locations" ALTER COLUMN "establishment_id" SET NOT NULL;

-- 5) Índices y unicidad por establecimiento -----------------------------------
CREATE INDEX "animals_establishment_id_idx" ON "animals"("establishment_id");
CREATE UNIQUE INDEX "animals_establishment_id_tag_id_key" ON "animals"("establishment_id", "tag_id");
CREATE INDEX "locations_establishment_id_idx" ON "locations"("establishment_id");
CREATE UNIQUE INDEX "locations_establishment_id_name_key" ON "locations"("establishment_id", "name");

ALTER TABLE "animals"
  ADD CONSTRAINT "animals_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
