# Migrar la base de datos a Supabase (gratis y permanente)

La app usa **NestJS + Prisma** (API en Render) y ahora la base de datos vive en
**Supabase** (Postgres del plan free, que no se borra como la de Render).

Proyecto ya creado: **`ganaderia-app-db`**
- URL del proyecto: `https://qpombfovgklcepixudaa.supabase.co`
- Referencia (ref): `qpombfovgklcepixudaa`
- Región: `us-east-1` · Postgres 17

> Elegiste **arrancar limpio**: la base empieza vacía y Prisma crea las tablas
> solo cuando el backend despliega. No se copian datos previos de Render.

---

## Pasos (una sola vez)

### 1) Contraseña + cadena de conexión en Supabase
1. Entrá a Supabase → proyecto **ganaderia-app-db**.
2. **Settings → Database → Reset database password** y guardá la contraseña
   (la vas a usar en el paso 2). Anotala en un lugar seguro.
3. Arriba, botón **Connect** → pestaña **Session pooler** (puerto **5432**).
   Copiá la cadena. Se ve así:

   ```
   postgresql://postgres.qpombfovgklcepixudaa:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

   - Reemplazá `TU_PASSWORD` por la contraseña del paso 2.
   - Agregá al final `?sslmode=require` si no lo trae:

   ```
   ...supabase.com:5432/postgres?sslmode=require
   ```

   > Importante: usá **Session pooler (5432)**, NO el "Transaction pooler (6543)".
   > El de 5432 permite que Prisma cree las tablas (migraciones). El directo
   > (`db.<ref>...:5432`) es IPv6 y Render no lo alcanza; por eso el pooler.

### 2) Poner esa cadena en Render
1. Render → servicio **livestock-api** → **Environment**.
2. En **DATABASE_URL** pegá la cadena del paso 1. Guardá.
   - (Este repo ya deja `DATABASE_URL` como valor manual, así que no hay
     conflicto con la base vieja de Render.)

### 3) Desplegar
1. Render → **Manual Deploy → Deploy latest commit** (o esperá el auto-deploy).
2. En el arranque corre `prisma migrate deploy`, que **crea todas las tablas en
   Supabase**. En los logs vas a ver las migraciones aplicadas.

### 4) Verificar
1. Abrí la app (Netlify), **registrá una cuenta de prueba** y cargá un animal.
2. En Supabase → **Table Editor** deberías ver las tablas (`Animal`, `Location`,
   etc.) y el registro recién creado.

### 5) Limpieza (opcional)
- En Render podés **borrar la base vieja** `livestock-db` (ya no se usa; al
  quitarla del `render.yaml`, un "Sync" del Blueprint también la elimina).

---

## Notas
- **Costo:** $0. Netlify free (frontend) + Render free (API) + Supabase free (base).
- **Inactividad:** el proyecto free de Supabase puede **pausarse tras ~1 semana
  sin uso**; se reactiva solo al volver a usarlo (los datos se conservan). Si el
  campo queda sin internet mucho tiempo, con abrir la app y sincronizar alcanza.
- **Backup extra:** además, cada tanto usá **Exportar a Excel** desde la app
  para tener una copia propia de los animales.
