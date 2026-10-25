# Supabase — preparar la base de datos de la pipa

El proyecto de Supabase es compartido con La Suma. Todo lo de Nivel empieza con `nivel_`; la migración no toca ninguna otra tabla.

## Correr la migración (una sola vez)

1. Abre `supabase/migrations/20261025000000_nivel_pipa.sql` en GitHub, toca el botón **Copy raw file**.
2. Entra a <https://supabase.com/dashboard> y abre el proyecto (el mismo de La Suma).
3. En el menú de la izquierda toca **SQL Editor** → **New query**.
4. Pega todo el archivo y toca **Run** (o Ctrl/Cmd + Enter).
5. Debe decir **Success. No rows returned**. Si sale un error, no se creó nada: copia el mensaje y mándamelo.

> Si lo corres dos veces, la segunda falla con "already exists" y no cambia nada. Es normal.

## Revisar que quedó bien

En una consulta nueva del SQL Editor corre:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'nivel_%'
order by 1;
```

Deben salir 7 tablas, todas con `rowsecurity = true`. Para la captura de seguridad: **Authentication → Policies** y filtra por `nivel_`.

## Probar en la app

1. Abre <https://nivel-nine.vercel.app/pipa> → **Entrar con Google**.
2. Al volver debe decir "Entraste como …" y "Todo listo".
   Si dice "Falta preparar la base de datos", la migración no corrió.

Google ya está activado y `https://nivel-nine.vercel.app/**` ya está en Redirect URLs, así que no hay que cambiar nada en **Authentication → URL Configuration**. La app siempre regresa a `/auth/callback` de su propio dominio y no usa el Site URL (que es de La Suma).
