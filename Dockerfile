# ============================================================
#  Backend (NestJS + Prisma) - imagen de producción
# ============================================================
FROM node:20-slim

WORKDIR /app

# OpenSSL + certificados: requeridos por los engines de Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Instala dependencias (incluye Prisma CLI para migrate/generate).
COPY package*.json ./
RUN npm ci

# Genera el cliente Prisma y compila TypeScript.
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json tsconfig-paths.bootstrap.js ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Aplica migraciones pendientes y arranca la API.
CMD ["sh", "-c", "npx prisma migrate deploy && node -r ./tsconfig-paths.bootstrap.js dist/main.js"]
