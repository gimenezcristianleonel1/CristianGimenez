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

## Seguridad de la base (ya aplicado)
- **RLS activado** en todas las tablas: la API pública/anon de Supabase queda
  **sin acceso**; tu app sigue funcionando porque Prisma se conecta como dueño
  (rol que saltea RLS). No hay que hacer nada más.

## Evitar que Supabase se pause (keep-alive)
El proyecto free se **pausa tras ~7 días sin uso**. Para evitarlo conviene una
GitHub Action que lo "toque" cada 2 días.

> Nota: este archivo de workflow hay que crearlo **desde la web de GitHub**
> (el token automático no tiene permiso para subir workflows).

**Paso A — crear el workflow (1 minuto):**
1. GitHub → repo → **Add file → Create new file**.
2. Nombre del archivo: `.github/workflows/keepalive-supabase.yml`
3. Pegá este contenido y **Commit**:

```yaml
name: Keep Supabase awake

on:
  schedule:
    - cron: '0 6 */2 * *' # cada 2 días, 06:00 UTC
  workflow_dispatch: {}

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST (genera actividad en la base)
        env:
          SUPABASE_URL: https://qpombfovgklcepixudaa.supabase.co
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          if [ -z "$SUPABASE_ANON_KEY" ]; then
            echo "Falta el secreto SUPABASE_ANON_KEY."; exit 1
          fi
          code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
            "$SUPABASE_URL/rest/v1/animals?select=id&limit=1" \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY")
          echo "Respuesta HTTP: $code"
          case "$code" in
            200|401|403) echo "Proyecto activo."; exit 0 ;;
            *) echo "Respuesta inesperada ($code)"; exit 1 ;;
          esac
```

**Paso B — agregar el secreto con la clave pública:**
1. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Nombre: **`SUPABASE_ANON_KEY`**
3. Valor: la **Publishable key** (Supabase → Project Settings → API Keys →
   `sb_publishable_...`). Es pública, segura de usar acá.
4. (Opcional) Actions → "Keep Supabase awake" → **Run workflow** para probar.

> Igual, si usás la app al menos una vez por semana, nunca se pausa. Y si se
> pausara, se reactiva sola al volver a entrar; **los datos se conservan**.

## Limpieza en Render (opcional)
- Al quitar la base gestionada del `render.yaml`, en el próximo **Sync** del
  Blueprint (o a mano) podés **borrar la base vieja `livestock-db`** en Render.
  Ya no se usa: `DATABASE_URL` apunta a Supabase.

## Notas
- **Costo:** $0. Netlify free (frontend) + Render free (API) + Supabase free (base).
- **Backup extra:** cada tanto usá **Exportar a Excel** desde la app para tener
  una copia propia de los animales, independiente de cualquier servidor.
