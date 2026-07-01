# 🚀 Despliegue del Backend en Render (capa gratuita) + Frontend en Netlify

Esta guía despliega el **backend (NestJS)** y **PostgreSQL** en Render, y conecta el
**frontend** (ya en Netlify) apuntándolo al backend.

> Hay dos caminos: **A) automático con Blueprint** (`render.yaml`) o **B) manual**.
> Si querés copiar/pegar variables a mano, seguí el camino **B**.

---

## Camino A — Automático (Blueprint, 1 clic)

1. En Render: **New +** → **Blueprint**.
2. Conectá tu cuenta de GitHub y elegí el repo **`gimenezcristianleonel1/CristianGimenez`**
   (rama `claude/livestock-mgmt-mvp-oy7dhw`, o la que tengas).
3. Render lee `render.yaml` y crea **la base de datos + el web service** solos.
4. Te pedirá completar las variables marcadas como *manuales*: `CORS_ORIGIN` y
   `GOOGLE_CLIENT_ID` (esta última podés dejarla vacía).
5. **Apply** → esperá a que termine el primer deploy.

Luego saltá a la sección **“Conectar el frontend (Netlify)”** más abajo.

---

## Camino B — Manual (paso a paso)

### 1) Crear la base de datos PostgreSQL (gratis)
1. Render → **New +** → **PostgreSQL**.
2. Name: `livestock-db` · Database: `livestock` · User: `ganadero` · **Plan: Free**.
3. **Create Database**. Esperá a que quede *Available*.
4. En la página de la base, copiá la **Internal Database URL** (empieza con
   `postgresql://...`). La vas a usar como `DATABASE_URL`.

### 2) Crear el Web Service (backend)
1. Render → **New +** → **Web Service** → conectá el repo de GitHub.
2. Configurá:
   - **Root Directory:** *(dejar vacío — el backend está en la raíz)*
   - **Runtime:** `Node`
   - **Branch:** `claude/livestock-mgmt-mvp-oy7dhw` (o tu rama/`main`)
   - **Build Command:**
     ```
     npm install --include=dev && npx prisma generate && npm run build
     ```
   - **Start Command:**
     ```
     npx prisma migrate deploy && npm run start:prod
     ```
   - **Health Check Path:** `/api/v1/health`
   - **Plan: Free**

### 3) Variables de entorno (copiá y pegá en *Environment*)
| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(la **Internal Database URL** del paso 1)* |
| `JWT_SECRET` | *(una cadena larga y aleatoria, ej. 40+ caracteres)* |
| `JWT_EXPIRES_IN` | `30d` |
| `CORS_ORIGIN` | `https://TU-SITIO.netlify.app` *(tu dominio de Netlify)* |
| `GOOGLE_CLIENT_ID` | *(opcional — sólo si usás login con Google)* |

> Para `JWT_SECRET` podés generar uno con:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

4. **Create Web Service** → Render compila y despliega.
5. Cuando termine, copiá la **URL pública HTTPS** del servicio, del estilo:
   `https://livestock-api.onrender.com`

---

## 🔗 Conectar el frontend (Netlify)

En Netlify → tu sitio → **Site settings → Environment variables**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://TU-BACKEND.onrender.com/api/v1` |
| `VITE_GOOGLE_CLIENT_ID` | *(opcional, sólo si usás Google)* |

> ⚠️ **Importante:** `VITE_API_URL` debe **terminar en `/api/v1`** y **sin** barra final.
> Ejemplo correcto: `https://livestock-api.onrender.com/api/v1`

Después, en Netlify hacé **Deploys → Trigger deploy → Deploy site** (las variables de
Vite se “hornean” en build time, así que hay que reconstruir).

Por último, asegurate de que en **Render** la variable `CORS_ORIGIN` tenga **exactamente**
la URL de tu sitio de Netlify (sin barra final), para que el navegador permita las llamadas.

---

## ✅ Verificación
- Backend vivo: abrí `https://TU-BACKEND.onrender.com/api/v1/health` → debe responder
  `{"status":"ok","database":"up"}`.
- Docs: `https://TU-BACKEND.onrender.com/api/v1/docs`.
- En el frontend (Netlify): registrate con email/contraseña y creá un animal; debería
  sincronizar contra Render.

## 🧩 Notas / troubleshooting
- **Cold start (free tier):** el servicio se “duerme” tras inactividad; la primera
  request tras un rato puede tardar ~30–60 s. Es normal en el plan gratuito.
- **La base free de Render** tiene límites de tiempo/almacenamiento; para uso real
  considerá un plan pago o mover la base a otro proveedor.
- **Error de conexión a la DB:** verificá que `DATABASE_URL` sea la **Internal** (no la
  External) y que el web service esté en la **misma región** que la base.
- **CORS bloqueado:** `CORS_ORIGIN` en Render debe coincidir exacto con el dominio de
  Netlify (https, sin barra final). Podés poner varias separadas por coma.
- **El frontend pega a `localhost`:** olvidaste setear `VITE_API_URL` en Netlify o no
  reconstruiste el sitio después de cambiarla.
