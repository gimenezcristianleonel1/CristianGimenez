# 🐄 Gestión Ganadera — PWA Offline-First (Frontend)

Aplicación web **instalable (PWA)** y **offline-first**, pensada para usarse **en el
campo sin conexión a internet**. Todo lo que se registra se guarda en el dispositivo y
**se sincroniza automáticamente** con la API cuando vuelve la señal.

## ✨ Características

- **100% funcional sin conexión:** alta de animales, pesajes, eventos sanitarios,
  movimientos de potrero y ubicaciones funcionan offline.
- **Persistencia local (IndexedDB / Dexie):** la UI lee siempre de la base local.
- **Cola de sincronización (Outbox del cliente):** cada cambio offline se encola y se
  reenvía al backend al reconectar — con **IDs generados en el cliente** ⇒ idempotente
  (los reintentos no duplican datos).
- **Sincronización automática e inmediata:** apenas guardás algo se dispara un *push*
  en segundo plano (debounced), así el indicador “sin sincronizar” se limpia en ~1 s sin
  esperar. El *pull* completo corre al abrir la app, al recuperar conexión y cada 60 s.
  También hay un botón manual *Sincronizar*. La escritura es siempre **optimista** (local
  primero) y nunca bloquea la UI esperando la red.
- **Indicadores claros:** estado en línea / sin conexión, cantidad de cambios
  pendientes y operaciones rechazadas por el servidor.
- **Instalable:** Service Worker (Workbox) precachea la app para que cargue sin red.
- **Mobile-first:** botones grandes, pensada para el teléfono en el campo.

## 📋 Sección Planificación (Tareas)

- Alta de **tareas** con fecha límite, y **check** para completar/reabrir (offline-first).
- **Banner de alerta** cuando hay tareas pendientes **vencidas o que vencen en 48 h**
  (misma lógica que el backend, calculada también localmente para funcionar sin conexión).
- **Badge en la barra inferior:** el ícono de *Tareas* muestra un **contador rojo** con la
  cantidad de tareas urgentes (pendientes vencidas o que vencen en 48 h), así se ve **desde
  cualquier pantalla** sin entrar a la sección. Se recalcula solo (offline) al completar tareas.
- Las tareas cumplidas se agrupan en una sección aparte. Todo sincroniza solo.

## 📊 Sección Análisis

- **Carga por potrero (EV/Ha):** carga animal real de cada potrero en **Equivalente
  Vaca por hectárea**. El EV de cada animal se infiere por categoría (sexo + edad, con
  overrides en `metadata`) y se calcula **en el dispositivo** (offline). Avisa si un
  potrero no tiene hectáreas o si la carga es alta (sobrepastoreo).
- **Reproductivo (tacto / ecografía):** trabajo de manga. Elegís el potrero y marcás
  cada animal como **preñada / vacía**; el **resumen del lote** (total, % preñez, %
  vacías + alerta si vacías > 15%) se actualiza **al instante y sin conexión**. Cada
  chequeo se encola y **sincroniza** al backend (`POST /reproductive`).

## 📥 Sección Importar

- **Drag & drop** de Excel: fuzzy matching de columnas; si hay encabezados desconocidos
  aparece un **selector de mapeo** (y se recuerda para la próxima vez).
- **Drag & drop** de fotos: se asocian al animal por el nombre del archivo (caravana).
- **Exportar** todos los animales del establecimiento a Excel.

## 🧱 Stack

React + TypeScript · Vite · Dexie (IndexedDB) · vite-plugin-pwa (Workbox) · React Router.

## 🏗️ Arquitectura offline-first

```
Acción del usuario
      │
      ▼
 repository.ts ──> IndexedDB (Dexie)   ← la UI lee de acá (siempre, online u offline)
      │                 │
      │                 └──> outbox (cola de operaciones pendientes)
      ▼
 syncEngine.ts (al reconectar / cada 30s / botón)
      │  push: reenvía la cola al backend (FIFO, idempotente por id de cliente)
      │  pull: baja datos frescos del backend (respeta cambios locales sin sincronizar)
      ▼
        API NestJS (PostgreSQL)
```

- Operaciones rechazadas por el servidor (validación / regla de negocio) **no se
  reintentan**: se guardan en `conflicts` y se muestran en el panel de inicio.

## 🔐 Inicio de sesión

- Pantalla de login con **email + contraseña** (gratis, sin servicios externos) y un
  botón opcional de **Google** (sólo si definís `VITE_GOOGLE_CLIENT_ID`).
- Pestañas **Ingresar / Crear cuenta**. Al crear cuenta podés nombrar tu establecimiento.
- La sesión (token + usuario + establecimiento) se guarda en `localStorage` y **persiste**
  entre recargas y uso offline.
- El nombre del establecimiento se muestra en la cabecera; los datos quedan **aislados
  por cuenta** (al cambiar de establecimiento en el mismo dispositivo, se limpia el caché local).
- El token se adjunta automáticamente (`Authorization: Bearer`) en cada llamada y en la
  sincronización. Si expira, la app vuelve al login.

> ⚠️ El **primer** inicio de sesión requiere conexión a internet. Luego la app funciona
> offline con la sesión guardada.

## 🚀 Desarrollo

```bash
cp .env.example .env          # VITE_API_URL + VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                   # http://localhost:5173
```

> Requiere el backend corriendo (ver el README raíz). El backend ya tiene **CORS**
> habilitado y acepta **IDs del cliente** para la sincronización idempotente.

## 📦 Build de producción

```bash
npm run build       # genera dist/ con Service Worker + manifest
npm run preview     # sirve el build localmente
```

## ✅ Verificación

Probado de punta a punta con Chromium (Playwright): crear datos **offline**, confirmar
que persisten localmente y **no** están en el backend, reconectar y verificar que se
**sincronizan** correctamente.
