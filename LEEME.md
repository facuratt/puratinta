# Pura Tinta — web

- `/` inicio · `/pedido` hacer pedido (sube archivos + ticket en impresora 3D) · `/contacto` · `/panel` pedidos (privado)
- Datos del negocio (WhatsApp, Instagram, alias de Mercado Pago, precios): `app/config.ts`
- Los precios que cobra el sistema están en la tabla `prices` de Supabase (si cambian, actualizar ahí y en `config.ts`).
- La web es 100% estática. Pedidos, archivos, usuarios y el aviso por email viven en Supabase.

## Publicación (GitHub + Cloudflare)
Esta carpeta está conectada al repositorio github.com/facuratt/puratinta. Cloudflare (Worker `puratinta`)
toma el código de GitHub, lo compila (`npm run build`) y publica la carpeta `out/` (ver `wrangler.jsonc`).

Para publicar una corrección, desde esta carpeta:
```
git add -A
git commit -m "descripción del cambio"
git push
```
En un par de minutos Cloudflare publica la versión nueva.

Configuración en Cloudflare → Worker `puratinta` → Settings → Build:
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Dominio propio: Worker → Settings → Domains & Routes → Add → Custom domain.
Supabase → Authentication → URL Configuration → **Site URL** = la dirección de la web.

## Correr en la compu
```
npm run dev
```
Abrir http://localhost:3000

## Usuarios del panel
Los usuarios viven en **Supabase Auth** (proyecto `pura-tinta`, servidor en São Paulo). Las contraseñas se guardan cifradas: nadie puede verlas, ni desde el panel de Supabase. Cloudflare solo publica la web y no guarda usuarios.

Para cada persona que tenga que ver los pedidos:
1. Supabase → proyecto **pura-tinta** → Authentication → Users → **Add user** → **Create new user** (email + contraseña, tildar *Auto Confirm User*).
2. Authentication → Sign In / Providers → desactivar **Allow new users to sign up**.
3. SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email in ('EMAIL_DE_ELLA', 'TU_EMAIL');
   ```

## Aviso por email de cada pedido
Lo envía la función `notify-order` de Supabase (código en `supabase/functions/notify-order`).
1. Crear cuenta en resend.com y generar una API key.
2. Supabase → Edge Functions → **Secrets** → agregar:
   - `RESEND_API_KEY` = la clave de Resend
   - `ORDER_EMAIL_TO` = el email donde llegan los pedidos
   - `SITE_URL` = la dirección de la web (para el enlace al panel)
Con el remitente `onboarding@resend.dev` solo se puede enviar al email con el que te registraste en Resend; para otro remitente hay que verificar un dominio en Resend y agregar `ORDER_EMAIL_FROM`.

## Supabase plan gratis
El proyecto se pausa tras 7 días sin actividad. Si pasa, la web se sigue viendo pero los pedidos fallan hasta reactivarlo desde supabase.com.
