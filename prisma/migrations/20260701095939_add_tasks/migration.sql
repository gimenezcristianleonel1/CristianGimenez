-- Planificación y tareas del campo.
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "establishment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_establishment_id_idx" ON "tasks"("establishment_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
