-- Task: hitos de aviso ya enviados por push (para no repetir)
ALTER TABLE "tasks" ADD COLUMN "notified_milestones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Suscripciones de navegador a Web Push (avisos con la app cerrada)
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "establishment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_establishment_id_idx" ON "push_subscriptions"("establishment_id");

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
