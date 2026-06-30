# 🐄 Livestock Management System (Sistema de Gestión Ganadera)

API REST modular para la gestión integral de ganado: **trazabilidad animal**,
**sanidad**, **movimientos de potreros** y **bases de inteligencia predictiva**.
Construido con una arquitectura limpia, orientada a eventos y preparada para escalar
hacia microservicios, telemetría IoT y pipelines de Machine Learning.

> Estado: **MVP en construcción incremental.** Este repositorio se desarrolla por pasos.
> **Paso actual completado: Paso 1 — Inicialización y Configuración.**

---

## 🧱 Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Lenguaje | **TypeScript** (modo estricto) |
| Framework | **NestJS 10** |
| Base de datos | **PostgreSQL 16** |
| ORM | **Prisma 5** |
| Validación | **class-validator** + **Joi** (env) |
| Documentación | **Swagger / OpenAPI** |
| Eventos | **@nestjs/event-emitter** (in-process; preparado para broker) |
| Testing | **Jest** |

---

## 🏛️ Decisiones de Arquitectura

El proyecto sigue **Arquitectura Limpia / en Capas** con separación estricta:

```
src/
├── core/                 # Dominio puro y abstracciones (sin dependencias de framework)
│   ├── domain/
│   │   └── events/       # Domain Events base + contrato del publicador (EDA)
│   └── ai/               # Interfaz PredictiveEngine (seam de extensibilidad IA)
│
├── infrastructure/       # Detalles técnicos (DB, config, transporte de eventos)
│   ├── config/           # Configuración tipada + validación de entorno
│   └── database/         # PrismaService + PrismaModule
│
├── shared/               # Utilidades transversales
│   └── filters/          # Manejo de errores centralizado (AllExceptionsFilter)
│
├── modules/              # Módulos de funcionalidad (Bounded Contexts)
│   └── health/           # Probe de salud (animals/health/locations en próximos pasos)
│
├── app.module.ts         # Composición raíz
└── main.ts               # Bootstrap (prefijo global, ValidationPipe, Swagger)
```

### Fundamentos avanzados ya sembrados en el Paso 1

- **Arquitectura Orientada a Eventos (EDA):** `DomainEvent` + `IEventPublisher`
  desacoplan la lógica del transporte. Hoy in-process; mañana Outbox + Kafka/IoT/ML
  **sin tocar el core**.
- **Abstracción de IA (`PredictiveEngine`):** contrato limpio para proyección de peso
  y analítica. La implementación (reglas → ML/LLM) se intercambia vía token de DI.
- **Tipado estricto:** `strict`, `noImplicitAny`, `noUnusedLocals`, etc.
- **Validación y errores centralizados:** `ValidationPipe` global con whitelist +
  `AllExceptionsFilter` con envelope de error estándar.

---

## 🚀 Puesta en Marcha (Desarrollo Local)

### 1. Requisitos
- Node.js ≥ 20
- Docker (para PostgreSQL) o una instancia PostgreSQL propia

### 2. Instalar dependencias
```bash
npm install
```

### 3. Variables de entorno
```bash
cp .env.example .env
# Ajusta DATABASE_URL si es necesario
```

### 4. Levantar PostgreSQL
```bash
docker compose up -d
```

### 5. Generar el cliente Prisma
```bash
npm run prisma:generate
```

> Las migraciones de tablas (`Animals`, `WeightHistory`, `HealthRecords`,
> `Locations`...) se añaden en el **Paso 2**.

### 6. Ejecutar la API
```bash
npm run start:dev
```

- API:        `http://localhost:3000/api/v1`
- Health:     `http://localhost:3000/api/v1/health`
- Swagger UI: `http://localhost:3000/api/v1/docs`

---

## 🧪 Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | API en modo watch |
| `npm run build` | Compilar a `dist/` |
| `npm test` | Ejecutar pruebas unitarias |
| `npm run prisma:migrate` | Crear/aplicar migraciones (dev) |
| `npm run prisma:studio` | Explorador visual de la DB |
| `npm run lint` | Linter + autofix |

---

## 🗺️ Roadmap de implementación

- [x] **Paso 1** — Inicialización y configuración (scaffolding, ORM, EDA + IA seams)
- [ ] **Paso 2** — Modelado de datos (schema Prisma + migraciones, series temporales)
- [ ] **Paso 3** — Core: CRUD de Inventario Animal + validaciones de negocio
- [ ] **Paso 4** — Endpoints sanitarios y de movimiento de potreros
- [ ] **Paso 5** — Documentación Swagger completa + pruebas unitarias (GDP, alertas)
