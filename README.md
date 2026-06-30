# 🐄 Livestock Management System (Sistema de Gestión Ganadera)

API REST modular para la gestión integral de ganado: **trazabilidad animal**,
**sanidad**, **movimientos de potreros** y **bases de inteligencia predictiva**.
Construido con una arquitectura limpia, orientada a eventos y preparada para escalar
hacia microservicios, telemetría IoT y pipelines de Machine Learning.

> Estado: **MVP en construcción incremental.** Este repositorio se desarrolla por pasos.
> **Pasos completados: Paso 1 (Configuración) · Paso 2 (Modelado) · Paso 3 (Core Inventario Animal).**

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

## 🗃️ Modelo de Datos (Paso 2)

Esquema relacional en PostgreSQL diseñado para **trazabilidad**, **series temporales**
e **ingesta futura de datos para IA**:

| Tabla | Rol | Diseño |
|-------|-----|--------|
| `animals` | Agregado raíz de trazabilidad | Caravana única, genealogía (auto-relación madre/padre), ubicación actual, `metadata JSONB` |
| `weight_history` | Histórico de pesajes | **Serie temporal append-only** (UPDATE bloqueado por trigger) |
| `health_records` | Eventos sanitarios | **Append-only**; período de carencia (`withdrawal_until`) precalculado |
| `locations` | Potreros / corrales / lotes | Capacidad (control de sobrepastoreo), tipo enum |
| `animal_movements` | Traslados entre ubicaciones | **Append-only**, origen/destino |
| `outbox_events` | **Patrón Outbox** | Persiste Domain Events en la misma transacción (EDA → brokers/IoT/ML) |

**Principios aplicados:**
- **Inmutabilidad real:** triggers PostgreSQL impiden `UPDATE` en las tablas de series
  temporales (`weight_history`, `health_records`, `animal_movements`).
- **Enums estrictos:** `Species`, `Sex`, `AnimalStatus`, `LocationType`, `HealthEventType`,
  `WeightSource`, `MovementReason`, `OutboxStatus` → datos limpios para entrenamiento de IA.
- **Enriquecimiento sin migraciones:** columna `metadata JSONB` en todas las tablas principales.

Migraciones versionadas en [`prisma/migrations/`](./prisma/migrations). Datos de ejemplo
en [`prisma/seed.ts`](./prisma/seed.ts).

---

## 🐮 Módulo 1 — Inventario Animal (Paso 3)

CRUD completo del agregado `Animal` con validaciones de negocio, historial de
pesajes (serie temporal) e inteligencia de proyección de peso.

### Endpoints (`/api/v1/animals`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/animals` | Registrar animal |
| `GET` | `/animals` | Listar (filtros: `species`, `status`, `locationId` + paginación) |
| `GET` | `/animals/:id` | Detalle con genealogía y últimos pesajes |
| `PATCH` | `/animals/:id` | Actualizar datos mutables |
| `DELETE` | `/animals/:id` | Eliminar |
| `PATCH` | `/animals/:id/status` | Cambiar estado (valida transición + carencia) |
| `POST` | `/animals/:id/weights` | Registrar pesaje (append-only) |
| `GET` | `/animals/:id/weights` | Histórico de pesajes |
| `GET` | `/animals/:id/weights/projection` | **GDP + proyección 30/60/90 días** |

### Validaciones de negocio
- Caravana (`tagId`) única → `409`.
- `birthDate` / `measuredAt` no pueden ser futuras → `400`.
- Peso `> 0`.
- Madre/padre deben existir y tener el sexo correcto; un animal no puede ser su propio padre/madre.
- Ubicación debe existir y respetar su **capacidad** (anti-sobrepastoreo) → `409`.
- **Transiciones de estado** controladas (`SOLD`/`DECEASED` son terminales).
- **Regla predictiva de inocuidad:** no se puede marcar `READY_FOR_SALE`/`SOLD`
  un animal dentro de un **período de carencia** activo → `409`.

### Inteligencia (Sección C)
- `PredictiveEngine` (token DI) con implementación `rule-based-linear-v1`:
  estima la **GDP** por regresión lineal sobre la serie de pesajes y **proyecta**
  el peso a 30/60/90 días con un nivel de confianza.
- Cada cambio de estado emite un **Domain Event** persistido en el **Outbox**
  dentro de la misma transacción.

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
- [x] **Paso 2** — Modelado de datos (schema Prisma + migraciones, series temporales, Outbox)
- [x] **Paso 3** — Core: CRUD de Inventario Animal + validaciones + GDP/proyección + eventos
- [ ] **Paso 4** — Endpoints sanitarios y de movimiento de potreros
- [ ] **Paso 5** — Documentación Swagger completa + pruebas unitarias (GDP, alertas)
