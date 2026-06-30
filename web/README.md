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
- **Sincronización automática:** al recuperar conexión, al abrir la app y cada 30 s.
  También hay un botón manual *Sincronizar*.
- **Indicadores claros:** estado en línea / sin conexión, cantidad de cambios
  pendientes y operaciones rechazadas por el servidor.
- **Instalable:** Service Worker (Workbox) precachea la app para que cargue sin red.
- **Mobile-first:** botones grandes, pensada para el teléfono en el campo.

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

## 🚀 Desarrollo

```bash
cp .env.example .env          # configura VITE_API_URL (default http://localhost:3000/api/v1)
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
