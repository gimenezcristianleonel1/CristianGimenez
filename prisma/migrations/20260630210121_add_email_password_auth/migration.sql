-- Habilita autenticación por email + contraseña (gratuita, sin proveedor externo).
-- google_id pasa a ser opcional y se agrega password_hash.
ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
