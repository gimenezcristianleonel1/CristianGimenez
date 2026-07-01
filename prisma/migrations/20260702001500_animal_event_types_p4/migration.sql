-- Paso 4: nuevos tipos de evento (cambio de caravana, ingresos/egresos, revisión de toros).
ALTER TYPE "AnimalEventType" ADD VALUE 'CAMBIO_CARAVANA' BEFORE 'OTRO';
ALTER TYPE "AnimalEventType" ADD VALUE 'INGRESO' BEFORE 'OTRO';
ALTER TYPE "AnimalEventType" ADD VALUE 'EGRESO' BEFORE 'OTRO';
ALTER TYPE "AnimalEventType" ADD VALUE 'REVISION_TORO' BEFORE 'OTRO';
