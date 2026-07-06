# Bot de WhatsApp (WhatsApp Cloud API + Gemini) — guía de alta

Módulo **aislado** (`src/modules/whatsapp/`). No toca ningún endpoint del
frontend. Rutas nuevas y públicas bajo el prefijo global:

```
GET  /api/v1/whatsapp/webhook   → verificación de Meta
POST /api/v1/whatsapp/webhook   → mensajes entrantes
```

## Arquitectura (motor de eventos dinámico)
1. **Gemini** clasifica LIBREMENTE el `eventType` y mete todo lo variable en
   `metadata` (JSONB). No hay lista cerrada de acciones.
2. **Log genérico**: cada evento se guarda en la bitácora `AnimalEvent` (con
   `data` JSONB). Acciones nuevas se registran solas (`type = OTRO` + el
   `eventType` real en el JSON) → **sin reescribir el servidor**.
3. **Efectos declarativos** (`event-registry.ts`): solo las acciones que MUTAN
   estado tienen una entrada en un diccionario `eventType → efecto`:
   - `BAJA_MUERTE`/`MUERTE` → `status = DECEASED` (+ fecha de baja en metadata)
   - `VENTA`/`VENDIDO` → `status = SOLD`
   - `TRASLADO`/`CAMBIO_POTRERO` → actualiza `currentLocationId` + `AnimalMovement`
   - `TRATAMIENTO`/`SANIDAD` → crea `HealthRecord` (con carencia)
   - `PESAJE` → append a `WeightHistory`
   - `NACIMIENTO` → crea la cría (Animal ACTIVE) y liga la madre (`PARICION`)

   Agregar una acción con efecto = **una línea** en ese diccionario.

## Requisitos (todo gratis)
- **Meta / WhatsApp Cloud API** (recepción y respuestas de texto <24 h son gratis).
- **Google AI Studio** (Gemini API key gratuita).

## Variables de entorno (setear en Render → Environment)
```
WHATSAPP_VERIFY_TOKEN=un-texto-secreto-inventado
WHATSAPP_TOKEN=<access token de Meta>            # System User token (permanente)
WHATSAPP_PHONE_NUMBER_ID=<Phone number ID>        # del número emisor
GEMINI_API_KEY=<API key de Google AI Studio>
GEMINI_MODEL=gemini-2.0-flash                      # opcional
WHATSAPP_ESTABLISHMENT_ID=<uuid del establecimiento>   # MVP de un solo campo
```
> Si faltan, el server arranca igual y el bot queda inerte (no rompe nada).

## Autorizar quién puede escribir (seguridad)
El webhook es anónimo, así que solo se procesan mensajes de números autorizados.
Dos formas:
- **Simple (1 campo):** setear `WHATSAPP_ESTABLISHMENT_ID`. Todos los mensajes
  se imputan a ese establecimiento.
- **Multi-tenant (sin migración):** en `Establishment.metadata` guardar
  `{ "whatsapp": { "operators": ["5493511234567", "..."] } }`. El número que
  envía se busca ahí. Los no autorizados se ignoran.

## Alta en Meta (una vez)
1. https://developers.facebook.com → **Create App** → tipo *Business*.
2. Agregar el producto **WhatsApp**. Meta te da un **número de prueba** y un
   **Phone number ID** (copialo a `WHATSAPP_PHONE_NUMBER_ID`).
3. **Access token permanente:** creá un *System User* (Business Settings) con
   permiso `whatsapp_business_messaging` y generá un token → `WHATSAPP_TOKEN`.
4. **Configurar Webhook:** en WhatsApp → Configuration → Webhook:
   - Callback URL: `https://<tu-api-en-render>/api/v1/whatsapp/webhook`
   - Verify token: el mismo `WHATSAPP_VERIFY_TOKEN`.
   - Suscribir el campo **messages**.
5. Agregá tu celular como destinatario de prueba y escribile al número de Meta.

## Alta en Google AI Studio (una vez)
1. https://aistudio.google.com/app/apikey → **Create API key** (gratis).
2. Pegala en `GEMINI_API_KEY`.

## Probar
Mandá al número de WhatsApp (desde un número autorizado):
- "se murió la vaca 120"      → baja (DECEASED) + evento MUERTE
- "pesé 320 la 140"           → WeightHistory 320 kg
- "pasé los del potrero 2 al 4" → mueve el lote + AnimalMovement
- "le di antiparasitario al lote 2" → HealthRecord por animal
- "nació un ternero de la madre 405" → crea la cría + PARICION
- "revisé el alambrado del 3"  → acción NUEVA: se registra sola en la bitácora

## Hardening opcional (recomendado luego)
- Verificar la firma `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET` (requiere
  activar `rawBody: true` en `main.ts`).
- Dedupe durable de mensajes (hoy es en memoria; sirve para 1 instancia).
