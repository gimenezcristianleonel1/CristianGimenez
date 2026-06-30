# 🐄 Livestock Management System (Sistema de Gestión Ganadera)

API REST modular para la gestión integral de ganado: **trazabilidad animal**,
**sanidad**, **movimientos de potreros** y **bases de inteligencia predictiva**.
Construido con una arquitectura limpia, orientada a eventos y preparada para escalar
hacia microservicios, telemetría IoT y pipelines de Machine Learning.

> Estado: **MVP COMPLETO + PWA offline-first.** Backend (5 pasos) y frontend listos.
> Pasos: 1 (Config) · 2 (Modelado) · 3 (Inventario Animal) · 4 (Sanidad + Movimientos) · 5 (Swagger + Tests).

## 🔐 Autenticación + Multi-tenancy

Cada cuenta queda vinculada a su **Establecimiento** de forma aislada (multi-tenant).
Hay **dos formas de iniciar sesión**:

1. **Email + contraseña (gratis, recomendada — sin servicios externos).** `POST
   /auth/register` y `POST /auth/login`. Las contraseñas se guardan con **bcrypt**.
   No requiere Google Cloud ni tarjeta.
2. **Google (opcional).** Si configurás `GOOGLE_CLIENT_ID`, el frontend muestra el botón
   "Sign in with Google": el *ID token* se verifica con `google-auth-library` en
   `POST /auth/google`.

En todos los casos el backend hace *upsert* del `User`, crea su `Establishment` en el
primer ingreso (o lo recupera en los siguientes) y emite un **JWT propio**. Todas las
rutas (salvo `/health`, `/auth/register`, `/auth/login` y `/auth/google`) exigen
`Authorization: Bearer`.

- **Modelos:** `User` (email + `passwordHash` y/o `googleId`) y `Establishment`
  (FK `ownerId` → `User`).
- **Aislamiento:** `Animal` y `Location` llevan `establishmentId`; caravana y nombre de
  ubicación son únicos **por establecimiento**. Cada request sólo ve/edita datos de su
  establecimiento (verificado con tests de aislamiento entre tenants).
- **Endpoints:** `POST /auth/register`, `POST /auth/login`, `POST /auth/google`,
  `GET /auth/me`, `PATCH /auth/establishment`.

### Variables de entorno (auth)
| Variable | Descripción |
|----------|-------------|
| `JWT_SECRET` | Secreto para firmar los JWT (cambiar en producción) |
| `JWT_EXPIRES_IN` | Duración del token (default `30d`, pensado para uso offline) |
| `GOOGLE_CLIENT_ID` | *(opcional)* OAuth Client ID (Web) si querés login con Google |
| `VITE_GOOGLE_CLIENT_ID` | *(opcional, frontend)* El mismo Client ID |

> El login con email/contraseña funciona **sin configurar nada de Google**. El botón de
> Google sólo aparece si definís `VITE_GOOGLE_CLIENT_ID` en el frontend.

---

## 🗂️ Estructura del repositorio

| Carpeta | Qué es |
|---------|--------|
| **`/` (raíz)** | **Backend** — API REST NestJS + Prisma + PostgreSQL (este README) |
| **[`/web`](./web)** | **Frontend** — PWA offline-first (React + Vite) para trabajar en el campo sin internet |

> 📱 **¿Buscás la app de campo (offline + sincronización)?** Ver [`web/README.md`](./web/README.md).

## 🐳 Levantar todo con Docker (un solo comando)

`docker-compose.yml` orquesta **PostgreSQL + Backend + Frontend**. Aplica las migraciones
automáticamente al arrancar.

```bash
# (opcional) cp .env.example .env  y ajustá JWT_SECRET
docker compose up -d --build
```

| Servicio | URL |
|----------|-----|
| Frontend (PWA) | http://localhost:8080 |
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/v1/docs |

```bash
docker compose logs -f api     # ver logs del backend
docker compose down            # frenar (agregá -v para borrar la base)
```

Variables útiles (en `.env` de la raíz, todas opcionales con defaults):
`JWT_SECRET`, `POSTGRES_PASSWORD`, `WEB_PORT`, `API_PORT`, `VITE_API_URL`,
`GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (sólo si querés login con Google).

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

## 🩺 Módulo 2 — Sanidad · 📍 Módulo 3 — Ubicaciones y Movimientos (Paso 4)

### Sanidad (`/api/v1/animals/:animalId/health`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `.../health` | Registrar evento sanitario (vacuna, desparasitación, tratamiento, cirugía) |
| `GET` | `.../health` | Historial sanitario (append-only) |
| `GET` | `.../health/withdrawal-status` | Estado de carencia (apto para consumo/venta) |

- `withdrawalUntil` se **calcula** (`appliedAt + withdrawalDays`) y se persiste.
- `medication` es obligatorio para `VACCINATION`, `DEWORMING` y `TREATMENT`.
- Emite `animal.health_event_recorded.v1` al Outbox.

### Ubicaciones (`/api/v1/locations`)
CRUD completo de potreros/corrales/lotes con control de **capacidad** y **ocupación**.
No se puede reducir la capacidad por debajo de la ocupación ni borrar una ubicación con animales.

### Movimientos (`/api/v1/animals/:animalId/movements`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `.../movements` | Trasladar animal a otra ubicación |
| `GET` | `.../movements` | Historial de movimientos (append-only) |

- **Transaccional:** crea el movimiento, actualiza `currentLocationId` del animal y
  escribe el evento `animal.moved.v1` en el Outbox, todo en una sola transacción.
- Valida capacidad del destino (anti-sobrepastoreo), que no sea la ubicación actual
  y que el animal no esté en estado terminal (`SOLD`/`DECEASED`).

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

## 🧪 Pruebas (Paso 5)

**22 pruebas unitarias** sobre la lógica de negocio crítica (sin necesidad de base de
datos: repositorios y publicadores mockeados).

```bash
npm test
```

| Suite | Cubre |
|-------|-------|
| `rule-based-predictive.engine.spec` | **Cálculo de GDP** (regresión lineal exacta), proyección 30/60/90, casos borde (serie vacía, 1 muestra, pendiente negativa) |
| `animals.service.spec` | Transiciones de estado, **bloqueo de venta en carencia**, caravana única, 404 |
| `sanitary.service.spec` | **Cálculo de `withdrawalUntil`**, medicamento obligatorio, estado de carencia |
| `movements.service.spec` | Capacidad de destino, no-misma-ubicación, animales terminales |

## 📖 Documentación de la API (Swagger / OpenAPI)

Especificación **OpenAPI 3.0** autogenerada desde los decoradores + introspección de
comentarios. Disponible en `http://localhost:3000/api/v1/docs` (UI) y
`.../docs-json` (JSON). 11 rutas, 5 tags, 8 esquemas DTO.

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
- [x] **Paso 4** — Sanidad (Módulo 2) + Ubicaciones y Movimientos (Módulo 3)
- [x] **Paso 5** — Documentación Swagger/OpenAPI + 22 pruebas unitarias (GDP, carencia, transiciones)

### 🔭 Siguientes pasos (post-MVP)
- Relay del Outbox a un broker (Kafka/RabbitMQ) + workers de proyección/alertas.
- Alerta predictiva de bajo rendimiento por lote (GDP < 20% del promedio del potrero).
- Autenticación/Autorización (JWT + roles) y multi-tenant (establecimientos).
- Ingesta de telemetría IoT (caravanas/collares) hacia `metadata` y series temporales.
- Motor de IA real (Scikit-Learn/TensorFlow/LLM) detrás de `PredictiveEngine`.
