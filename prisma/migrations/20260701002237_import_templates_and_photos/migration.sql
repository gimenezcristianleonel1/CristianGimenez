-- Módulo de importación inteligente: plantillas de mapeo y fotos por animal.

CREATE TABLE "import_templates" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "signature" TEXT NOT NULL,
    "name" TEXT,
    "mapping" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_templates_establishment_id_idx" ON "import_templates"("establishment_id");
CREATE UNIQUE INDEX "import_templates_establishment_id_signature_key" ON "import_templates"("establishment_id", "signature");
ALTER TABLE "import_templates" ADD CONSTRAINT "import_templates_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "animal_photos" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "mime_type" TEXT NOT NULL,
    "filename" TEXT,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "animal_photos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "animal_photos_animal_id_key" ON "animal_photos"("animal_id");
ALTER TABLE "animal_photos" ADD CONSTRAINT "animal_photos_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
